export interface AssistantImage { id: string; dataUrl: string }
export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  images: AssistantImage[]
  status?: 'streaming' | 'done' | 'error' | 'stopped'
  firstTokenMs?: number
  totalMs?: number
}
export interface AssistantState {
  messages: AssistantMessage[]
  images: AssistantImage[]
  draft: string
  busy: boolean
  error: string
  model: string
  pinned: boolean
  incoming: { text: string; images: AssistantImage[]; action?: string } | null
}
export interface AssistantPreferences { screenshotHints: boolean; shortcut: string; shortcutError: string }
export interface AssistantApi {
  open(text?: string, action?: string): Promise<void>
  menu(): Promise<void>
  state(): Promise<AssistantState>
  send(text: string): Promise<void>
  draft(text: string): Promise<void>
  cancel(): Promise<void>
  retry(): Promise<void>
  reset(): Promise<void>
  clipboard(): Promise<void>
  image(dataUrl: string): Promise<void>
  removeImage(id: string): Promise<void>
  acceptIncoming(mode: 'add' | 'new' | 'dismiss'): Promise<void>
  hide(): Promise<void>
  pin(): Promise<void>
  settings(): Promise<void>
  preferences(): Promise<AssistantPreferences>
  updatePreferences(input: Pick<AssistantPreferences, 'screenshotHints' | 'shortcut'>): Promise<AssistantPreferences>
  hint(action: 'translate' | 'ask' | 'dismiss'): Promise<void>
  save(input: { messageId: string; title: string; text: string; includeOriginal: boolean; tagNames: string[] }): Promise<string>
  onState(callback: (state: AssistantState) => void): () => void
  onDelta(callback: (delta: { id: string; text: string; firstTokenMs?: number }) => void): () => void
}
