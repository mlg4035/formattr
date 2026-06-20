import { useEffect, useMemo, useState } from 'react'
import { buildDocxBlob, type TemplatePreset } from './docxExport'
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
const TOOLERBOX_TRANSCRIPT_PROXY_PATH = '/api/toolerbox/youtube-transcript'
const TOOLERBOX_TRANSCRIPT_URL =
  import.meta.env.VITE_TOOLERBOX_TRANSCRIPT_URL?.trim() || TOOLERBOX_TRANSCRIPT_PROXY_PATH
const WEB_LOGO_PATH = '/favicon.svg'
const WEB_FAVICON_PATH = '/favicon.svg'
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const MAX_HTML_UNESCAPE_PASSES = 5
const SETTINGS_STORAGE_KEY = 'formattr.byok.settings.v1'
const PRESETS_STORAGE_KEY = 'formattr.byok.presets.v1'
const HISTORY_STORAGE_KEY = 'formattr.byok.history.v1'
const KEYS_STORAGE_KEY = 'formattr.byok.keys.v1'

type RememberKeysScope = 'none' | 'session' | 'local'

type PersistedApiKeys = {
  openRouterApiKey: string
  toolerboxApiKey: string
}

type PresetSettings = {
  textChangeLevel: TextChangeLevel
  formatOptions: FormatOptions
}

type HistoryEntry = {
  id: string
  title: string
  inputText: string
  formattedText: string
  createdAt: string
}

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

