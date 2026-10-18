import json
import os
import re
from html import unescape
from urllib.parse import urlencode
import urllib.error
import urllib.request

TRANSCRIPT_API_URL = "https://transcriptapi.com/api/v2/youtube/transcript"
YOUTUBE_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{11}$")
MAX_HTML_UNESCAPE_PASSES = 5


def _extract_error_detail(exc: urllib.error.HTTPError) -> str:
    try:
        body = exc.read().decode("utf-8")
    except OSError:
        return str(exc)
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return body.strip() or str(exc)
    if isinstance(payload, dict):
        for key in ("message", "error", "detail"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                message = value.get("message")
                if isinstance(message, str) and message.strip():
                    return message.strip()
        code = payload.get("code")
        if isinstance(code, str) and code.strip():
            return code.strip()
    return body.strip() or str(exc)


def _decode_html_entities(text: str) -> str:
    decoded = text
    for _ in range(MAX_HTML_UNESCAPE_PASSES):
        next_decoded = unescape(decoded)
        if next_decoded == decoded:
            break
        decoded = next_decoded
    return decoded


def _transcript_to_text(transcript: object) -> str:
    if isinstance(transcript, str):
        return transcript.strip()
    if not isinstance(transcript, list):
        return ""
    parts: list[str] = []
    for segment in transcript:
        if isinstance(segment, str):
            text = segment
        elif isinstance(segment, dict) and isinstance(segment.get("text"), str):
            text = segment["text"]
        else:
            continue
        cleaned = text.strip()
        if cleaned:
            parts.append(cleaned)
    return " ".join(parts)


def fetch_youtube_transcript(video_id: str) -> str:
    normalized_id = video_id.strip()
    if not normalized_id:
        raise ValueError("Enter a YouTube video ID first.")
    if not YOUTUBE_ID_PATTERN.fullmatch(normalized_id):
        raise ValueError("YouTube video ID must be 11 characters (letters, numbers, _ or -).")

    api_key = os.getenv("TRANSCRIPTAPI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Missing TRANSCRIPTAPI_API_KEY in your environment.")

    query = urlencode({"video_url": normalized_id, "format": "json"})
    request = urllib.request.Request(
        f"{TRANSCRIPT_API_URL}?{query}",
        method="GET",
    )
    request.add_header("Authorization", f"Bearer {api_key}")
    request.add_header("Accept", "application/json")
    # Cloudflare rejects Python's default urllib user agent.
    request.add_header("User-Agent", "Formatr/1.0")

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw_response = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = _extract_error_detail(exc)
        raise RuntimeError(f"TranscriptAPI request failed ({exc.code}): {detail}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(f"TranscriptAPI request failed: {exc}") from exc

    try:
        result = json.loads(raw_response)
    except json.JSONDecodeError as exc:
        raise RuntimeError("TranscriptAPI response was not valid JSON.") from exc

    transcript = result.get("transcript") if isinstance(result, dict) else None
    transcript_text = _decode_html_entities(_transcript_to_text(transcript)).strip()
    if not transcript_text:
        raise RuntimeError("TranscriptAPI response did not include transcript text.")
    return transcript_text
