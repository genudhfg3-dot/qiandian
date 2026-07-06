import { rewriteMarkdownImageUrls } from './imageUrls'

export type MarkdownPreviewBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'image'; alt: string; src: string }

const IMAGE_LINE_PATTERN = /^!\[([^\]]*)\]\(([^)]+)\)$/

function stripInlineMarkdown(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

export function createMarkdownBlocks(markdown: string, limit?: number): MarkdownPreviewBlock[] {
  const lines = rewriteMarkdownImageUrls(markdown)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return (typeof limit === 'number' ? lines.slice(0, limit) : lines).map((line): MarkdownPreviewBlock => {
    const imageMatch = line.match(IMAGE_LINE_PATTERN)
    if (imageMatch) {
      return { type: 'image', alt: imageMatch[1], src: imageMatch[2] }
    }

    if (line.startsWith('#')) {
      return { type: 'heading', text: stripInlineMarkdown(line.replace(/^#{1,6}\s*/, '')) }
    }

    return { type: 'paragraph', text: stripInlineMarkdown(line.replace(/^[-*+]\s+/, '')) }
  })
}

export function createMarkdownPreviewBlocks(markdown: string): MarkdownPreviewBlock[] {
  return createMarkdownBlocks(markdown, 12)
}
