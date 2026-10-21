import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AboutView } from '../views/AboutView'
import { CaptureButtonView } from '../views/CaptureButtonView'
import { CaptureWindowView } from '../views/CaptureWindowView'
import { KnowledgeBaseView } from '../views/KnowledgeBaseView'
import { SettingsView } from '../views/SettingsView'
import { TagManagementView } from '../views/TagManagementView'
import { AssistantWindowView, AssistantHintView } from '../views/AssistantWindowView'
import { AssistantSelection } from '../components/AssistantSelection'

export function App() {
  return (
    <HashRouter>
      <AssistantSelection />
      <Routes>
        <Route path="/assistant" element={<AssistantWindowView />} />
        <Route path="/assistant-hint" element={<AssistantHintView />} />
        <Route path="/" element={<KnowledgeBaseView />} />
        <Route path="/entries/:id" element={<KnowledgeBaseView />} />
        <Route path="/tags" element={<TagManagementView />} />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="/about" element={<AboutView />} />
        <Route path="/capture" element={<CaptureWindowView />} />
        <Route path="/capture-button" element={<CaptureButtonView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
