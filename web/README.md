# Formattr Web (BYOK Phase 1)

This folder contains a React + Vite frontend that sends requests directly from the browser to provider APIs.

Note on ToolerBox transcript loading:

- ToolerBox does not currently expose browser CORS headers for direct client requests.
- This app therefore uses a same-origin proxy path (`/api/toolerbox/youtube-transcript`) by default.
- In local development, Vite proxy handles this automatically.
- In production, route that path through your reverse proxy/backend to `https://toolerbox.com/api/v1/youtube-transcript` and map `X-Toolerbox-Api-Key` to `Authorization: Bearer <key>`.

Current Phase 1 scope:

- Required user-provided OpenRouter API key
- Optional user-provided ToolerBox API key
- Direct OpenRouter model loading and format requests
- Direct ToolerBox YouTube transcript import
- Local persistence for non-sensitive formatting settings
- Opt-in API key persistence (`sessionStorage` or `localStorage`; default is memory-only)

Phase 2 additions in progress:

- Built-in and custom presets
- Local history storage with reload/delete
- Diff toggle with word-level change stats
- Copy output and markdown download actions
- Browser-side Word (.docx) export
- Template preset controls with optional H1/H2/H3 style overrides

## Development

```bash
npm install
npm run dev
```

## Transcript Proxy Configuration

By default the app posts transcript requests to:

- `/api/toolerbox/youtube-transcript`

You can override this endpoint with:

- `VITE_TOOLERBOX_TRANSCRIPT_URL`

## Build

```bash
npm run build
```
