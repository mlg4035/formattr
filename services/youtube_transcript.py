import json
import os
import re
from html import unescape
import urllib.error
import urllib.request

TOOLERBOX_TRANSCRIPT_URL = "https://toolerbox.com/api/v1/youtube-transcript"
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
                return value
    return body.strip() or str(exc)


def _decode_html_entities(text: str) -> str:
    decoded = text
    for _ in range(MAX_HTML_UNESCAPE_PASSES):
        next_decoded = unescape(decoded)
        if next_decoded == decoded:
            break
        decoded = next_decoded
    return decoded


def fetch_youtube_transcript(video_id: str) -> str:
    normalized_id = video_id.strip()
    if not normalized_id:
        raise ValueError("Enter a YouTube video ID first.")
    if not YOUTUBE_ID_PATTERN.fullmatch(normalized_id):
        raise ValueError("YouTube video ID must be 11 characters (letters, numbers, _ or -).")

    api_key = os.getenv("TOOLERBOX_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Missing TOOLERBOX_API_KEY in your environment.")

    payload = {"url": f"https://www.youtube.com/watch?v={normalized_id}"}
    request = urllib.request.Request(
        TOOLERBOX_TRANSCRIPT_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
    )
    request.add_header("Authorization", f"Bearer {api_key}")
    request.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw_response = response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        detail = _extract_error_detail(exc)
        raise RuntimeError(f"ToolerBox transcript request failed ({exc.code}): {detail}") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(f"ToolerBox transcript request failed: {exc}") from exc

    try:
        result = json.loads(raw_response)
    except json.JSONDecodeError as exc:
        raise RuntimeError("ToolerBox transcript response was not valid JSON.") from exc

    transcript_text = result.get("text") if isinstance(result, dict) else None
    if not isinstance(transcript_text, str) or not transcript_text.strip():
        raise RuntimeError("ToolerBox transcript response did not include transcript text.")
    return _decode_html_entities(transcript_text).strip()
