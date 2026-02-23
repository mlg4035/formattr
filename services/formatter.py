import os
import re
from collections.abc import Generator

from google import genai
from google.genai import types
from openai import OpenAI

from prompts.format_prompt import FormatOptions, build_messages


MODE_MAP = {
    "none": "strict",
    "minimal": "balanced",
    "thorough": "aggressive",
}

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class FormatterService:
    def __init__(
        self,
        provider: str = "openai",
        api_key: str | None = None,
        model: str | None = None,
        use_openrouter: bool = False,
    ) -> None:
        self.use_openrouter = use_openrouter
        self.provider = provider.lower().strip()
        if self.use_openrouter:
            self.provider = "openrouter"
            self.api_key = api_key or os.getenv("OPENROUTER_API_KEY", "")
            self.model = model or os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
        elif self.provider == "gemini":
            self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
            self.model = model or os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        else:
            self.provider = "openai"
            self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
            self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    def _client(self) -> OpenAI:
        if self.provider not in {"openai", "openrouter"}:
            raise ValueError("OpenAI client requested for non-OpenAI provider.")
        if not self.api_key:
            if self.provider == "openrouter":
                raise ValueError(
                    "Missing OpenRouter API key. Set OPENROUTER_API_KEY in your environment."
                )
            raise ValueError("Missing OpenAI API key. Set OPENAI_API_KEY in your environment.")
        if self.provider == "openrouter":
            return OpenAI(
                api_key=self.api_key,
                base_url=OPENROUTER_BASE_URL,
                default_headers={
                    "HTTP-Referer": os.getenv("OPENROUTER_HTTP_REFERER", "http://localhost"),
                    "X-Title": os.getenv("OPENROUTER_APP_TITLE", "Formatr"),
                },
            )
        return OpenAI(api_key=self.api_key)

    def _stream_openai(self, messages: list[dict[str, str]]) -> Generator[str, None, None]:
        client = self._client()
        stream = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.2,
            stream=True,
        )
        for chunk in stream:
            delta = ""
            if chunk.choices and chunk.choices[0].delta:
                delta = chunk.choices[0].delta.content or ""
            if delta:
                yield delta

    def _stream_gemini(self, messages: list[dict[str, str]]) -> Generator[str, None, None]:
        if not self.api_key:
            raise ValueError("Missing Gemini API key. Set GEMINI_API_KEY in your environment.")
        client = genai.Client(api_key=self.api_key)

        system_message = messages[0]["content"] if messages else ""
        user_message = messages[1]["content"] if len(messages) > 1 else ""
        stream = client.models.generate_content_stream(
            model=self.model,
            contents=user_message,
            config=types.GenerateContentConfig(
                temperature=0.2,
                system_instruction=system_message,
            ),
        )
        for chunk in stream:
            text = chunk.text or ""
            if text:
                yield text

    def _complete_openai(self, messages: list[dict[str, str]], temperature: float = 0.2) -> str:
        client = self._client()
        response = client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=temperature,
            stream=False,
        )
        if not response.choices:
            return ""
        return (response.choices[0].message.content or "").strip()

    def _complete_gemini(self, messages: list[dict[str, str]], temperature: float = 0.2) -> str:
        if not self.api_key:
            raise ValueError("Missing Gemini API key. Set GEMINI_API_KEY in your environment.")
        client = genai.Client(api_key=self.api_key)
        system_message = messages[0]["content"] if messages else ""
        user_message = messages[1]["content"] if len(messages) > 1 else ""
        response = client.models.generate_content(
            model=self.model,
            contents=user_message,
            config=types.GenerateContentConfig(
                temperature=temperature,
                system_instruction=system_message,
            ),
        )
        return (response.text or "").strip()

    def stream_format_text(
        self,
        text: str,
        text_changes_level: str,
        options: FormatOptions,
    ) -> Generator[str, None, None]:
        if not text or not text.strip():
            return

        mode = MODE_MAP.get(text_changes_level, "balanced")
        messages = build_messages(text=text, mode=mode, options=options)

        try:
            if self.provider == "gemini":
                yield from self._stream_gemini(messages)
            else:
                yield from self._stream_openai(messages)
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"Formatting failed: {exc}") from exc

    def format_text(self, text: str, text_changes_level: str, options: FormatOptions) -> str:
        return "".join(self.stream_format_text(text, text_changes_level, options))

    def generate_title(self, raw_text: str, formatted_text: str) -> str:
        basis = (formatted_text or raw_text or "").strip()
        if not basis:
            return "Untitled document"
        sample = basis[:3000]
        messages = [
            {
                "role": "system",
                "content": (
                    "You generate concise, high-quality document titles. "
                    "Return only the title text with no markdown, quotes, or extra punctuation."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Create a clear title (4-10 words) for this document content. "
                    "Prefer specific wording over generic labels.\n\n"
                    f"{sample}"
                ),
            },
        ]
        try:
            if self.provider == "gemini":
                title = self._complete_gemini(messages, temperature=0.1)
            else:
                title = self._complete_openai(messages, temperature=0.1)
        except Exception:
            return self.suggest_title(formatted_text or raw_text)

        cleaned = re.sub(r"\s+", " ", title).strip().strip("\"'`")
        cleaned = re.sub(r"^[#>\-\d\.\)\s]+", "", cleaned).strip()
        if not cleaned:
            return self.suggest_title(formatted_text or raw_text)
        if len(cleaned) > 120:
            cleaned = cleaned[:120].rstrip()
        return cleaned

    @staticmethod
    def suggest_title(formatted_text: str) -> str:
        cleaned = formatted_text.strip()
        if not cleaned:
            return "Untitled document"
        first_line = cleaned.splitlines()[0].strip().lstrip("#").strip()
        return first_line[:80] if first_line else "Untitled document"
