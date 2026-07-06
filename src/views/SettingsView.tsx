import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AiSettings, AiSettingsUpdateInput } from '../domain/knowledge'

const emptySettings: AiSettings = {
  enabled: false,
  baseUrl: '',
  model: '',
  sendSourceUrl: false,
  apiKeyConfigured: false,
}

export function SettingsView() {
  const [settings, setSettings] = useState<AiSettings>(emptySettings)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [clearApiKey, setClearApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.settingsApi
      ?.getAiSettings()
      .then((nextSettings) => {
        if (!cancelled) setSettings(nextSettings)
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : '设置读取失败')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const payload = useMemo<AiSettingsUpdateInput>(
    () => ({
      enabled: settings.enabled,
      baseUrl: settings.baseUrl,
      model: settings.model,
      sendSourceUrl: settings.sendSourceUrl,
      apiKey: apiKeyInput.trim() || undefined,
      clearApiKey,
    }),
    [apiKeyInput, clearApiKey, settings.baseUrl, settings.enabled, settings.model, settings.sendSourceUrl],
  )

  const saveSettings = async () => {
    setIsSaving(true)
    setNotice(null)
    setError(null)
    try {
      const saved = await window.settingsApi?.updateAiSettings(payload)
      if (saved) setSettings(saved)
      setApiKeyInput('')
      setClearApiKey(false)
      setNotice('AI 设置已保存。')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '设置保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  const testSettings = async () => {
    setIsTesting(true)
    setNotice(null)
    setError(null)
    try {
      const result = await window.settingsApi?.testAiSettings(payload)
      if (result?.ok) {
        setNotice(result.message)
      } else {
        setError(result?.message ?? '连接测试失败')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '连接测试失败')
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-cream px-6 pb-6">
      <div className="mx-auto grid max-w-6xl grid-cols-[200px_1fr] overflow-hidden rounded-[10px] border border-hairline bg-surface">
        <aside className="border-r border-hairline px-3 py-4">
          <div className="grid gap-1">
            <Link to="/" className="rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink">返回知识库</Link>
            <Link to="/tags" className="rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink">标签管理</Link>
            <span className="rounded-[4px] bg-ink px-2 py-1.5 text-[12px] font-medium text-cream">AI 设置</span>
            <Link to="/about" className="rounded-[4px] px-2 py-1.5 text-[12px] text-soft-ink hover:bg-cream-soft hover:text-ink">关于千点</Link>
          </div>
        </aside>

        <main className="px-5 py-5">
          <h1 className="font-serif text-[24px] font-medium text-ink">AI 标题与摘要</h1>
          <p className="mt-1 text-[13px] text-soft-ink">默认关闭。启用后仍先写入本机 SQLite，再排队生成标题和摘要。</p>

          {isLoading ? <div className="mt-4 text-[13px] text-soft-ink">正在读取设置...</div> : null}
          {error ? <div className="mt-4 rounded-[6px] border border-hairline bg-cream-soft px-4 py-3 text-[13px] text-terracotta">{error}</div> : null}
          {notice ? <div className="mt-4 rounded-[6px] border border-hairline bg-cream-soft px-4 py-3 text-[13px] text-teal-deep">{notice}</div> : null}

          <div className="mt-5 grid max-w-2xl gap-4">
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} />
              启用 AI 标题与摘要
            </label>

            <label className="grid gap-1 text-[12px] text-faint">
              API Base URL
              <input value={settings.baseUrl} onChange={(event) => setSettings((current) => ({ ...current, baseUrl: event.target.value }))} className="rounded-[4px] border border-hairline bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-soft-ink" placeholder="例如 https://api.openai.com/v1" />
            </label>

            <label className="grid gap-1 text-[12px] text-faint">
              模型名
              <input value={settings.model} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))} className="rounded-[4px] border border-hairline bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-soft-ink" placeholder="例如 gpt-4.1-mini" />
            </label>

            <div className="grid gap-2 rounded-[6px] border border-hairline bg-cream-soft/40 p-3">
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-faint">API Key</span>
                <span className={settings.apiKeyConfigured && !clearApiKey ? 'text-teal-deep' : 'text-terracotta'}>{settings.apiKeyConfigured && !clearApiKey ? '已配置' : '未配置'}</span>
              </div>
              <input type="password" value={apiKeyInput} onChange={(event) => { setApiKeyInput(event.target.value); setClearApiKey(false) }} className="rounded-[4px] border border-hairline bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-soft-ink" placeholder="输入新 Key 后保存；读取设置时不会反显" />
              <label className="flex items-center gap-2 text-[12px] text-soft-ink">
                <input type="checkbox" checked={clearApiKey} onChange={(event) => { setClearApiKey(event.target.checked); if (event.target.checked) setApiKeyInput('') }} />
                清除本机已保存的 API Key
              </label>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={settings.sendSourceUrl} onChange={(event) => setSettings((current) => ({ ...current, sendSourceUrl: event.target.checked }))} />
              允许发送来源 URL
            </label>

            <div className="rounded-[6px] border border-hairline bg-cream-soft/55 px-4 py-3 text-[12px] leading-[1.7] text-soft-ink">
              禁用时不会发起 AI 请求。启用后会发送正文、来源应用、来源标题和标签；来源 URL 只有勾选后才会发送。AI 建议标签会先归一化，不会自动创建，后续需确认后再写入标签体系。
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveSettings()} disabled={isSaving || isTesting} className="rounded-[4px] bg-ink px-4 py-2 text-[13px] font-medium text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {isSaving ? '保存中' : '保存设置'}
              </button>
              <button type="button" onClick={() => void testSettings()} disabled={isSaving || isTesting} className="rounded-[4px] border border-hairline px-4 py-2 text-[13px] font-medium text-soft-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-50">
                {isTesting ? '测试中' : '测试连接'}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
