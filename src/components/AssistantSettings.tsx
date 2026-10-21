import { useEffect, useState } from 'react'
import type { AssistantPreferences } from '../domain/assistant'

export function AssistantSettings() {
  const [prefs, setPrefs] = useState<AssistantPreferences | null>(null)
  const [notice, setNotice] = useState(''), [saving, setSaving] = useState(false)
  useEffect(() => { void window.assistantApi?.preferences().then(setPrefs).catch(error => setNotice(String(error))) }, [])
  if (!prefs) return null
  return <section className="mt-8 max-w-2xl border-t border-hairline pt-5">
    <h2 className="text-lg font-medium">随手问助手</h2>
    <p className="mt-2 text-xs leading-6 text-soft-ink">提问共用上方的 AI 启用开关和模型配置。请使用支持图片理解（视觉／多模态）的大模型，纯文字模型无法处理截图。只有点击翻译或发送后，才提交内容。MiMo 官方接口使用快速回答模式，减少等待。</p>
    <label className="mt-3 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={prefs.screenshotHints} onChange={event => setPrefs({ ...prefs, screenshotHints: event.target.checked })} />复制新截图后显示轻提示</label>
    <label className="mt-4 block text-xs text-soft-ink">助手快捷键<input className="assistant-field mt-1 block w-full" value={prefs.shortcut} onChange={event => setPrefs({ ...prefs, shortcut: event.target.value })} placeholder="Alt+R" /></label>
    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-faint"><span>默认 Alt + R，可输入其他组合，如 Ctrl+Shift+A。</span><button type="button" className="shrink-0 text-soft-ink hover:text-terracotta" onClick={() => setPrefs({ ...prefs, shortcut: 'Alt+R' })}>恢复默认</button></div>
    <p className="mt-2 text-xs text-faint">保留 Ctrl+Shift+K 快速收藏，不占用 Snipaste 的 F1 / F3。</p>
    {(notice || prefs.shortcutError) && <p role="status" className="mt-2 text-xs text-terracotta">{notice || prefs.shortcutError}</p>}
    <button disabled={saving} className="assistant-chip mt-3" onClick={() => { setSaving(true); void window.assistantApi?.updatePreferences(prefs).then(value => { setPrefs(value); setNotice('助手设置已保存。') }).catch(error => setNotice(String(error))).finally(() => setSaving(false)) }}>{saving ? '保存中…' : '保存助手设置'}</button>
  </section>
}
