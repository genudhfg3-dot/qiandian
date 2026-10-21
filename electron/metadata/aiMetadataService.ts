import type { AiMetadataResult, Entry, SourceInfo } from '../../src/domain/knowledge'
import { generateEntrySummary, generateEntryTitle } from '../../src/utils/title'
import type { AiRuntimeSettings } from './aiSettings'
import { normalizeModelName } from './modelName'

export interface MetadataGenerationInput {
  contentMd: string
  source?: SourceInfo
  tagNames?: string[]
  existingTags?: string[]
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string; reasoning_content?: string }
    finish_reason?: string
  }>
}

const maxTitleLength = 24
const maxSummaryLength = 600
const minUsefulSummaryLength = 20
const requestTimeoutMs = 90_000
const maxInputChars = 12000
const responseMaxTokens = 4096

function safeParseJson(text: string): Partial<AiMetadataResult> {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  const parsed = JSON.parse(trimmed) as Record<string, unknown>
  // 兼容新的字段名 "tags" 和旧的 "suggestedTags"
  return {
    title: parsed.title as string | undefined,
    summary: parsed.summary as string | undefined,
    tags: (parsed.tags ?? parsed.suggestedTags) as string[] | undefined,
  }
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

function isReady(settings: AiRuntimeSettings) {
  return Boolean(settings.enabled && settings.baseUrl.trim() && settings.model.trim() && settings.apiKey.trim())
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function truncate(value: string, maxLength: number) {
  const compacted = compactWhitespace(value)
  if (compacted.length <= maxLength) {
    return compacted
  }
  return compacted.slice(0, maxLength).trim()
}

function truncatePreserveLines(value: string, maxLength: number) {
  const normalized = value
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
  if (normalized.length <= maxLength) {
    return normalized
  }
  return normalized.slice(0, maxLength).trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sourceWords(source?: SourceInfo) {
  return [source?.app, source?.title]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value && value.length <= 32))
}

function removeSourceNoise(value: string, source?: SourceInfo) {
  return sourceWords(source).reduce((current, word) => current.replace(new RegExp(escapeRegExp(word), 'ig'), ''), value)
}

function removeRepeatedFragments(value: string) {
  const parts = compactWhitespace(value)
    .split(/[，,、|｜/\\-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length <= 1) {
    return compactWhitespace(value)
  }
  return Array.from(new Set(parts)).join(' ')
}

export function normalizeSuggestedTags(tags: string[] | undefined, existingTags: string[] = []) {
  const existing = new Set(existingTags.map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean))
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const raw of tags ?? []) {
    const tag = String(raw)
      .replace(/^[#＃]+/, '')
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[，,、|｜/\\]+/g, ' ')
      .trim()
      .slice(0, 16)
    const key = tag.toLocaleLowerCase()
    if (!tag || seen.has(key) || existing.has(key)) {
      continue
    }
    seen.add(key)
    normalized.push(tag)
    if (normalized.length >= 5) {
      break
    }
  }

  return normalized
}

export function normalizeAiMetadata(metadata: Partial<AiMetadataResult>, input: MetadataGenerationInput): AiMetadataResult {
  const fallbackTitle = generateEntryTitle(input.contentMd, input.source)
  const rawTitle = removeRepeatedFragments(removeSourceNoise(metadata.title ?? '', input.source))
    .replace(/[《》"“”'']/g, '')
    .replace(/^(标题|题目)[:：]/, '')
    .trim()
  const title = rawTitle.length >= 2 ? truncate(rawTitle, maxTitleLength) : fallbackTitle

  const fallbackSummary = generateEntrySummary(input.contentMd)
  const rawSummary = (metadata.summary ?? '').replace(/\r\n/g, '\n').replace(/^(摘要|总结)[:：]\s*/, '').trim()
  const summary = rawSummary.length >= minUsefulSummaryLength ? truncatePreserveLines(rawSummary, maxSummaryLength) : fallbackSummary

  return {
    title: title || fallbackTitle,
    summary: summary || fallbackSummary,
    tags: normalizeSuggestedTags(metadata.tags, input.existingTags),
  }
}

export async function generateAiMetadata(
  settings: AiRuntimeSettings,
  input: MetadataGenerationInput,
  fetchImpl: typeof fetch = fetch,
): Promise<AiMetadataResult | null> {
  if (!isReady(settings)) {
    return null
  }

  const trimmedContent =
    input.contentMd.length > maxInputChars
      ? `${input.contentMd.slice(0, maxInputChars)}\n\n[内容已截断，仅展示前 ${maxInputChars} 字符用于生成标题与摘要]`
      : input.contentMd

  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), requestTimeoutMs)

  let response: Response
  try {
    response = await fetchImpl(`${normalizeBaseUrl(settings.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: normalizeModelName(settings.baseUrl, settings.model),
        temperature: 0.2,
        max_tokens: responseMaxTokens,
        messages: [
          {
            role: 'system',
            content: `你是个人知识管理系统的内容标注助手，为用户的"随手记"生成标题、摘要和标签。

要求：
1. 基于完整内容生成。关键信息常在结尾（结论、待办、转折、个人批注），标题和摘要必须反映结尾内容，不能只覆盖开头。
2. 标题：具体到能被检索，包含核心实体/概念/动作，不超过20字。禁止"关于XX的笔记""一些想法"这类空泛标题。
3. 摘要：严格分成三段，段与段之间用换行符 \n 分隔，每段以固定前缀开头——
   - 第一段以"内容总结："开头，用 2-3 句话总结全文要点，保留关键细节（数字、名称、结论），陈述句，不写"本文""这段记录了"等元话语；
   - 第二段以"适用场景："开头，用 1 句话说明什么情况下会用到这条知识；
   - 第三段以"关键词："开头，列 3-6 个检索用词，含原文核心词及同义表述，用"、"分隔。
   三段合计不超过 400 字。输出格式示例：
   "内容总结：...\n适用场景：...\n关键词：..."
4. 标签：2-5个，每个不超过8字，反映核心主题、领域或类型。
   - 能匹配已有标签的必须优先使用，不允许新建。关键词不受此限制。
5. 忠于原文，不补充、不评价。
6. 内容过短或无实质信息时：标题取原文前15字，摘要输出"内容不足"，标签为空。

直接输出纯JSON，不要markdown代码块，不要任何解释：
{"title":"","summary":"","tags":[]}`,
          },
          {
            role: 'user',
            content: `随手记内容：\n${trimmedContent}\n\n已有标签列表：${input.existingTags && input.existingTags.length > 0 ? input.existingTags.join('、') : '无'}`,
          },
        ],
      }),
      signal: controller.signal,
    })
  } catch (error) {
    if ((error as { name?: string } | undefined)?.name === 'AbortError') {
      throw new Error(`AI 请求超时（${requestTimeoutMs / 1000} 秒未返回）。可换用更快的模型，或检查代理是否稳定。`)
    }
    throw new Error(`AI 请求失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearTimeout(timeoutHandle)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`AI 请求失败：HTTP ${response.status}${detail ? `，响应：${detail.slice(0, 400)}` : ''}`)
  }

  const responseText = await response.text()
  let payload: unknown
  let content: string | null = null

  // 尝试解析为 JSON
  try {
    payload = JSON.parse(responseText)
    // 支持多种 JSON 响应格式
    const choice = (payload as ChatCompletionResponse)?.choices?.[0]
    content =
      choice?.message?.content ||  // OpenAI Chat Completion 标准格式（空字符串也跳过）
      choice?.message?.reasoning_content ||  // 推理模型（DeepSeek R1、QwQ 等）的思考过程
      (choice as { text?: string })?.text ||  // OpenAI Completion 格式
      (payload as { content?: string })?.content ||  // 某些提供商的简化格式
      (payload as { result?: string })?.result ||  // 部分国产模型格式
      null

    // 检查是否因 token 限制被截断
    if (choice?.finish_reason === 'length' && !content) {
      console.warn('[AI] 响应因 token 限制被截断，reasoning_content:', choice?.message?.reasoning_content?.slice(0, 200))
    }
  } catch {
    // 非 JSON 响应，可能是纯文本
    payload = { raw: responseText }
  }

  // 如果 JSON 解析后没有 content，但响应本身看起来像有效内容，直接使用原始文本
  if (!content && responseText && !responseText.startsWith('{') && !responseText.startsWith('[')) {
    content = responseText
  }

  if (!content) {
    console.error('[AI] 无法解析响应内容，完整响应:', responseText.slice(0, 1000))
    throw new Error(
      'AI 响应缺少 content 字段，请检查模型是否返回纯文本。' +
      '实际响应：' + responseText.slice(0, 200)
    )
  }

  return normalizeAiMetadata(safeParseJson(content), input)
}

export function toMetadataInput(entry: Entry, existingTags?: string[]): MetadataGenerationInput {
  return {
    contentMd: entry.contentMd,
    source: entry.source,
    tagNames: entry.tags.map((tag) => tag.name),
    existingTags,
  }
}
