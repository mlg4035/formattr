# Formattr Web (BYOK Phase 1)

This folder contains a React + Vite frontend that sends requests directly from the browser to provider APIs.

Note on TranscriptAPI transcript loading:

- Browser requests use a same-origin proxy so the API key is forwarded as a bearer token.
- This app therefore uses a same-origin proxy path (`/api/transcriptapi/youtube/transcript`) by default.
- In local development, Vite proxy handles this automatically.
- In production, route that path through your reverse proxy/backend to `https://transcriptapi.com/api/v2/youtube/transcript` and map `X-Transcriptapi-Api-Key` to `Authorization: Bearer <key>`.

Current Phase 1 scope:

- Required user-provided OpenRouter API key
- Optional user-provided TranscriptAPI key
- Direct OpenRouter model loading and format requests
- YouTube transcript import through TranscriptAPI
- Local persistence for non-sensitive formatting settings
- Opt-in API key persistence (`sessionStorage` or `localStorage`; default is memory-only)

Phase 2 additions in progress:

- Built-in and custom presets
- Local history storage with reload/delete
- Diff toggle with word-level change stats
- Copy output and markdown download actions
- Browser-side Word (.docx) export
- Template preset controls with optional H1/H2/H3 style overrides
- User guide at `/user-manual.html` (source: `../docs/user-manual.md`)

## Development

```bash
npm install
npm run dev
```

## Transcript Proxy Configuration

By default the app requests transcripts from:

- `/api/transcriptapi/youtube/transcript`

You can override this endpoint with:

- `VITE_TRANSCRIPTAPI_TRANSCRIPT_URL`

## Build

```bash
npm run build
```