const BUILTIN_PRESETS: Record<string, PresetSettings> = {
  minimal_cleanup: {
    textChangeLevel: 'minimal',
    formatOptions: {
      enableBold: true,
      enableItalics: true,
      enableH1: true,
      enableH2: true,
      enableH3: true,
      bulletsMode: 'auto',
      pullQuotesMode: 'off',
      numberedStepsMode: 'off',
      sectionSummariesMode: 'off',
      tablesMode: 'off',
      calloutsMode: 'off',
    },
  },
  article: {
    textChangeLevel: 'thorough',
    formatOptions: {
      enableBold: true,
      enableItalics: true,
      enableH1: true,
      enableH2: true,
      enableH3: true,
      bulletsMode: 'prefer',
      pullQuotesMode: 'prefer',
      numberedStepsMode: 'auto',
      sectionSummariesMode: 'auto',
      tablesMode: 'auto',
      calloutsMode: 'off',
    },
  },
  executive_brief: {
    textChangeLevel: 'minimal',
    formatOptions: {
      enableBold: true,
      enableItalics: false,
      enableH1: false,
      enableH2: true,
      enableH3: true,
      bulletsMode: 'prefer',
      pullQuotesMode: 'off',
      numberedStepsMode: 'auto',
      sectionSummariesMode: 'prefer',
      tablesMode: 'auto',
      calloutsMode: 'prefer',
    },
  },
  tutorial: {
    textChangeLevel: 'thorough',
    formatOptions: {
      enableBold: true,
      enableItalics: true,
      enableH1: true,
      enableH2: true,
      enableH3: true,
      bulletsMode: 'prefer',
      pullQuotesMode: 'off',
      numberedStepsMode: 'prefer',
      sectionSummariesMode: 'auto',
      tablesMode: 'auto',
      calloutsMode: 'prefer',
    },
  },
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

function loadPersistedApiKeys(scope: RememberKeysScope): PersistedApiKeys {
  const empty = { openRouterApiKey: '', toolerboxApiKey: '' }
  if (scope === 'none') return empty

  const storage = scope === 'session' ? sessionStorage : localStorage
  try {
    const raw = storage.getItem(KEYS_STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<PersistedApiKeys>
    return {
      openRouterApiKey: typeof parsed.openRouterApiKey === 'string' ? parsed.openRouterApiKey : '',
      toolerboxApiKey: typeof parsed.toolerboxApiKey === 'string' ? parsed.toolerboxApiKey : '',
    }
  } catch {
    return empty
  }
}

function clearSavedApiKeys() {
  sessionStorage.removeItem(KEYS_STORAGE_KEY)
  localStorage.removeItem(KEYS_STORAGE_KEY)
}

function loadSavedSettings(): {
  textChangeLevel: TextChangeLevel
  selectedModel: string
  formatOptions: FormatOptions
  showDiff: boolean
  rememberApiKeysScope: RememberKeysScope
  exportTemplatePreset: TemplatePreset
  exportUseCustomHeadingStyles: boolean
  exportH1Font: string
  exportH1Size: number
  exportH2Font: string
  exportH2Size: number
  exportH3Font: string
  exportH3Size: number
} {
  const fallback = {
    textChangeLevel: 'minimal' as TextChangeLevel,
    selectedModel: 'openai/gpt-4o-mini',
    formatOptions: DEFAULT_OPTIONS,
    showDiff: false,
    rememberApiKeysScope: 'none' as RememberKeysScope,
    exportTemplatePreset: 'default' as TemplatePreset,
    exportUseCustomHeadingStyles: false,
    exportH1Font: '',
    exportH1Size: 16,
    exportH2Font: '',
    exportH2Size: 14,
    exportH3Font: '',
    exportH3Size: 12,
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw) as {
      textChangeLevel?: TextChangeLevel
      selectedModel?: string
      formatOptions?: FormatOptions
      showDiff?: boolean
      rememberApiKeysScope?: RememberKeysScope
      exportTemplatePreset?: TemplatePreset
      exportUseCustomHeadingStyles?: boolean
      exportH1Font?: string
      exportH1Size?: number
      exportH2Font?: string
      exportH2Size?: number
      exportH3Font?: string
      exportH3Size?: number
    }
    return {
      textChangeLevel: parsed.textChangeLevel ?? fallback.textChangeLevel,
      selectedModel: parsed.selectedModel ?? fallback.selectedModel,
      formatOptions: { ...DEFAULT_OPTIONS, ...(parsed.formatOptions ?? {}) },
      showDiff: parsed.showDiff ?? fallback.showDiff,
      rememberApiKeysScope:
        parsed.rememberApiKeysScope === 'session' || parsed.rememberApiKeysScope === 'local'
          ? parsed.rememberApiKeysScope
          : fallback.rememberApiKeysScope,
      exportTemplatePreset: parsed.exportTemplatePreset ?? fallback.exportTemplatePreset,
      exportUseCustomHeadingStyles:
        parsed.exportUseCustomHeadingStyles ?? fallback.exportUseCustomHeadingStyles,
      exportH1Font: parsed.exportH1Font ?? fallback.exportH1Font,
      exportH1Size: parsed.exportH1Size ?? fallback.exportH1Size,
      exportH2Font: parsed.exportH2Font ?? fallback.exportH2Font,
      exportH2Size: parsed.exportH2Size ?? fallback.exportH2Size,
      exportH3Font: parsed.exportH3Font ?? fallback.exportH3Font,
      exportH3Size: parsed.exportH3Size ?? fallback.exportH3Size,
    }
  } catch {
    return fallback
  }
}

function loadCustomPresets(): Record<string, PresetSettings> {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, PresetSettings>
  } catch {
    return {}
  }
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as HistoryEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

function computeDiffStats(beforeText: string, afterText: string) {
  const before = wordCount(beforeText)
  const after = wordCount(afterText)
  const delta = after - before
  const percent = before ? Math.round((Math.abs(delta) / before) * 100) : after > 0 ? 100 : 0
  return { before, after, delta, percent }
}

function suggestTitle(markdown: string): string {
  const firstHeading = markdown
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('#'))
  if (firstHeading) return firstHeading.replace(/^#+\s*/, '').slice(0, 80) || 'Formatted Result'
  const firstLine = markdown.split('\n').map((line) => line.trim()).find(Boolean) ?? ''
  return firstLine.slice(0, 80) || 'Formatted Result'
}

function App() {
  const [savedSettings] = useState(loadSavedSettings)
  const [rememberApiKeysScope, setRememberApiKeysScope] = useState<RememberKeysScope>(
    savedSettings.rememberApiKeysScope,
  )
  const [openRouterApiKey, setOpenRouterApiKey] = useState(
    () => loadPersistedApiKeys(savedSettings.rememberApiKeysScope).openRouterApiKey,
  )
  const [toolerboxApiKey, setToolerboxApiKey] = useState(
    () => loadPersistedApiKeys(savedSettings.rememberApiKeysScope).toolerboxApiKey,
  )
  const [inputText, setInputText] = useState('')
  const [formattedText, setFormattedText] = useState('')
  const [youtubeVideoId, setYoutubeVideoId] = useState('')
  const [textChangeLevel, setTextChangeLevel] = useState<TextChangeLevel>(savedSettings.textChangeLevel)
  const [modelIds, setModelIds] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState(savedSettings.selectedModel)
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(savedSettings.formatOptions)
  const [showDiff, setShowDiff] = useState(savedSettings.showDiff)
  const [exportTemplatePreset, setExportTemplatePreset] = useState<TemplatePreset>(
    savedSettings.exportTemplatePreset,
  )
  const [exportUseCustomHeadingStyles, setExportUseCustomHeadingStyles] = useState(
    savedSettings.exportUseCustomHeadingStyles,
  )
  const [exportH1Font, setExportH1Font] = useState(savedSettings.exportH1Font)
  const [exportH1Size, setExportH1Size] = useState(savedSettings.exportH1Size)
  const [exportH2Font, setExportH2Font] = useState(savedSettings.exportH2Font)
  const [exportH2Size, setExportH2Size] = useState(savedSettings.exportH2Size)
  const [exportH3Font, setExportH3Font] = useState(savedSettings.exportH3Font)
  const [exportH3Size, setExportH3Size] = useState(savedSettings.exportH3Size)
  const [selectedPreset, setSelectedPreset] = useState('custom')
  const [customPresetName, setCustomPresetName] = useState('')
  const [customPresets, setCustomPresets] = useState<Record<string, PresetSettings>>(loadCustomPresets)
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>(loadHistory)
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
        showDiff,
        exportTemplatePreset,
        exportUseCustomHeadingStyles,
        exportH1Font,
        exportH1Size,
        exportH2Font,
        exportH2Size,
        exportH3Font,
        exportH3Size,
        rememberApiKeysScope,
      }),
    )
  }, [
    exportH1Font,
    exportH1Size,
    exportH2Font,
    exportH2Size,
    exportH3Font,
    exportH3Size,
    exportTemplatePreset,
    exportUseCustomHeadingStyles,
    formatOptions,
    rememberApiKeysScope,
    selectedModel,
    showDiff,
    textChangeLevel,
  ])

  useEffect(() => {
    if (rememberApiKeysScope === 'none') {
      clearSavedApiKeys()
      return
    }

    const storage = rememberApiKeysScope === 'session' ? sessionStorage : localStorage
    const otherStorage = rememberApiKeysScope === 'session' ? localStorage : sessionStorage
    otherStorage.removeItem(KEYS_STORAGE_KEY)
    storage.setItem(
      KEYS_STORAGE_KEY,
      JSON.stringify({
        openRouterApiKey,
        toolerboxApiKey,
      }),
    )
  }, [openRouterApiKey, rememberApiKeysScope, toolerboxApiKey])

  useEffect(() => {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customPresets))
  }, [customPresets])

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyItems))
  }, [historyItems])

  useEffect(() => {
    const existing = document.querySelector("link[rel='icon']") as HTMLLinkElement | null
    if (existing) {
      existing.href = WEB_FAVICON_PATH
      return
    }
    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = WEB_FAVICON_PATH
    document.head.appendChild(link)
    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link)
      }
    }
  }, [])

  const canFormat = useMemo(
    () => openRouterApiKey.trim() && inputText.trim() && selectedModel.trim(),
    [inputText, openRouterApiKey, selectedModel],
  )

  const hasSavedApiKeys = rememberApiKeysScope !== 'none' || openRouterApiKey.trim() || toolerboxApiKey.trim()

  function handleClearSavedKeys() {
    clearSavedApiKeys()
    setOpenRouterApiKey('')
    setToolerboxApiKey('')
    setRememberApiKeysScope('none')
    setSuccessMessage('Saved API keys cleared from this browser.')
    setErrorMessage('')
  }

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
          'X-Title': 'Formattr BYOK',
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
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        title: suggestTitle(content),
        inputText: inputText,
        formattedText: content,
        createdAt: new Date().toISOString(),
      }
      setHistoryItems((current) => [entry, ...current].slice(0, 50))
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
          'Content-Type': 'application/json',
          'X-Toolerbox-Api-Key': key,
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
      if (error instanceof TypeError) {
        setErrorMessage(
          'Transcript request failed due to network/CORS. Configure a same-origin proxy or set VITE_TOOLERBOX_TRANSCRIPT_URL.',
        )
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'Transcript request failed.')
      }
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

  function applyPreset(settings: PresetSettings) {
    setTextChangeLevel(settings.textChangeLevel)
    setFormatOptions({ ...settings.formatOptions })
  }

  function handlePresetChange(value: string) {
    setSelectedPreset(value)
    if (value === 'custom') return
    if (value.startsWith('custom:')) {
      const name = value.slice('custom:'.length)
      const preset = customPresets[name]
      if (!preset) {
        setErrorMessage(`Custom preset "${name}" not found.`)
        setSelectedPreset('custom')
        return
      }
      applyPreset(preset)
      return
    }
    const builtIn = BUILTIN_PRESETS[value]
    if (builtIn) applyPreset(builtIn)
  }

  function saveCustomPreset() {
    const trimmed = customPresetName.trim()
    if (!trimmed) {
      setErrorMessage('Enter a custom preset name first.')
      return
    }
    const snapshot: PresetSettings = {
      textChangeLevel,
      formatOptions,
    }
    setCustomPresets((current) => ({ ...current, [trimmed]: snapshot }))
    setSelectedPreset(`custom:${trimmed}`)
    setSuccessMessage(`Saved preset "${trimmed}".`)
  }

  function deleteSelectedPreset() {
    if (!selectedPreset.startsWith('custom:')) return
    const name = selectedPreset.slice('custom:'.length)
    setCustomPresets((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
    setSelectedPreset('custom')
    setSuccessMessage(`Deleted preset "${name}".`)
  }

  function downloadMarkdown() {
    if (!formattedText.trim()) return
    const blob = new Blob([formattedText], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'formattr-output.md'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function downloadDocx() {
    if (!formattedText.trim()) return
    setErrorMessage('')
    setSuccessMessage('')
    try {
      const blob = await buildDocxBlob(formattedText, {
        templatePreset: exportTemplatePreset,
        useCustomHeadingStyles: exportUseCustomHeadingStyles,
        h1Font: exportH1Font,
        h1Size: exportH1Size,
        h2Font: exportH2Font,
        h2Size: exportH2Size,
        h3Font: exportH3Font,
        h3Size: exportH3Size,
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'formattr-output.docx'
      anchor.click()
      URL.revokeObjectURL(url)
      setSuccessMessage('Downloaded Word document.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Word export failed.')
    }
  }

  function loadHistoryItem(entry: HistoryEntry) {
    setInputText(entry.inputText)
    setFormattedText(entry.formattedText)
    setSuccessMessage(`Loaded history item "${entry.title}".`)
  }

  function deleteHistoryItem(id: string) {
    setHistoryItems((current) => current.filter((entry) => entry.id !== id))
  }

  const diffStats = useMemo(() => computeDiffStats(inputText, formattedText), [formattedText, inputText])
  const customPresetOptions = Object.keys(customPresets).sort((a, b) => a.localeCompare(b))

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-brand">
          <img src={WEB_LOGO_PATH} alt="Formattr logo" className="hero-logo" />
          <h1>Formattr BYOK</h1>
        </div>
        <p>
          Client-side BYOK: keys are sent directly to API providers and never stored on Formatr servers.
          Saved keys remain in this browser only if you choose to remember them.
        </p>
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
        <div className="row key-persistence">
          <label className="inline-field">
            Remember API keys
            <select
              value={rememberApiKeysScope}
              onChange={(event) => setRememberApiKeysScope(event.target.value as RememberKeysScope)}
            >
              <option value="none">Don't remember (default)</option>
              <option value="session">This browser session</option>
              <option value="local">On this device</option>
            </select>
          </label>
          <button type="button" className="secondary" onClick={handleClearSavedKeys} disabled={!hasSavedApiKeys}>
            Clear saved keys
          </button>
        </div>
        <p className="meta">
          {rememberApiKeysScope === 'session'
            ? 'Keys are stored in sessionStorage and cleared when you close the browser.'
            : rememberApiKeysScope === 'local'
              ? 'Keys are stored in localStorage and persist between visits on this device.'
              : 'Keys are kept in memory only until you refresh or leave the page.'}
        </p>
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

        <div className="row">
          <label className="inline-field">
            Preset
            <select value={selectedPreset} onChange={(event) => handlePresetChange(event.target.value)}>
              <option value="custom">Custom</option>
              <option value="minimal_cleanup">Minimal Cleanup</option>
              <option value="article">Article</option>
              <option value="executive_brief">Executive Brief</option>
              <option value="tutorial">Tutorial</option>
              {customPresetOptions.map((name) => (
                <option key={name} value={`custom:${name}`}>
                  Custom: {name}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-field">
            Preset name
            <input
              type="text"
              value={customPresetName}
              onChange={(event) => setCustomPresetName(event.target.value)}
              placeholder="e.g. Product Brief"
            />
          </label>
          <button type="button" onClick={saveCustomPreset}>
            Save Preset
          </button>
          <button
            type="button"
            className="secondary"
            onClick={deleteSelectedPreset}
            disabled={!selectedPreset.startsWith('custom:')}
          >
            Delete Preset
          </button>
          <label className="toggle">
            <input type="checkbox" checked={showDiff} onChange={(event) => setShowDiff(event.target.checked)} />
            Show Diff View
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
        <div className="row">
          <button type="button" onClick={downloadMarkdown} disabled={!formattedText.trim()}>
            Download Markdown
          </button>
          <button type="button" onClick={downloadDocx} disabled={!formattedText.trim()}>
            Download Word (.docx)
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => navigator.clipboard.writeText(formattedText)}
            disabled={!formattedText.trim()}
          >
            Copy Output
          </button>
          <span className="meta">
            Words: before {diffStats.before} / after {diffStats.after} / delta {diffStats.delta >= 0 ? '+' : ''}
            {diffStats.delta} ({diffStats.percent}%)
          </span>
        </div>
        <div className="grid three-col">
          <label>
            Word template preset
            <select
              value={exportTemplatePreset}
              onChange={(event) => setExportTemplatePreset(event.target.value as TemplatePreset)}
            >
              <option value="default">Default</option>
              <option value="professional">Professional</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={exportUseCustomHeadingStyles}
              onChange={(event) => setExportUseCustomHeadingStyles(event.target.checked)}
            />
            Use custom heading styles
          </label>
        </div>
        {exportUseCustomHeadingStyles ? (
          <div className="grid three-col">
            <label>
              H1 font
              <input
                type="text"
                value={exportH1Font}
                onChange={(event) => setExportH1Font(event.target.value)}
                placeholder="e.g. Calibri"
              />
            </label>
            <label>
              H1 size
              <input
                type="number"
                min={10}
                max={72}
                value={exportH1Size}
                onChange={(event) => setExportH1Size(Number(event.target.value || 16))}
              />
            </label>
            <label>
              H2 font
              <input
                type="text"
                value={exportH2Font}
                onChange={(event) => setExportH2Font(event.target.value)}
                placeholder="e.g. Calibri"
              />
            </label>
            <label>
              H2 size
              <input
                type="number"
                min={10}
                max={72}
                value={exportH2Size}
                onChange={(event) => setExportH2Size(Number(event.target.value || 14))}
              />
            </label>
            <label>
              H3 font
              <input
                type="text"
                value={exportH3Font}
                onChange={(event) => setExportH3Font(event.target.value)}
                placeholder="e.g. Calibri"
              />
            </label>
            <label>
              H3 size
              <input
                type="number"
                min={10}
                max={72}
                value={exportH3Size}
                onChange={(event) => setExportH3Size(Number(event.target.value || 12))}
              />
            </label>
          </div>
        ) : null}
        <textarea
          rows={14}
          value={formattedText}
          onChange={(event) => setFormattedText(event.target.value)}
          placeholder="Formatted markdown will appear here..."
        />
        {showDiff ? (
          <div className="grid two-col">
            <label>
              Original
              <textarea rows={8} value={inputText} readOnly />
            </label>
            <label>
              Formatted
              <textarea rows={8} value={formattedText} readOnly />
            </label>
          </div>
        ) : null}
      </section>

      <section className="card">
        <h2>History</h2>
        {historyItems.length === 0 ? (
          <p className="meta">No history yet. Format text to create entries.</p>
        ) : (
          <div className="history-list">
            {historyItems.map((entry) => (
              <div key={entry.id} className="history-item">
                <div>
                  <strong>{entry.title}</strong>
                  <p className="meta">{new Date(entry.createdAt).toLocaleString()}</p>
                </div>
                <div className="row">
                  <button type="button" className="secondary" onClick={() => loadHistoryItem(entry)}>
                    Load
                  </button>
                  <button type="button" className="secondary" onClick={() => deleteHistoryItem(entry.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {errorMessage ? <p className="status error">{errorMessage}</p> : null}
      {successMessage ? <p className="status success">{successMessage}</p> : null}
    </main>
  )
}

export default App
