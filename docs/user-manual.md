# Formattr User Guide

Formattr is a browser-based text formatter that turns rough notes, transcripts, and drafts into clean Markdown. The Web BYOK version runs entirely in your browser: you supply your own API keys, and requests go directly to OpenRouter (and optionally ToolerBox for YouTube transcripts). Formattr servers never store your keys or your text.

---

## Quick start

1. Enter your **OpenRouter API key** (required).
2. Click **Load OpenRouter Models** and pick a model.
3. Paste your text into **Input**, or load a YouTube transcript.
4. Adjust formatting options or choose a **Preset**.
5. Click **Format**.
6. Copy, download Markdown, or export Word from **Output**.

---

## API keys

### OpenRouter API key (required)

Used for model listing and formatting. Get a key at [openrouter.ai](https://openrouter.ai/).

- Enter the key in the password field (hidden as you type).
- Click **Load OpenRouter Models** before formatting so the model list is current.
- You pay OpenRouter directly for usage; Formattr does not bill you.

### ToolerBox API key (optional)

Required only if you use **Load Transcript** for YouTube videos. Get a key from [ToolerBox](https://toolerbox.com/dashboard/keys/) if you use that feature.

### Remember API keys

By default, keys are kept in memory only and disappear when you refresh or leave the page.

| Option | Behavior |
| --- | --- |
| **Don't remember (default)** | Keys exist only in memory for the current page session. |
| **This browser session** | Keys saved in `sessionStorage`. Survives refresh; cleared when you close the browser. |
| **On this device** | Keys saved in `localStorage`. Persist between visits on the same browser and device. |

Keys are stored only in your browser. They are never sent to Formattr servers except when forwarded directly to OpenRouter or ToolerBox as part of an API request you initiate.

Use **Clear saved keys** to wipe stored keys, empty the key fields, and reset to “Don't remember.”

---

## Model and prompt settings

### Model

After loading models from OpenRouter, choose which model formats your text. Different models vary in quality, speed, and cost. If you have not loaded models yet, the app falls back to a default model id (`openai/gpt-4o-mini`).

### Text changes

Controls how aggressively the model edits wording:

| Setting | What it does |
| --- | --- |
| **Strict (structure only)** | Preserves original wording as much as possible. Fixes obvious structure issues and basic Markdown organization. |
| **Minimal (spelling & punctuation)** | Fixes spelling, punctuation, and small grammar issues while preserving tone and meaning. |
| **Thorough (grammar & clarity)** | Improves grammar, clarity, and flow more substantially while preserving the original intent. |

The model is instructed not to invent facts, quotes, or citations regardless of level.

### Markdown toggles

These checkboxes tell the model which Markdown elements it **may** use:

- **Allow Bold** — `**bold**` text
- **Allow Italics** — `*italic*` text
- **Allow H1 / H2 / H3** — `#`, `##`, `###` headings

Unchecking an option adds a hard constraint: the model must not use that element.

### Structure controls

Each structure type has three modes:

| Mode | Meaning |
| --- | --- |
| **Off** | Do not use this structure. |
| **Auto** | Use only when it naturally helps readability. |
| **Prefer** | Prefer using when it improves readability. |

Structure options:

| Control | Purpose |
| --- | --- |
| **Lists** | Bulleted or numbered lists for parallel items. |
| **Pull quotes** | Blockquotes (`>`) for key phrases already in the source. |
| **Numbered steps** | Ordered steps for procedural or sequential content. |
| **Section summaries** | Short recap bullets for longer sections. |
| **Tables** | Markdown tables for comparisons or structured data. |
| **Callouts** | Note/Warning-style emphasis blocks when content warrants it. |

The model is also told not to over-format or add decorative structure that hurts readability.

---

## Presets

Presets bundle **Text changes** and all formatting toggles into one-click configurations.

### Built-in presets

| Preset | Best for | Summary |
| --- | --- | --- |
| **Minimal Cleanup** | Light touch-ups | Minimal text changes; basic structure; no pull quotes, numbered steps, summaries, tables, or callouts. |
| **Article** | Long-form writing | Thorough editing; prefers lists and pull quotes; auto tables and summaries. |
| **Executive Brief** | Business summaries | Minimal text changes; no H1 or italics; prefers lists, summaries, tables, and callouts. |
| **Tutorial** | How-to content | Thorough editing; prefers lists, numbered steps, tables, and callouts. |

Selecting a preset updates your settings immediately. Choose **Custom** to adjust options manually without a preset.

### Custom presets

1. Set **Text changes**, toggles, and structure options the way you want.
2. Enter a name in **Preset name** (e.g. “Product Brief”).
3. Click **Save Preset**.

Saved presets appear in the **Preset** dropdown as `Custom: <name>`. They persist in your browser's local storage on this device.

To delete a custom preset, select it in the dropdown and click **Delete Preset**.

### Show Diff View

When enabled, the Output section shows side-by-side **Original** and **Formatted** text areas below the main output field, making it easier to compare changes.

---

## Input

### Paste text

Paste or type source content into the large text area. Formatting requires non-empty input, a selected model, and a valid OpenRouter key.

### YouTube transcript

1. Copy the 11-character video ID from a YouTube URL (`youtube.com/watch?v=VIDEO_ID`).
2. Paste it into the video ID field.
3. Click **Load Transcript**.

Requires a ToolerBox API key. The transcript replaces the current input text.

### Format and Reset

- **Format** — Sends your text and settings to the selected OpenRouter model. The result appears in Output and is added to History.
- **Reset** — Clears input, output, video ID, and status messages.

---

## Output

After formatting, use the output area and action buttons:

| Action | Description |
| --- | --- |
| **Download Markdown** | Saves `formattr-output.md`. |
| **Download Word (.docx)** | Converts formatted Markdown to a Word document in your browser. |
| **Copy Output** | Copies formatted text to the clipboard. |

### Word count stats

The line next to the buttons shows word counts for before/after text, the delta, and the percentage change. Useful for spotting large expansions or cuts.

### Word export options

**Word template preset** sets default fonts and heading sizes:

| Preset | Body | H1 | H2 | H3 |
| --- | --- | --- | --- | --- |
| **Default** | Calibri | 18 pt | 15 pt | 13 pt |
| **Professional** | Arial | 20 pt | 16 pt | 14 pt |
| **Compact** | Calibri | 16 pt | 14 pt | 12 pt |

Enable **Use custom heading styles** to override H1/H2/H3 font names and point sizes. Custom values apply on top of the selected template preset.

The output text area is editable. You can tweak the Markdown before copying or exporting.

---

## History

Each successful format creates a history entry titled from the first heading or first line of the result.

- **Load** — Restores that entry's input and formatted output into the main areas.
- **Delete** — Removes the entry from history.

History is stored in your browser's local storage on this device. It is not synced across browsers or devices.

---

## What is stored locally

Formattr Web BYOK saves some preferences in your browser:

| Data | Storage | Notes |
| --- | --- | --- |
| Formatting settings | `localStorage` | Model choice, text level, toggles, export options, diff toggle, key remember preference |
| Custom presets | `localStorage` | Your saved preset configurations |
| History | `localStorage` | Past format runs on this device |
| API keys (optional) | `sessionStorage` or `localStorage` | Only if you opt in |

No account login is required. Nothing is uploaded to Formattr servers for storage or sync.

---

## Privacy and BYOK

- **BYOK** (Bring Your Own Key) means you provide and pay for your own API access.
- Keys and text are sent from your browser directly to OpenRouter when you click Format.
- ToolerBox transcript requests go through a same-origin proxy on the Formattr host so your browser can reach ToolerBox; the proxy forwards your key to ToolerBox but does not store it.
- Formattr does not collect cookies for authentication or track your content.

If you use a shared computer, avoid “On this device” key storage and clear saved keys when finished.

---

## Tips and troubleshooting

### “OpenRouter API key is required”
Enter a valid key before loading models or formatting.

### Model list is empty or shows a warning
Click **Load OpenRouter Models** again. Check that your key is valid and has access to OpenRouter's model API.

### Transcript loading fails
Confirm your ToolerBox key is set and the video ID is exactly 11 characters. Some videos may not have transcripts available.

### Formatting is too heavy or too light
Try a different **Text changes** level, switch presets, or turn structure controls from **Prefer** to **Auto** or **Off**.

### Word export looks wrong
Check heading levels in your Markdown. Enable custom heading styles if the template defaults do not match your needs.

### Lost settings or history
Local storage is per-browser and per-device. Clearing site data, private browsing, or a different browser will not show saved presets or history.

---

## Typical workflows

### Clean up meeting notes
1. Paste notes into Input.
2. Select **Minimal Cleanup** preset.
3. Format → Copy Output or Download Markdown.

### Turn a YouTube talk into an article
1. Load transcript from video ID.
2. Select **Article** preset.
3. Format → edit output if needed → Download Word with **Professional** template.

### Reusable team format
1. Configure toggles and structure for your team's style guide.
2. Save as a custom preset (e.g. “Team Blog”).
3. Reuse the preset for future documents on this browser.

---

*Formattr Web BYOK — format text with your keys, your models, your browser.*
