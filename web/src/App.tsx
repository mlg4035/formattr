import { useEffect, useMemo, useState } from 'react'
import './App.css'

type TextChangeLevel = 'none' | 'minimal' | 'thorough'
type StructureMode = 'off' | 'auto' | 'prefer'

type FormatOptions = {
  enableBold: boolean
  enableItalics: boolean
  enableH1: boolean
  enableH2: boolean
  enableH3: boolean
  bulletsMode: StructureMode
  pullQuotesMode: StructureMode
  numberedStepsMode: StructureMode
  sectionSummariesMode: StructureMode
  tablesMode: StructureMode
  calloutsMode: StructureMode
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const TOOLERBOX_TRANSCRIPT_URL = 'https://toolerbox.com/api/v1/youtube-transcript'
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const MAX_HTML_UNESCAPE_PASSES = 5
const SETTINGS_STORAGE_KEY = 'formattr.byok.settings.v1'

const MODE_GUIDANCE: Record<string, string> = {
  strict:
    'Preserve the original wording as much as possible. Only fix obvious structure issues and basic markdown organization.',
  balanced:
    'Fix spelling, punctuation, and small grammar issues while preserving tone and meaning.',
  aggressive:
    'Improve grammar, clarity, and flow more substantially while preserving the original intent.',
}

const MODE_MAP: Record<TextChangeLevel, 'strict' | 'balanced' | 'aggressive'> = {
  none: 'strict',
  minimal: 'balanced',
  thorough: 'aggressive',
}

const DEFAULT_OPTIONS: FormatOptions = {
  enableBold: true,
  enableItalics: true,
  enableH1: true,
  enableH2: true,
  enableH3: true,
  bulletsMode: 'auto',
  pullQuotesMode: 'auto',
  numberedStepsMode: 'auto',
  sectionSummariesMode: 'auto',
  tablesMode: 'off',
  calloutsMode: 'off',
}

function markdownConstraints(options: FormatOptions): string {
  const rules: string[] = []
  if (!options.enableBold) rules.push('Do not use bold markdown (`**text**`).')
  if (!options.enableItalics) rules.push('Do not use italic markdown (`*text*` or `_text_`).')
  if (!options.enableH1) rules.push('Do not use H1 headings (`# Heading`).')
  if (!options.enableH2) rules.push('Do not use H2 headings (`## Heading`).')
  if (!options.enableH3) rules.push('Do not use H3 headings (`### Heading`).')
  return rules.length === 0 ? 'All markdown styles are allowed.' : rules.join(' ')
}

function styleRule(name: string, mode: StructureMode, guidance: string): string {
  if (mode === 'off') return `${name}: do not use.`
  if (mode === 'prefer') return `${name}: prefer using when it improves readability. ${guidance}`
  return `${name}: use only when naturally helpful. ${guidance}`
}

function structureStyleInstructions(options: FormatOptions): string {
  return [
    styleRule(
      'Bulleted or numbered lists',
      options.bulletsMode,
      'Use only for parallel items; keep list length concise.',
    ),
    styleRule(
      'Pull quotes (markdown blockquotes)',
      options.pullQuotesMode,
      'Use at most 1-2 and only for key phrases already present in the source text.',
    ),
    styleRule(
      'Numbered steps',
      options.numberedStepsMode,
      'Use for procedural or sequential content only.',
    ),
    styleRule(
      'Section summaries',
      options.sectionSummariesMode,
      'Use short recap bullets only for longer sections.',
    ),
    styleRule(
      'Markdown tables',
      options.tablesMode,
      'Use only for structured comparisons or data-like values.',
    ),
    styleRule(
      'Callouts (e.g., Note/Warning)',
      options.calloutsMode,
      'Use sparingly and only when the content clearly warrants emphasis.',
    ),
    'Do not over-format. Avoid decorative structure that hurts readability.',
    'Never invent quotes, facts, or citations.',
  ].join(' ')
}

function buildMessages(text: string, level: TextChangeLevel, options: FormatOptions) {
  const selectedMode = MODE_MAP[level]
  const systemContent =
    'You are a professional editor that returns markdown only. ' +
    'Keep facts unchanged and never invent new information. ' +
    `Editing mode: ${selectedMode}. ${MODE_GUIDANCE[selectedMode]} ` +
    `Markdown constraints: ${markdownConstraints(options)} ` +
    `Structure and style rules: ${structureStyleInstructions(options)}`

  const userContent =
    'Format the following text according to the mode and markdown rules. ' +
    'Return only the final formatted markdown.\n\n' +
    text

  return [
    { role: 'system', content: systemContent },
    { role: 'user', content: userContent },
  ]
}

function decodeHtmlEntities(text: string): string {
  const parser = document.createElement('textarea')
  let decoded = text
  for (let i = 0; i < MAX_HTML_UNESCAPE_PASSES; i += 1) {
    parser.innerHTML = decoded
    const next = parser.value
    if (next === decoded) break
    decoded = next
  }
  return decoded
}

function parseErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  const error = obj.error
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    const nestedMessage = (error as Record<string, unknown>).message
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage
  }
  const message = obj.message
  if (typeof message === 'string' && message.trim()) return message
  return null
}

