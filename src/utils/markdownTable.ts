const SEPARATOR_CELL_PATTERN = /^:?-{1,}:?$/

export interface ParsedTableBlock {
  headerCells: string[]
  bodyRows: string[][]
  consumedLineCount: number
}

export function splitTableRow(line: string): string[] {
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) {
    trimmed = trimmed.slice(1)
  }
  if (trimmed.endsWith('|') && !trimmed.endsWith('\\|')) {
    trimmed = trimmed.slice(0, -1)
  }

  const cells: string[] = []
  let current = ''
  for (let i = 0; i < trimmed.length; i += 1) {
    const char = trimmed[i]
    if (char === '\\' && trimmed[i + 1] === '|') {
      current += '|'
      i += 1
      continue
    }
    if (char === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function isSeparatorRow(line: string): boolean {
  const cells = splitTableRow(line)
  return cells.length > 0 && cells.every((cell) => SEPARATOR_CELL_PATTERN.test(cell.trim()))
}

export function tryParseTableBlock(lines: string[], startIndex: number): ParsedTableBlock | null {
  const headerLine = lines[startIndex]
  const separatorLine = lines[startIndex + 1]
  if (headerLine === undefined || separatorLine === undefined) {
    return null
  }
  if (!headerLine.trim() || !headerLine.includes('|') || !isSeparatorRow(separatorLine)) {
    return null
  }

  const headerCells = splitTableRow(headerLine)
  const bodyRows: string[][] = []
  let cursor = startIndex + 2
  while (cursor < lines.length && lines[cursor].trim() && lines[cursor].includes('|')) {
    bodyRows.push(splitTableRow(lines[cursor]))
    cursor += 1
  }

  return {
    headerCells,
    bodyRows,
    consumedLineCount: cursor - startIndex,
  }
}

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|')
}

export function buildTableMarkdown(rows: string[][]): string {
  const columnCount = Math.max(1, ...rows.map((row) => row.length))
  const normalize = (row: string[]) => {
    const next = row.slice(0, columnCount)
    while (next.length < columnCount) {
      next.push('')
    }
    return next
  }

  const [header, ...body] = rows.map(normalize)
  const headerCells = header ?? Array.from({ length: columnCount }, () => '')
  const headerLine = `| ${headerCells.map(escapeTableCell).join(' | ')} |`
  const separatorLine = `| ${headerCells.map(() => '---').join(' | ')} |`
  const bodyLines = body.map((row) => `| ${row.map(escapeTableCell).join(' | ')} |`)
  return [headerLine, separatorLine, ...bodyLines].join('\n')
}
