# Streamlit Formatter Clone

A Python Streamlit app inspired by the referenced Chrome extension side panel, built with OpenRouter model routing for text formatting and local SQLite persistence.

## Features

- Paste text and format it with streaming output.
- Load a YouTube transcript into Input by video ID (via ToolerBox API).
- OpenRouter-powered connection panel:
  - Provider-family dropdown (OpenAI, Google, Anthropic, etc.)
  - `All providers` option
  - Live model dropdown sourced from `https://openrouter.ai/api/v1/models`
  - Optional `Free models only` toggle
- Text change levels:
  - `Strict` (structure only)
  - `Minimal` (spelling and punctuation)
  - `Thorough` (grammar and clarity)
- Markdown option toggles:
  - Bold
  - Italic
  - H1
  - H2
  - H3
- Advanced structure controls (`off` / `auto` / `prefer`):
  - Bullets/lists
  - Pull quotes
  - Numbered steps
  - Section summaries
  - Tables
  - Callouts
- One-click presets:
  - Minimal Cleanup
  - Article
  - Executive Brief
  - Tutorial
- Custom preset storage:
  - Save current settings as a named preset
  - Load saved preset from Preset dropdown
  - Delete saved custom preset
- Output controls:
  - Font selector
  - Theme selector
  - Diff view toggle
  - LLM-generated document title
  - Editable title with save-to-history
  - Copy output
  - Export to Markdown
  - Export to Word (.docx)
  - Optional "Use project template" toggle (`templates/base_template.docx`)
  - Auto-discovery dropdown for templates in `templates/` with manual-path fallback
  - Built-in template style test (`Heading 1/2/3` + paragraph style listing)
  - Optional H1/H2/H3 font-size overrides for Word export
  - Saved heading override settings across sessions
  - Reset session
  - Thumbs up/down rating
- Last-used UI formatting/preferences are remembered across sessions
- Local history:
  - Grouped by Today / Yesterday / Last 7 days / Older
  - Reload previous document
  - Delete history item
- Local feedback submission.

## Project Structure

- `app.py`: Streamlit UI and interaction flow.
- `services/formatter.py`: streaming formatter service (OpenRouter/OpenAI-compatible client).
- `services/history.py`: SQLite history CRUD.
- `services/feedback.py`: SQLite feedback storage.
- `services/presets.py`: SQLite custom preset storage.
- `services/export_settings.py`: persisted Word export heading settings.
- `services/ui_settings.py`: persisted UI/formatting preference settings.
- `services/diff_utils.py`: diff and change stats.
- `prompts/format_prompt.py`: formatting prompt construction and mode guidance.

## Requirements

- Python 3.10+
- OpenRouter API key

## Setup

1. Create a virtual environment:

```bash
python -m venv .venv
```

2. Activate it:

```bash
# Windows PowerShell
.venv\Scripts\Activate.ps1
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Configure environment variables:

```bash
copy .env.example .env
```

Then edit `.env` and set:

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (optional, default `openai/gpt-4o-mini`)
- `OPENROUTER_FAMILY` (optional, default `openai`)
- `OPENROUTER_HTTP_REFERER` (optional, default `http://localhost`)
- `OPENROUTER_APP_TITLE` (optional, default `Formatr`)
- `TOOLERBOX_API_KEY` (required only for YouTube transcript loading)

## YouTube Transcript Import

- Enter an 11-character YouTube video ID in the `YouTube video ID` field near `Input`.
- Click `Load Transcript` to fetch transcript text using ToolerBox `youtube-transcript`.
- The loaded transcript replaces the current Input text.

## Run

```bash
streamlit run app.py
```

## Docker Deployment (Traefik)

This repo now includes:

- `Dockerfile`
- `docker-compose.yml` (configured for an external Docker network named `traefik`)

### 1) Prepare env files on your VPS

```bash
cp .env.example .env
```

Set your app/API keys in `.env`:

- `OPENROUTER_API_KEY`
- `TOOLERBOX_API_KEY` (if using transcript import)

Also add Traefik routing variables in `.env`:

- `FORMATTR_HOST` (example: `formattr.yourdomain.com`)
- `TRAEFIK_CERT_RESOLVER` (example: `letsencrypt`)

### 2) Ensure Traefik network exists

```bash
docker network create traefik
```

If your Traefik stack already created this network, you can skip this step.

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

## Notes

- Data is stored locally in `data/app.db`.
- This app does not include cloud auth or sync in this phase.
- If you do not provide keys in `.env`, you can still enter your OpenRouter API key in the Streamlit sidebar at runtime.
