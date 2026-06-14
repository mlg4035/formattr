import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
} from 'docx'

export type TemplatePreset = 'default' | 'professional' | 'compact'

export type DocxExportOptions = {
  templatePreset: TemplatePreset
  useCustomHeadingStyles: boolean
  h1Font: string
  h1Size: number
  h2Font: string
  h2Size: number
  h3Font: string
  h3Size: number
}

type HeadingStyle = {
  fontName: string
  fontSize: number
}

const TEMPLATE_DEFAULTS: Record<TemplatePreset, { bodyFont: string; h1: HeadingStyle; h2: HeadingStyle; h3: HeadingStyle }> = {
  default: {
    bodyFont: 'Calibri',
    h1: { fontName: 'Calibri', fontSize: 18 },
    h2: { fontName: 'Calibri', fontSize: 15 },
    h3: { fontName: 'Calibri', fontSize: 13 },
  },
  professional: {
    bodyFont: 'Arial',
    h1: { fontName: 'Arial', fontSize: 20 },
    h2: { fontName: 'Arial', fontSize: 16 },
    h3: { fontName: 'Arial', fontSize: 14 },
  },
  compact: {
    bodyFont: 'Calibri',
    h1: { fontName: 'Calibri', fontSize: 16 },
    h2: { fontName: 'Calibri', fontSize: 14 },
    h3: { fontName: 'Calibri', fontSize: 12 },
  },
}

function toHalfPoint(fontSize: number): number {
  const safe = Number.isFinite(fontSize) ? fontSize : 12
  return Math.max(10, Math.round(safe)) * 2
}

function applyOverrides(base: HeadingStyle, font: string, size: number): HeadingStyle {
  return {
    fontName: font.trim() || base.fontName,
    fontSize: Number.isFinite(size) ? size : base.fontSize,
  }
}

function setextHeadingLevel(line: string): 1 | 2 | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  if (/^={3,}$/.test(trimmed)) return 1
  if (/^-{3,}$/.test(trimmed)) return 2
  return null
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim()
  const normalized = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  return normalized.split('|').map((cell) => cell.trim())
}

function isMarkdownTableSeparator(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed.includes('|')) return false
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(trimmed)
}

function inlineRuns(text: string, font: string, size: number, forceItalics = false): TextRun[] {
  const runs: TextRun[] = []
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`)/g
  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) {
      runs.push(
        new TextRun({
          text: text.slice(cursor, index),
          font,
          size: toHalfPoint(size),
          italics: forceItalics,
        }),
      )
    }

    const token = match[0]
    if (token.startsWith('**') || token.startsWith('__')) {
      runs.push(
        new TextRun({
          text: token.slice(2, -2),
          bold: true,
          font,
          size: toHalfPoint(size),
          italics: forceItalics,
        }),
      )
    } else if (token.startsWith('*') || token.startsWith('_')) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          italics: true,
          font,
          size: toHalfPoint(size),
        }),
      )
    } else if (token.startsWith('`')) {
      runs.push(
        new TextRun({
          text: token.slice(1, -1),
          font: 'Consolas',
          size: toHalfPoint(size),
          italics: forceItalics,
        }),
      )
    }

    cursor = index + token.length
  }

  if (cursor < text.length) {
    runs.push(
      new TextRun({
        text: text.slice(cursor),
        font,
        size: toHalfPoint(size),
          italics: forceItalics,
      }),
    )
  }

  return runs.length
    ? runs
    : [
        new TextRun({
          text,
          font,
          size: toHalfPoint(size),
          italics: forceItalics,
        }),
      ]
}

