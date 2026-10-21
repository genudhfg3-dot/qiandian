import { useEffect, useState } from 'react'
export function AssistantSelection() {
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null)
  useEffect(() => {
    function update() {
      const selected = window.getSelection()
      const node = selected?.anchorNode?.parentElement
      const end = selected?.focusNode?.parentElement
      if (!window.assistantApi || !selected?.rangeCount || !node?.closest('.rich-preview') || !end?.closest('.rich-preview') || node.closest('[contenteditable],input,textarea')) { setSelection(null); return }
      const text = selected.toString().trim()
      if (!text || text.length > 16000) { setSelection(null); return }
      const rect = selected.getRangeAt(0).getBoundingClientRect()
      setSelection({ text, x: Math.max(8, Math.min(rect.left, innerWidth - 220)), y: Math.max(8, Math.min(rect.bottom + 6, innerHeight - 44)) })
    }
    document.addEventListener('mouseup', update); document.addEventListener('keyup', update)
    const hide = () => setSelection(null)
    document.addEventListener('scroll', hide, true)
    return () => { document.removeEventListener('mouseup', update); document.removeEventListener('keyup', update); document.removeEventListener('scroll', hide, true) }
  }, [])
  if (!selection) return null
  return <div className="fixed z-40 flex gap-1 rounded-[6px] border border-hairline bg-surface p-1 shadow-md" style={{ left: selection.x, top: selection.y }} onMouseDown={event => event.preventDefault()}>
    {([['翻译', 'translate'], ['解释', 'explain'], ['提问', 'ask']] as const).map(([label, action]) => <button key={action} className="assistant-chip" onClick={() => { void window.assistantApi?.open(selection.text, action); setSelection(null) }}>{label}</button>)}
  </div>
}
