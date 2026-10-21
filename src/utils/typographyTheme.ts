// 正文外观方案切换：通过 <html data-typography="d|e|f"> 属性驱动 CSS 切换三套标题/正文样式。
// 选择持久化到 localStorage，启动时由 main.tsx 调用 applyTypographyTheme(readTypographyTheme()) 注入。

export type TypographyTheme = 'd' | 'e' | 'f'

const TYPOGRAPHY_THEME_KEY = 'personal-knowledge-base:typography-theme:v1'
const DEFAULT_TYPOGRAPHY_THEME: TypographyTheme = 'd'

export interface TypographyThemeOption {
  value: TypographyTheme
  label: string
  description: string
}

export const TYPOGRAPHY_THEME_OPTIONS: TypographyThemeOption[] = [
  { value: 'd', label: 'D', description: '底线粗细' },
  { value: 'e', label: 'E', description: '色彩字重' },
  { value: 'f', label: 'F', description: '彩色锚点' },
]

export function readTypographyTheme(): TypographyTheme {
  if (typeof window === 'undefined') return DEFAULT_TYPOGRAPHY_THEME
  const raw = window.localStorage.getItem(TYPOGRAPHY_THEME_KEY)
  return raw === 'd' || raw === 'e' || raw === 'f' ? raw : DEFAULT_TYPOGRAPHY_THEME
}

export function applyTypographyTheme(theme: TypographyTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-typography', theme)
}

export function writeTypographyTheme(theme: TypographyTheme): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TYPOGRAPHY_THEME_KEY, theme)
  applyTypographyTheme(theme)
}
