import type { RefObject } from 'react'
import { Bold, Highlighter, Palette, Type } from 'lucide-react'
import type { InlineFormatKind, RichTextEditorHandle } from './RichTextEditor'

interface EditorToolbarProps {
  editorRef: RefObject<RichTextEditorHandle | null>
  onTouched?: () => void
}

export function EditorToolbar({ editorRef, onTouched }: EditorToolbarProps) {
  const applyInlineFormat = (kind: InlineFormatKind) => {
    editorRef.current?.applyInlineFormat(kind)
    onTouched?.()
  }

  return (
    <div className="flex items-center gap-1 rounded-[4px] border border-soft-ink/40 bg-[#C9C7C0] px-2 py-1 shadow-sm">
      <button type="button" onClick={() => applyInlineFormat('bold')} className="inline-flex size-8 items-center justify-center rounded-[4px] text-soft-ink hover:bg-surface/60 hover:text-ink" title="加粗">
        <Bold size={17} strokeWidth={1.9} />
      </button>
      <button type="button" onClick={() => applyInlineFormat('color')} className="inline-flex size-8 items-center justify-center rounded-[4px] text-soft-ink hover:bg-surface/60 hover:text-ink" title="变颜色">
        <Palette size={17} strokeWidth={1.9} />
      </button>
      <button type="button" onClick={() => applyInlineFormat('size')} className="inline-flex size-8 items-center justify-center rounded-[4px] text-soft-ink hover:bg-surface/60 hover:text-ink" title="变字号">
        <Type size={17} strokeWidth={1.9} />
      </button>
      <button type="button" onClick={() => applyInlineFormat('highlight')} className="inline-flex size-8 items-center justify-center rounded-[4px] text-soft-ink hover:bg-surface/60 hover:text-ink" title="高亮">
        <Highlighter size={17} strokeWidth={1.9} />
      </button>
    </div>
  )
}
