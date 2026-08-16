import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import ScreenErrorBoundary from './components/ScreenErrorBoundary.jsx'
import './index.css'
import { ThemeProvider } from './theme/ThemeProvider.jsx'

function applySavedThemeBeforeRender() {
  try {
    const stored = window.localStorage.getItem('sermonsmith.theme')
    if (!stored) return

    const parsed = JSON.parse(stored)
    if (parsed?.mode === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.style.colorScheme = 'dark'
    } else if (parsed?.mode === 'light') {
      document.documentElement.classList.remove('dark')
      document.documentElement.style.colorScheme = 'light'
    }
  } catch {
    // If saved settings cannot be read, the ThemeProvider will choose a safe default.
  }
}

applySavedThemeBeforeRender()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ScreenErrorBoundary>
          <App />
        </ScreenErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
