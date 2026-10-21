import TurndownService from 'turndown'
import type { SourceInfo } from '../../src/domain/knowledge'
import { buildTableMarkdown } from '../../src/utils/markdownTable'

export interface CapturedClipboardImage {
  path: string
  mime: 'image/png'
}

export interface ClipboardSnapshot {
  html?: string
  text?: string
  images?: CapturedClipboardImage[]
  imageError?: string
  source?: SourceInfo
}

export interface ClipboardReadResult {
  contentMd: string
  title?: string
  format: 'html' | 'text' | 'image' | 'empty'
  imageUnsupported: boolean
  isEmpty: boolean
  images: CapturedClipboardImage[]
  imageError?: string
  source?: SourceInfo
}

// electron/** 的 tsconfig 不含 DOM 类型库（Node 环境），但 turndown 在运行时确实
// 用一个实现了 querySelectorAll/textContent 的 DOM-like 节点调用 replacement 回调。
// 这里只描述我们用到的最小结构，避免为了几个字段就给整个项目引入 DOM lib。
interface MinimalDomElement {
  textContent: string | null
  querySelectorAll(selector: string): ArrayLike<MinimalDomElement>
}

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
})

turndown.addRule('ignoreHtmlImages', {
  filter: 'img',
  replacement() {
    return ''
  },
})

// Excel/WPS 复制出来的表格 HTML 全程只用 <td>，从不带 <th>/<thead>，
// 所以这里不依赖表头语义标签，统一把第一行当作表头处理。
turndown.addRule('table', {
  filter: (node) => (node as unknown as { nodeName: string }).nodeName === 'TABLE',
  replacement(_content, node) {
    const table = node as unknown as MinimalDomElement
    const rows = Array.from(table.querySelectorAll('tr'))
      .map((row) =>
        Array.from(row.querySelectorAll('th, td')).map((cell) => (cell.textContent ?? '').replace(/\s+/g, ' ').trim()),
      )
      .filter((cells) => cells.length > 0)
    if (rows.length === 0) {
      return ''
    }
    return `\n\n${buildTableMarkdown(rows)}\n\n`
  },
})

function compactMarkdown(markdown: string) {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripMarkdownPrefix(line: string) {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/[*_`]/g, '')
    .trim()
}

function imageMarkdown(images: CapturedClipboardImage[]) {
  return images.map((image, index) => `![clipboard-image-${index + 1}](${image.path})`).join('\n\n')
}

export function inferTitleFromMarkdown(contentMd: string) {
  const firstLine = contentMd
    .split('\n')
    .map((line) => stripMarkdownPrefix(line))
    .find(Boolean)

  return firstLine ? firstLine.slice(0, 60) : undefined
}

export function convertClipboardSnapshot(snapshot: ClipboardSnapshot): ClipboardReadResult {
  const html = snapshot.html?.trim()
  const text = snapshot.text?.trim()
  const images = snapshot.images ?? []
  const imageBlock = imageMarkdown(images)
  const imageUnsupported = Boolean(snapshot.imageError)
  const source = snapshot.source

  if (html) {
    const markdown = compactMarkdown(turndown.turndown(html))
    const contentMd = compactMarkdown([markdown, imageBlock].filter(Boolean).join('\n\n'))
    return {
      contentMd,
      title: inferTitleFromMarkdown(contentMd),
      format: 'html',
      imageUnsupported,
      isEmpty: !contentMd,
      images,
      imageError: snapshot.imageError,
      source,
    }
  }

  if (text) {
    const markdown = text.replace(/\r\n/g, '\n').trim()
    const contentMd = compactMarkdown([markdown, imageBlock].filter(Boolean).join('\n\n'))
    return {
      contentMd,
      title: inferTitleFromMarkdown(contentMd),
      format: 'text',
      imageUnsupported,
      isEmpty: !contentMd,
      images,
      imageError: snapshot.imageError,
      source,
    }
  }

  if (images.length > 0) {
    const contentMd = imageBlock
    return {
      contentMd,
      title: 'Clipboard image',
      format: 'image',
      imageUnsupported,
      isEmpty: false,
      images,
      imageError: snapshot.imageError,
      source,
    }
  }

  return {
    contentMd: '',
    format: 'empty',
    imageUnsupported,
    isEmpty: true,
    images,
    imageError: snapshot.imageError,
    source,
  }
}