function loadSavedSettings(): {
  textChangeLevel: TextChangeLevel
  selectedModel: string
  formatOptions: FormatOptions
} {
  const fallback = {
    textChangeLevel: 'minimal' as TextChangeLevel,
    selectedModel: 'openai/gpt-4o-mini',
    formatOptions: DEFAULT_OPTIONS,
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as {
      textChangeLevel?: TextChangeLevel
      selectedModel?: string
      formatOptions?: FormatOptions
    }
    return {
      textChangeLevel: parsed.textChangeLevel ?? fallback.textChangeLevel,
      selectedModel: parsed.selectedModel ?? fallback.selectedModel,
      formatOptions: { ...DEFAULT_OPTIONS, ...(parsed.formatOptions ?? {}) },
    }
  } catch {
    return fallback
  }
}

function App() {
  const [savedSettings] = useState(loadSavedSettings)
  const [openRouterApiKey, setOpenRouterApiKey] = useState('')
  const [toolerboxApiKey, setToolerboxApiKey] = useState('')
  const [inputText, setInputText] = useState('')
  const [formattedText, setFormattedText] = useState('')
  const [youtubeVideoId, setYoutubeVideoId] = useState('')
  const [textChangeLevel, setTextChangeLevel] = useState<TextChangeLevel>(savedSettings.textChangeLevel)
  const [modelIds, setModelIds] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState(savedSettings.selectedModel)
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(savedSettings.formatOptions)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [isFormatting, setIsFormatting] = useState(false)
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        textChangeLevel,
        selectedModel,
        formatOptions,
      }),
    )
  }, [formatOptions, selectedModel, textChangeLevel])

  const canFormat = useMemo(
    () => openRouterApiKey.trim() && inputText.trim() && selectedModel.trim(),
    [inputText, openRouterApiKey, selectedModel],
  )

  async function fetchModels() {
    setErrorMessage('')
    setSuccessMessage('')
    const key = openRouterApiKey.trim()
    if (!key) {
      setErrorMessage('OpenRouter API key is required to load models.')
      return
    }
    setIsLoadingModels(true)
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
      })
      const payload = (await response.json()) as { data?: Array<{ id?: string }> }
      if (!response.ok) {
        throw new Error(parseErrorMessage(payload) ?? `OpenRouter models request failed (${response.status})`)
      }
      const ids = (payload.data ?? [])
        .map((entry) => entry.id ?? '')
        .filter((id): id is string => Boolean(id))
        .sort((a, b) => a.localeCompare(b))
      if (ids.length === 0) {
        throw new Error('No models were returned for this key.')
      }
      setModelIds(ids)
      if (!ids.includes(selectedModel)) {
        setSelectedModel(ids[0])
      }
      setSuccessMessage(`Loaded ${ids.length} models.`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load models.')
    } finally {
      setIsLoadingModels(false)
    }
  }

  async function formatText() {
    setErrorMessage('')
    setSuccessMessage('')
    if (!openRouterApiKey.trim()) {
      setErrorMessage('OpenRouter API key is required.')
      return
    }
    if (!inputText.trim()) {
      setErrorMessage('Enter some text to format.')
      return
    }
    setIsFormatting(true)
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterApiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Formatr BYOK',
        },
        body: JSON.stringify({
          model: selectedModel,
          temperature: 0.2,
          stream: false,
          messages: buildMessages(inputText, textChangeLevel, formatOptions),
        }),
      })
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      if (!response.ok) {
        throw new Error(parseErrorMessage(payload) ?? `Formatting request failed (${response.status})`)
      }
      const content = payload.choices?.[0]?.message?.content?.trim()
      if (!content) {
        throw new Error('OpenRouter returned an empty response.')
      }
      setFormattedText(content)
      setSuccessMessage('Formatting complete.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Formatting failed.')
    } finally {
      setIsFormatting(false)
    }
  }

  async function loadTranscript() {
    setErrorMessage('')
    setSuccessMessage('')
    const normalizedVideoId = youtubeVideoId.trim()
    if (!YOUTUBE_ID_PATTERN.test(normalizedVideoId)) {
      setErrorMessage('Enter a valid 11-character YouTube video ID.')
      return
    }
    const key = toolerboxApiKey.trim()
    if (!key) {
      setErrorMessage('ToolerBox API key is optional overall, but required for transcript loading.')
      return
    }
    setIsLoadingTranscript(true)
    try {
      const response = await fetch(TOOLERBOX_TRANSCRIPT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${normalizedVideoId}`,
        }),
      })
      const payload = (await response.json()) as { text?: string }
      if (!response.ok) {
        throw new Error(parseErrorMessage(payload) ?? `Transcript request failed (${response.status})`)
      }
      if (!payload.text?.trim()) {
        throw new Error('Transcript response did not include text.')
      }
      setInputText(decodeHtmlEntities(payload.text).trim())
      setSuccessMessage('Transcript loaded into Input.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transcript request failed.')
    } finally {
      setIsLoadingTranscript(false)
    }
  }

  function updateStructureOption(key: keyof FormatOptions, value: string) {
    setFormatOptions((current) => ({
      ...current,
      [key]: value as StructureMode,
    }))
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <h1>Formatr BYOK</h1>
        <p>Client-side BYOK: keys stay in your browser session and are sent directly to API providers.</p>
      </header>

      <section className="card">
        <h2>API Keys</h2>
        <div className="grid two-col">
          <label>
            OpenRouter API key (required)
            <input
              type="password"
              value={openRouterApiKey}
              onChange={(event) => setOpenRouterApiKey(event.target.value)}
              placeholder="sk-or-v1-..."
              autoComplete="off"
            />
          </label>
          <label>
            ToolerBox API key (optional)
            <input
              type="password"
              value={toolerboxApiKey}
              onChange={(event) => setToolerboxApiKey(event.target.value)}
              placeholder="mcpsk_..."
              autoComplete="off"
            />
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Model & Prompt Settings</h2>
        <div className="row">
          <button type="button" onClick={fetchModels} disabled={isLoadingModels}>
            {isLoadingModels ? 'Loading models...' : 'Load OpenRouter Models'}
          </button>
          <label className="inline-field">
            Model
            <select value={selectedModel} onChange={(event) => setSelectedModel(event.target.value)}>
              {modelIds.length === 0 ? <option value={selectedModel}>{selectedModel}</option> : null}
              {modelIds.map((modelId) => (
                <option key={modelId} value={modelId}>
                  {modelId}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Text changes
            <select
              value={textChangeLevel}
              onChange={(event) => setTextChangeLevel(event.target.value as TextChangeLevel)}
            >
              <option value="none">Strict (structure only)</option>
              <option value="minimal">Minimal (spelling & punctuation)</option>
              <option value="thorough">Thorough (grammar & clarity)</option>
            </select>
          </label>
        </div>

        <div className="grid three-col">
          <label className="toggle">
            <input
              type="checkbox"
              checked={formatOptions.enableBold}
              onChange={(event) =>
                setFormatOptions((current) => ({ ...current, enableBold: event.target.checked }))
              }
            />
            Allow Bold
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={formatOptions.enableItalics}
              onChange={(event) =>
                setFormatOptions((current) => ({ ...current, enableItalics: event.target.checked }))
              }
            />
            Allow Italics
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={formatOptions.enableH1}
              onChange={(event) => setFormatOptions((current) => ({ ...current, enableH1: event.target.checked }))}
            />
            Allow H1
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={formatOptions.enableH2}
              onChange={(event) => setFormatOptions((current) => ({ ...current, enableH2: event.target.checked }))}
            />
            Allow H2
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={formatOptions.enableH3}
              onChange={(event) => setFormatOptions((current) => ({ ...current, enableH3: event.target.checked }))}
            />
            Allow H3
          </label>
        </div>

        <div className="grid three-col">
          <label>
            Lists
            <select
              value={formatOptions.bulletsMode}
              onChange={(event) => updateStructureOption('bulletsMode', event.target.value)}
            >
              <option value="off">Off</option>
              <option value="auto">Auto</option>
              <option value="prefer">Prefer</option>
            </select>
          </label>
          <label>
            Pull quotes
            <select
              value={formatOptions.pullQuotesMode}
              onChange={(event) => updateStructureOption('pullQuotesMode', event.target.value)}
            >
              <option value="off">Off</option>
              <option value="auto">Auto</option>
              <option value="prefer">Prefer</option>
            </select>
          </label>
          <label>
            Numbered steps
            <select
              value={formatOptions.numberedStepsMode}
              onChange={(event) => updateStructureOption('numberedStepsMode', event.target.value)}
            >
              <option value="off">Off</option>
              <option value="auto">Auto</option>
              <option value="prefer">Prefer</option>
            </select>
          </label>
          <label>
            Section summaries
            <select
              value={formatOptions.sectionSummariesMode}
              onChange={(event) => updateStructureOption('sectionSummariesMode', event.target.value)}
            >
              <option value="off">Off</option>
              <option value="auto">Auto</option>
              <option value="prefer">Prefer</option>
            </select>
          </label>
          <label>
            Tables
            <select
              value={formatOptions.tablesMode}
              onChange={(event) => updateStructureOption('tablesMode', event.target.value)}
            >
              <option value="off">Off</option>
              <option value="auto">Auto</option>
              <option value="prefer">Prefer</option>
            </select>
          </label>
          <label>
            Callouts
            <select
              value={formatOptions.calloutsMode}
              onChange={(event) => updateStructureOption('calloutsMode', event.target.value)}
            >
              <option value="off">Off</option>
              <option value="auto">Auto</option>
              <option value="prefer">Prefer</option>
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Input</h2>
        <div className="row">
          <input
            type="text"
            value={youtubeVideoId}
            onChange={(event) => setYoutubeVideoId(event.target.value)}
            placeholder="YouTube video ID (11 chars)"
          />
          <button type="button" onClick={loadTranscript} disabled={isLoadingTranscript}>
            {isLoadingTranscript ? 'Loading transcript...' : 'Load Transcript'}
          </button>
        </div>
        <textarea
          rows={12}
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          placeholder="Paste your text here..."
        />
        <div className="row">
          <button type="button" onClick={formatText} disabled={!canFormat || isFormatting}>
            {isFormatting ? 'Formatting...' : 'Format'}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setInputText('')
              setFormattedText('')
              setYoutubeVideoId('')
              setErrorMessage('')
              setSuccessMessage('')
            }}
          >
            Reset
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Output</h2>
        <textarea
          rows={14}
          value={formattedText}
          onChange={(event) => setFormattedText(event.target.value)}
          placeholder="Formatted markdown will appear here..."
        />
      </section>

      {errorMessage ? <p className="status error">{errorMessage}</p> : null}
      {successMessage ? <p className="status success">{successMessage}</p> : null}
    </main>
  )
}

export default App
