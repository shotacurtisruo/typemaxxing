import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/Auth.tsx'

// Dev only: browsers pause requestAnimationFrame in hidden tabs, which freezes
// the 3D scene when previewing in an embedded/hidden pane. Fall back to a
// timer so the game keeps rendering during automated verification.
if (import.meta.env.DEV) {
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = (cb: FrameRequestCallback): number =>
    document.hidden ? (setTimeout(() => cb(performance.now()), 33) as unknown as number) : raf(cb)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
