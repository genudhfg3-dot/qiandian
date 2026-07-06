import type { SourceInfo } from '../domain/knowledge'

const MAX_TITLE_LENGTH = 24
const MAX_SUMMARY_LENGTH = 100
const weakTitleWords = new Set(['codex', 'chrome', 'edge', 'firefox', 'electron', '千点', '个人知识库', '快速笔记', 'untitled', 'new tab'])

function stripInlineFormatting(value: string) {
  return value
    .replace(/<span style="[^"]+">(.*?)<\/span>/g, '$1')
    .replace(/<mark>(.*?)<\/mark>/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

function cleanMarkdownPrefix(line: string) {
  return stripInlineFormatting(line)
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*>`\s]+/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]+\]\([^)]*\)/g, (match) => match.replace(/^\[/, '').replace(/\]\([^)]*\)$/, ''))
    .replace(/https?:\/\/\S+/g, '')
    .trim()
}

function compact(value: string, maxLength: number) {
  const compacted = value.replace(/\s+/g, ' ').trim()
  if (compacted.length <= maxLength) {
    return compacted
  }

  return `${compacted.slice(0, maxLength).trim()}...`
}

function informationScore(value: string) {
  const cleaned = value.trim().toLocaleLowerCase()
  if (!cleaned || weakTitleWords.has(cleaned) || /^https?:\/\//.test(cleaned)) {
    return 0
  }

  const meaningfulCharacters = cleaned.replace(/[\s\p{P}\p{S}]/gu, '')
  const hasCjk = /[\u4e00-\u9fff]/.test(cleaned)
  const hasLettersOrDigits = /[a-z0-9]/i.test(cleaned)
  let score = meaningfulCharacters.length
  if (hasCjk) score += 8
  if (hasLettersOrDigits) score += 4
  if (/[。！？.!?：:，,]/.test(value)) score += 2
  if (value.length > 80) score -= 8
  return score
}

function isUsefulTitle(value: string) {
  const cleaned = value.trim()
  return informationScore(cleaned) >= 8 && cleaned.length <= 90
}

function candidateLines(contentMd: string) {
  return contentMd
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('---') && !line.startsWith('|'))
}

export function generateEntryTitle(contentMd: string, source?: SourceInfo) {
  const lines = candidateLines(contentMd)
  const heading = lines.map(cleanMarkdownPrefix).find((line, index) => /^#{1,3}\s+/.test(lines[index]) && isUsefulTitle(line))
  if (heading) {
    return compact(heading, MAX_TITLE_LENGTH)
  }

  const contentCandidates = lines
    .map(cleanMarkdownPrefix)
    .flatMap((line) => line.split(/[。！？.!?]/).map((part) => part.trim()).filter(Boolean))
    .filter(isUsefulTitle)
    .sort((a, b) => informationScore(b) - informationScore(a))

  if (contentCandidates[0]) {
    return compact(contentCandidates[0], MAX_TITLE_LENGTH)
  }

  const sourceTitle = source?.title?.trim()
  if (sourceTitle && isUsefulTitle(sourceTitle)) {
    return compact(sourceTitle, MAX_TITLE_LENGTH)
  }

  const sourceApp = source?.app?.trim()
  if (sourceApp && isUsefulTitle(sourceApp)) {
    return compact(sourceApp, MAX_TITLE_LENGTH)
  }

  return '未命名知识'
}

export function generateEntrySummary(contentMd: string) {
  const summary = candidateLines(contentMd)
    .map(cleanMarkdownPrefix)
    .filter(isUsefulTitle)
    .join(' ')

  return compact(summary || cleanMarkdownPrefix(contentMd) || '暂无摘要', MAX_SUMMARY_LENGTH)
}
