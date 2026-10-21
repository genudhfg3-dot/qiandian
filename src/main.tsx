import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { applyTypographyTheme, readTypographyTheme } from './utils/typographyTheme'

// 在 React 挂载前注入外观方案，避免首屏闪烁。
applyTypographyTheme(readTypographyTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
