import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { ClipboardEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { rewriteMarkdownImageUrls } from '../utils/imageUrls'

const inlineFormatPattern = /\*\*([^*]+)\*\*|<mark>(.*?)<\/mark>|<span style="color:\s*(#[0-9a-fA-F]{6})">(.*?)<\/span>|<span style="font-size:\s*(\d+)px">(.*?)<\/span>/g
const blockElementNames = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'FIGURE', 'FOOTER', 'HEADER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'UL'])

export type InlineFormatKind = 'bold' | 'color' | 'size' | 'highlight'

export interface RichTextEditorHandle {
  focus: () => void
  insertMarkdown: (markdown: string) => void
  applyInlineFormat: (kind: InlineFormatKind) => void
}

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  onTouched?: () => void
  onKeyDown?: (event: ReactKeyboardEvent<HTMLDivElement>) => void
  onPasteImageClipboard?: () => Promise<string | null>
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeMarkdown(markdown: string) {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function rgbToHex(color: string) {
  const hex = color.match(/^#[0-9a-fA-F]{6}$/)
  if (hex) {
    return color.toUpperCase()
  }

  const rgb = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!rgb) {
    return undefined
  }

  return `#${[rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function renderInlineMarkdown(text: string) {
  const html: string[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  inlineFormatPattern.lastIndex = 0

  while ((match = inlineFormatPattern.exec(text)) !== null) {
    if (match.index > cursor) {
      html.push(escapeHtml(text.slice(cursor, match.index)))
    }

    if (match[1]) {
      html.push(`<strong>${escapeHtml(match[1])}</strong>`)
    } else if (match[2]) {
      html.push(`<mark>${escapeHtml(match[2])}</mark>`)
    } else if (match[3]) {
      html.push(`<span style="color: ${match[3]}">${escapeHtml(match[4])}</span>`)
    } else if (match[5]) {
      html.push(`<span style="font-size: ${match[5]}px">${escapeHtml(match[6])}</span>`)
    }

    cursor = inlineFormatPattern.lastIndex
  }

  if (cursor < text.length) {
    html.push(escapeHtml(text.slice(cursor)))
  }

  return html.join('')
}

function markdownToEditorHtml(markdown: string) {
  if (!markdown.trim()) {
    return ''
  }

  const lines = rewriteMarkdownImageUrls(markdown).split('\n')
  const originalLines = markdown.split('\n')

  return lines
    .map((line, index) => {
      const originalLine = originalLines[index] ?? line
      const trimmed = line.trim()
      if (!trimmed) {
        return '<p><br></p>'
      }

      const originalImage = originalLine.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      const image = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (image) {
        const src = image[2]
        const sourcePath = originalImage?.[2] ?? src
        return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(image[1])}" data-md-src="${escapeHtml(sourcePath)}"></figure>`
      }

      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        return `<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`
      }

      if (trimmed.startsWith('- ')) {
        return `<ul><li>${renderInlineMarkdown(trimmed.slice(2))}</li></ul>`
      }

      return `<p>${renderInlineMarkdown(line)}</p>`
    })
    .join('')
}

function hasImageClipboardItem(event: ClipboardEvent<HTMLDivElement>) {
  const types = Array.from(event.clipboardData.types)
  const items = Array.from(event.clipboardData.items)
  const files = Array.from(event.clipboardData.files)
  return (
    types.includes('Files') ||
    types.some((type) => type.startsWith('image/')) ||
    items.some((item) => item.kind === 'file' && item.type.startsWith('image/')) ||
    files.some((file) => file.type.startsWith('image/'))
  )
}

function inlineNodeToMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }

  if (!(node instanceof HTMLElement)) {
    return ''
  }

  const content = Array.from(node.childNodes).map(inlineNodeToMarkdown).join('')
  if (!content) {
    return ''
  }

  const name = node.tagName
  if (name === 'STRONG' || name === 'B') {
    return `**${content}**`
  }

  if (name === 'MARK') {
    return `<mark>${content}</mark>`
  }

  if (name === 'SPAN' || name === 'FONT') {
    const color = rgbToHex(node.style.color || node.getAttribute('color') || '')
    const fontSize = node.style.fontSize.match(/^(\d+)px$/)?.[1]
    if (color) {
      return `<span style="color: ${color}">${content}</span>`
    }
    if (fontSize) {
      return `<span style="font-size: ${fontSize}px">${content}</span>`
    }
  }

  if (name === 'BR') {
    return '\n'
  }

  return content
}

function blockNodeToMarkdown(node: Node): string[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim()
    return text ? [text] : []
  }

  if (!(node instanceof HTMLElement)) {
    return []
  }

  const name = node.tagName
  if (name === 'BR') {
    return ['']
  }

  if (name === 'IMG') {
    const source = node.dataset.mdSrc || node.getAttribute('src') || ''
    return source ? [`![${node.getAttribute('alt') ?? ''}](${source})`] : []
  }

  if (name === 'FIGURE') {
    const image = node.querySelector('img')
    return image ? blockNodeToMarkdown(image) : []
  }

  if (/^H[1-6]$/.test(name)) {
    const level = Math.min(Number(name.slice(1)), 3)
    const text = Array.from(node.childNodes).map(inlineNodeToMarkdown).join('').trim()
    return text ? [`${'#'.repeat(level)} ${text}`] : []
  }

  if (name === 'UL' || name === 'OL') {
    return Array.from(node.children).flatMap((child) => blockNodeToMarkdown(child))
  }

  if (name === 'LI') {
    const text = Array.from(node.childNodes).map(inlineNodeToMarkdown).join('').trim()
    return text ? [`- ${text}`] : []
  }

  const hasBlockChildren = Array.from(node.children).some((child) => blockElementNames.has(child.tagName))
  if (hasBlockChildren && name !== 'P') {
    return Array.from(node.childNodes).flatMap((child) => blockNodeToMarkdown(child))
  }

  const text = Array.from(node.childNodes).map(inlineNodeToMarkdown).join('').trimEnd()
  return text.trim() ? [text] : ['']
}

