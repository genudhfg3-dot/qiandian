import type { CSSProperties, ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AboutView } from '../views/AboutView'
import { CaptureButtonView } from '../views/CaptureButtonView'
import { CaptureWindowView } from '../views/CaptureWindowView'
import { KnowledgeBaseView } from '../views/KnowledgeBaseView'
import { SettingsView } from '../views/SettingsView'
import { TagManagementView } from '../views/TagManagementView'

const dragRegionStyle = { WebkitAppRegion: 'drag', appRegion: 'drag' } as CSSProperties

function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isMainWindowRoute =
    pathname === '/' || pathname === '/tags' || pathname === '/settings' || pathname === '/about' || pathname.startsWith('/entries/')

  if (!isMainWindowRoute) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen flex-col bg-cream">
      <div style={dragRegionStyle} className="h-8 shrink-0 bg-cream" />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  )
}

export function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<KnowledgeBaseView />} />
          <Route path="/entries/:id" element={<KnowledgeBaseView />} />
          <Route path="/tags" element={<TagManagementView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="/about" element={<AboutView />} />
          <Route path="/capture" element={<CaptureWindowView />} />
          <Route path="/capture-button" element={<CaptureButtonView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}
