import { useEffect, useRef } from 'react'
import { Heart } from 'lucide-react'
import { captureRepository } from '../repositories/captureRepository'

export function CaptureButtonView() {
  useEffect(() => {
    const previousBodyBackground = document.body.style.background
    const previousRootBackground = document.documentElement.style.background
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'
    return () => {
      document.body.style.background = previousBodyBackground
      document.documentElement.style.background = previousRootBackground
    }
  }, [])
  const isDraggingRef = useRef(false)
  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isDraggingRef.current) return
    event.preventDefault()
    isDraggingRef.current = true
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* Native polling remains active. */ }
    void captureRepository.floatingDragStart({ x: event.clientX, y: event.clientY })
  }
  const finishDrag = async (target: HTMLButtonElement, pointerId: number, cancelled = false) => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    try { target.releasePointerCapture(pointerId) } catch { /* Capture may already be released. */ }
    const result = await captureRepository.floatingDragEnd(cancelled)
    if (!cancelled && !result.moved) {
      if (target.dataset.action === 'assistant') void window.assistantApi?.open()
      else void captureRepository.openWindow()
    }
  }
  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => { void finishDrag(event.currentTarget, event.pointerId) }
  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => { void finishDrag(event.currentTarget, event.pointerId, true) }
  const events = {
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onLostPointerCapture: handlePointerCancel,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0) {
        if (event.currentTarget.dataset.action === 'assistant') void window.assistantApi?.open()
        else void captureRepository.openWindow()
      }
    },
  }
  return <div className="floating-entry-stage">
    <div className="floating-entry">
      <button type="button" data-action="capture" className="floating-entry-heart" title="快捷收藏 · 按住拖动" aria-label="快捷收藏" {...events}>
        <Heart size={22} strokeWidth={2.2} aria-hidden="true" />
      </button>
      <button type="button" data-action="assistant" className="floating-entry-ai" title="问 AI · 按住拖动" aria-label="问 AI" {...events}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.1 2.4Q12 .6 12.9 2.4L14.5 6.8Q15.2 8.8 17.2 9.5L21.6 11.1Q23.4 12 21.6 12.9L17.2 14.5Q15.2 15.2 14.5 17.2L12.9 21.6Q12 23.4 11.1 21.6L9.5 17.2Q8.8 15.2 6.8 14.5L2.4 12.9Q.6 12 2.4 11.1L6.8 9.5Q8.8 8.8 9.5 6.8Z" /></svg></button>
    </div>
  </div>
}