function editorElementToMarkdown(element: HTMLElement) {
  return normalizeMarkdown(Array.from(element.childNodes).flatMap((node) => blockNodeToMarkdown(node)).join('\n'))
}

function htmlToMarkdown(html: string, fallbackText: string) {
  if (!html.trim()) {
    return normalizeMarkdown(fallbackText)
  }

  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const markdown = normalizeMarkdown(Array.from(parsed.body.childNodes).flatMap((node) => blockNodeToMarkdown(node)).join('\n'))
  return markdown || normalizeMarkdown(fallbackText)
}

function focusAtEnd(element: HTMLElement) {
  element.focus()
  const range = document.createRange()
  range.selectNodeContents(element)
  range.collapse(false)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function selectionBelongsTo(element: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return false
  }

  const anchor = selection.anchorNode
  return Boolean(anchor && element.contains(anchor))
}

function formatHtml(kind: InlineFormatKind, text: string) {
  const escaped = escapeHtml(text).replace(/\n/g, '<br>')
  if (kind === 'bold') {
    return `<strong>${escaped}</strong>`
  }
  if (kind === 'color') {
    return `<span style="color: #D6532E">${escaped}</span>`
  }
  if (kind === 'size') {
    return `<span style="font-size: 18px">${escaped}</span>`
  }
  return `<mark>${escaped}</mark>`
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, onTouched, onKeyDown, onPasteImageClipboard, placeholder = '直接输入或粘贴内容...', autoFocus = false, className = '' },
  ref,
) {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const lastSyncedMarkdown = useRef<string | null>(null)

  const emitChange = () => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const nextMarkdown = editorElementToMarkdown(editor)
    lastSyncedMarkdown.current = nextMarkdown
    onChange(nextMarkdown)
    onTouched?.()
  }

  const insertMarkdown = (markdown: string) => {
    const editor = editorRef.current
    if (!editor || !markdown.trim()) {
      return
    }

    if (!selectionBelongsTo(editor)) {
      focusAtEnd(editor)
    }

    document.execCommand('insertHTML', false, markdownToEditorHtml(markdown))
    emitChange()
  }

  const applyInlineFormat = (kind: InlineFormatKind) => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    if (!selectionBelongsTo(editor)) {
      focusAtEnd(editor)
    }

    const selection = window.getSelection()
    const selectedText = selection?.toString() || (kind === 'bold' ? '加粗文字' : kind === 'color' ? '变色文字' : kind === 'size' ? '大字号文字' : '高亮文字')
    document.execCommand('insertHTML', false, formatHtml(kind, selectedText))
    emitChange()
  }

  useImperativeHandle(ref, () => ({
    focus: () => {
      const editor = editorRef.current
      if (editor) {
        focusAtEnd(editor)
      }
    },
    insertMarkdown,
    applyInlineFormat,
  }))

  useLayoutEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const normalizedValue = normalizeMarkdown(value)

    // 这次的 value 就是我们刚从 emitChange 上抛的，DOM 没变化，无需重建。
    if (lastSyncedMarkdown.current !== null && normalizeMarkdown(lastSyncedMarkdown.current) === normalizedValue) {
      return
    }

    // value 和编辑器实际内容已一致（来自父组件回填等场景），也无需重建。
    if (editorElementToMarkdown(editor) === normalizedValue) {
      lastSyncedMarkdown.current = value
      return
    }

    editor.innerHTML = markdownToEditorHtml(value)
    lastSyncedMarkdown.current = value
  }, [value])

  useLayoutEffect(() => {
    if (autoFocus && editorRef.current) {
      focusAtEnd(editorRef.current)
    }
  }, [autoFocus])

  const handlePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    if (onPasteImageClipboard && hasImageClipboardItem(event)) {
      event.preventDefault()
      const markdown = await onPasteImageClipboard()
      if (markdown) {
        insertMarkdown(markdown)
      }
      return
    }

    const html = event.clipboardData.getData('text/html')
    const text = event.clipboardData.getData('text/plain')
    if (!html && !text) {
      return
    }

    event.preventDefault()
    insertMarkdown(htmlToMarkdown(html, text))
  }

  return (
    <div
      ref={editorRef}
      contentEditable="true"
      suppressContentEditableWarning
      spellCheck={false}
      dir="ltr"
      data-placeholder={placeholder}
      onInput={emitChange}
      onPaste={(event) => void handlePaste(event)}
      onKeyDown={onKeyDown}
      className={`rich-text-editor min-h-0 overflow-auto rounded-[6px] border border-hairline bg-cream-soft/55 px-3 py-2 text-[15px] leading-[1.85] text-ink outline-none focus:border-soft-ink ${className}`}
    />
  )
})
