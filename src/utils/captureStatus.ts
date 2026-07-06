export type CaptureSaveState = 'idle' | 'saving' | 'success' | 'failure' | 'images_cleaned'

interface CaptureStatusInput {
  state: CaptureSaveState
  title?: string
  error?: string
  cleanedImageCount?: number
}

export function captureStatusLabel(state: CaptureSaveState) {
  switch (state) {
    case 'saving':
      return '保存中'
    case 'success':
      return '保存成功'
    case 'failure':
      return '保存失败'
    case 'images_cleaned':
      return '图片已清理'
    case 'idle':
    default:
      return '未保存'
  }
}

export function captureStatusMessage(input: CaptureStatusInput) {
  if (input.state === 'success') {
    return input.title ? `已保存：${input.title}` : '已保存到知识库。'
  }

  if (input.state === 'images_cleaned') {
    const count = input.cleanedImageCount ?? 0
    const prefix = count > 0 ? `保存失败，已清理 ${count} 张暂存图片。` : '保存失败，暂存图片已清理。'
    const suffix = '请重新从剪贴板填入图片后再保存。'
    return input.error ? `${prefix}${suffix}${input.error}` : `${prefix}${suffix}`
  }

  if (input.state === 'failure') {
    return input.error ?? '保存失败。'
  }

  if (input.state === 'saving') {
    return '正在保存...'
  }

  return '未保存'
}