function parseMarkdownToChildren(markdown: string, options: DocxExportOptions): FileChild[] {
  const template = TEMPLATE_DEFAULTS[options.templatePreset]
  const h1Style = options.useCustomHeadingStyles
    ? applyOverrides(template.h1, options.h1Font, options.h1Size)
    : template.h1
  const h2Style = options.useCustomHeadingStyles
    ? applyOverrides(template.h2, options.h2Font, options.h2Size)
    : template.h2
  const h3Style = options.useCustomHeadingStyles
    ? applyOverrides(template.h3, options.h3Font, options.h3Size)
    : template.h3

  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const children: FileChild[] = []

  let i = 0
  while (i < lines.length) {
    const rawLine = lines[i]
    const line = rawLine.trim()
    if (!line) {
      children.push(new Paragraph({ text: '' }))
      i += 1
      continue
    }

    if (i + 1 < lines.length) {
      const setextLevel = setextHeadingLevel(lines[i + 1])
      if (setextLevel && !line.includes('|')) {
        const style = setextLevel === 1 ? h1Style : h2Style
        children.push(
          new Paragraph({
            heading: setextLevel === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            children: inlineRuns(line, style.fontName, style.fontSize),
          }),
        )
        i += 2
        continue
      }
    }

    if (line.includes('|') && i + 1 < lines.length && isMarkdownTableSeparator(lines[i + 1])) {
      const headerCells = parseTableRow(lines[i])
      const rows: string[][] = []
      i += 2
      while (i < lines.length) {
        const rowLine = lines[i].trim()
        if (!rowLine || !rowLine.includes('|')) break
        rows.push(parseTableRow(lines[i]))
        i += 1
      }

      const colCount = Math.max(1, headerCells.length)
      const tableRows: TableRow[] = [
        new TableRow({
          children: headerCells.slice(0, colCount).map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell,
                        bold: true,
                        font: template.bodyFont,
                        size: toHalfPoint(11),
                      }),
                    ],
                  }),
                ],
              }),
          ),
        }),
      ]

      for (const row of rows) {
        tableRows.push(
          new TableRow({
            children: Array.from({ length: colCount }).map(
              (_, idx) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: inlineRuns(row[idx] ?? '', template.bodyFont, 11),
                    }),
                  ],
                }),
            ),
          }),
        )
      }

      children.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }),
      )
      continue
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6)
      const headingText = headingMatch[2].trim()
      const style = level === 1 ? h1Style : level === 2 ? h2Style : h3Style
      const headingLevel =
        level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3
      children.push(
        new Paragraph({
          heading: headingLevel,
          children: inlineRuns(headingText, style.fontName, style.fontSize).map((run) => run),
        }),
      )
      i += 1
      continue
    }

    const bulletMatch = rawLine.match(/^(\s*)[-*+]\s+(.*)$/)
    if (bulletMatch) {
      const indentLevel = Math.max(0, Math.floor((bulletMatch[1] ?? '').replace(/\t/g, '    ').length / 2))
      children.push(
        new Paragraph({
          bullet: { level: Math.min(8, indentLevel) },
          children: inlineRuns(bulletMatch[2].trim(), template.bodyFont, 11),
        }),
      )
      i += 1
      continue
    }

    const numberedMatch = rawLine.match(/^(\s*)(\d+)\.\s+(.*)$/)
    if (numberedMatch) {
      const indentLevel = Math.max(0, Math.floor((numberedMatch[1] ?? '').replace(/\t/g, '    ').length / 2))
      children.push(
        new Paragraph({
          indent: indentLevel > 0 ? { left: 360 * indentLevel } : undefined,
          children: inlineRuns(`${numberedMatch[2]}. ${numberedMatch[3].trim()}`, template.bodyFont, 11),
        }),
      )
      i += 1
      continue
    }

    const quoteMatch = line.match(/^>\s+(.*)$/)
    if (quoteMatch) {
      children.push(
        new Paragraph({
          children: inlineRuns(quoteMatch[1], template.bodyFont, 11, true),
        }),
      )
      i += 1
      continue
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i += 1
      }
      if (i < lines.length) i += 1
      const codeText = codeLines.join('\n')
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: codeText,
              font: 'Consolas',
              size: toHalfPoint(10),
            }),
          ],
        }),
      )
      continue
    }

    children.push(
      new Paragraph({
        children: inlineRuns(line, template.bodyFont, 11),
      }),
    )
    i += 1
  }

  return children
}

export async function buildDocxBlob(markdown: string, options: DocxExportOptions): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        children: parseMarkdownToChildren(markdown, options),
      },
    ],
  })
  return Packer.toBlob(doc)
}
