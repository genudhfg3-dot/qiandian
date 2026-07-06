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
    if (event.button !== 0 || isDraggingRef.current) {
      return
    }

    event.preventDefault()
    isDraggingRef.current = true
    const target = event.currentTarget
    try {
      target.setPointerCapture(event.pointerId)
    } catch {
      // ignore capture failure; drag will still work via main-process cursor polling
    }
    void captureRepository.floatingDragStart()
  }

  const finishDrag = async (target: HTMLButtonElement, pointerId: number) => {
    if (!isDraggingRef.current) {
      return
    }
    isDraggingRef.current = false
    try {
      target.releasePointerCapture(pointerId)
    } catch {
      // capture may already be released
    }
    const result = await captureRepository.floatingDragEnd()
    if (!result.moved) {
      void captureRepository.openWindow()
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    void finishDrag(event.currentTarget, event.pointerId)
  }

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    void finishDrag(event.currentTarget, event.pointerId)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent">
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="flex size-12 cursor-grab items-center justify-center rounded-full bg-terracotta shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl active:cursor-grabbing"
        title="按住拖动 · 点击捕获"
        aria-label="快速捕获"
      >
        <Heart className="text-terracotta-fg pointer-events-none" size={22} strokeWidth={2.2} />
      </button>
    </div>
  )
}
