# Formattr

Formattr now supports two architectures in this repo:

- `web/` (primary): browser-first BYOK app (React + Vite). Users provide their own API keys and requests go directly to OpenRouter/ToolerBox.
<img width="1083" height="417" alt="Screenshot 2026-06-21 at 15-16-51 Formattr BYOK" src="https://github.com/user-attachments/assets/4e860791-7468-4779-a221-605844c75ee4" />

- `app.py` (legacy): Streamlit server app with local SQLite persistence and server-side API calls.
<img width="1244" height="545" alt="Screenshot 2026-06-21 at 15-28-36 Formatr" src="https://github.com/user-attachments/assets/d85e9518-37cc-43f4-af96-7d6d41d4ae0a" />

## Features

- Shared formatting experience:
  - Text change levels (`Strict`, `Minimal`, `Thorough`)
  - Markdown toggles (Bold, Italic, H1/H2/H3)
  - Structure controls (`off` / `auto` / `prefer`)
  - Built-in presets (`Minimal Cleanup`, `Article`, `Executive Brief`, `Tutorial`)
  <img width="886" height="661" alt="Screenshot 2026-06-21 at 15-31-18 Formatr" src="https://github.com/user-attachments/assets/d31baadc-c045-471e-a0ff-fdc81b2711f5" />

- YouTube transcript loading by video ID (ToolerBox `youtube-transcript`)

### Web BYOK (`web/`)

- Required user OpenRouter key + optional ToolerBox key
- Opt-in API key persistence (`sessionStorage` or `localStorage`; default is memory-only). Keys never leave the browser except when sent directly to API providers.
- Browser-direct API calls for OpenRouter
- ToolerBox transcript calls via same-origin proxy path (`/api/toolerbox/youtube-transcript`) because ToolerBox does not send permissive browser CORS headers
- Model loading from OpenRouter
- Custom presets (local storage)
- Local history with reload/delete
- Diff toggle with word-change stats
- Copy output + Markdown download
- Browser-side Word (.docx) export with template preset and heading override controls
- [User guide](docs/user-manual.md) (also served at `/user-manual.html` in the web app)

### Legacy Streamlit (`app.py`)

- Server-rendered Streamlit workflow
- Local SQLite-backed history/feedback/presets
- Additional export/theming/template controls built in the original app

## Project Structure

- `web/`: React + Vite BYOK frontend (primary architecture).
- `app.py`: legacy Streamlit app entrypoint.
- `services/`: service layer used by Streamlit mode.
- `prompts/format_prompt.py`: prompt construction and mode guidance shared conceptually across implementations.

## Requirements (Web BYOK)

- Node.js 20+
- OpenRouter API key (user-provided in UI)
- ToolerBox API key (optional; required only for transcript loading)

## Run Web BYOK (Primary)

```bash
cd web
npm install
npm run dev
```

Build for static hosting:

```bash
cd web
npm run build
```

## Run Legacy Streamlit (Optional)

Requirements:

- Python 3.10+

Setup:

1. Create and activate virtual environment.
2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment variables:

   ```bash
   copy .env.example .env
   ```

4. Run:

   ```bash
   streamlit run app.py
   ```

Legacy mode `.env` keys include:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL`
- `OPENROUTER_FAMILY`
- `OPENROUTER_HTTP_REFERER`
- `OPENROUTER_APP_TITLE`
- `TOOLERBOX_API_KEY`

## Docker Deployment (Traefik)

This repo now includes:

- `Dockerfile`
- `docker-compose.yml` (configured for an external Docker network named `traefik`)
- `web.Dockerfile`
- `web.nginx.conf`
- `docker-compose.web.yml` (Web BYOK deployment target)

### 1) Prepare env files on your VPS

```bash
cp .env.example .env
```

Set your app/API keys in `.env`:

- `OPENROUTER_API_KEY`
- `TOOLERBOX_API_KEY` (if using transcript import)

Also add Traefik routing variables in `.env`:

- `FORMATTR_HOST` (example: `formattr.yourdomain.com`)

### 2) Ensure Traefik network exists

```bash
docker network create traefik
```

If your Traefik stack already created this network, you can skip this step.
If your environment uses different network names (for example `traefik-proxy`), update `docker-compose.yml` to match your existing Docker networks.

### 3) Build and run

```bash
docker compose up -d --build
```

### 4) Verify

```bash
docker compose ps
docker compose logs -f formattr
```

The app is exposed to Traefik on internal port `8501` and should be reachable at `https://<FORMATTR_HOST>`.

## Docker Deployment: Web BYOK

Use this path when deploying the React/Vite `web/` app instead of legacy Streamlit.

1) Ensure `.env` includes:

- `FORMATTR_HOST` (example: `formattr.yourdomain.com`)

2) Build + run:

```bash
docker compose -f docker-compose.web.yml up -d --build
```

3) Verify:

```bash
docker compose -f docker-compose.web.yml ps
docker compose -f docker-compose.web.yml logs -f formattr-web
```

Notes:

- `web.nginx.conf` includes a same-origin proxy for `/api/toolerbox/youtube-transcript`.
- That proxy maps `X-Toolerbox-Api-Key` to upstream bearer auth and enables TLS SNI for ToolerBox.
- IPv6 upstream DNS resolution is disabled in nginx resolver for compatibility with VPS networks that lack IPv6 routing.

## Branding Assets

Branding files live in `assets/`:

- `assets/favicon-16.png`: small favicon fallback.
- `assets/favicon-32.png`: app tab icon (used by `st.set_page_config(page_icon=...)`).
- `assets/logo-64.png`: compact logo variant.
- `assets/logo-192.png`: sidebar logo (currently used in the app).
- `assets/logo-512.png`: high-resolution app/logo export.
- `assets/logo-1024.png`: master source for future derivatives.

Recommended workflow:

- Keep `logo-1024.png` as the editable master.
- Generate derivative sizes from the master to maintain consistency.
- Preserve transparent PNG backgrounds and square canvas ratios.

## Migration Status

| Capability | Web BYOK (`web/`) | Legacy Streamlit (`app.py`) |
| --- | --- | --- |
| Direct BYOK requests (no backend proxy) | Implemented | Not applicable |
| OpenRouter model loading | Implemented | Implemented |
| YouTube transcript import (ToolerBox) | Implemented | Implemented |
| Built-in presets | Implemented | Implemented |
| Custom presets | Implemented (local storage) | Implemented (SQLite) |
| History (load/delete) | Implemented (local storage) | Implemented (SQLite) |
| Diff stats and toggle | Implemented | Implemented |
| Markdown download | Implemented | Implemented |
| Word (.docx) export and template controls | Implemented (browser template presets + heading overrides) | Implemented |
| Feedback persistence | Planned | Implemented |

## Notes

- `web/` is the preferred path for anonymous/BYOK use cases.
- In Web BYOK mode, API keys are never stored on the Formatr server. Users can optionally remember keys in their own browser (`sessionStorage` for the current session, or `localStorage` to persist between visits).
- Streamlit data is stored locally in `data/app.db`.
- This project does not include user auth/sync across devices in the current implementation.
