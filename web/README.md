# Formattr Web (BYOK Phase 1)

This folder contains a React + Vite frontend that sends requests directly from the browser to provider APIs.

Current Phase 1 scope:

- Required user-provided OpenRouter API key
- Optional user-provided ToolerBox API key
- Direct OpenRouter model loading and format requests
- Direct ToolerBox YouTube transcript import
- Local persistence for non-sensitive formatting settings

Phase 2 additions in progress:

- Built-in and custom presets
- Local history storage with reload/delete
- Diff toggle with word-level change stats
- Copy output and markdown download actions

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
