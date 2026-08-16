import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.jsx'
import { navItems } from './config/navItems.js'
import { placeholders } from './config/placeholders.js'
import { ThemeProvider, themeStorageKey } from './theme/ThemeProvider.jsx'

function renderAt(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('SermonSmith navigation shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''
  })

  it('shows the Home page with a clear purpose and three obvious starting buttons', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: /prepare sermons and bible lessons from scripture to preaching/i })).toBeTruthy()
    expect(screen.getByText(/calm, plain-language workspace for reading scripture, studying it, and building a message/i)).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /read scripture/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /study/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: /build sermon\/lesson/i }).length).toBeGreaterThan(0)
  })

  it('explains Larry and Arlynn in plain language on Home', () => {
    renderAt('/')

    expect(screen.getByText(/larry helps you draft one sermon or bible lesson/i)).toBeTruthy()
    expect(screen.getByText(/arlynn helps you plan a multi-week sermon or teaching series/i)).toBeTruthy()
  })

  it('renders a page for every primary navigation route', () => {
    navItems.forEach((item) => {
      const { unmount } = renderAt(item.route)
      expect(screen.getByRole('heading', { name: new RegExp(item.label.replace('/', '\\/'), 'i') })).toBeTruthy()
      unmount()
    })
  })

  it('does not show admin or developer-only links in the primary navigation', () => {
    renderAt('/')

    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /developer/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /function tester/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /import status/i })).toBeNull()
  })

  it('shows friendly placeholder content for every not-yet-built area', () => {
    navItems
      .filter((item) => !item.isBuilt)
      .forEach((item) => {
        const matchingPlaceholder = placeholders.find((placeholder) => placeholder.route === item.route)
        expect(matchingPlaceholder).toBeTruthy()

        const { unmount } = renderAt(item.route)
        expect(screen.getByText(/coming soon/i)).toBeTruthy()
        expect(screen.getByText(/what you can do right now/i)).toBeTruthy()
        expect(screen.getByRole('link', { name: /back to home/i })).toBeTruthy()
        unmount()
      })
  })

  it('shows a friendly not-found page for unknown routes', () => {
    renderAt('/not-a-real-place')

    expect(screen.getByRole('heading', { name: /we could not find that page/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /back to home/i })).toBeTruthy()
  })

  it('switches between light and dark and saves the choice', () => {
    renderAt('/')

    const darkButton = screen.getByRole('button', { name: /switch to dark theme/i })
    fireEvent.click(darkButton)

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(themeStorageKey)).mode).toBe('dark')

    const lightButton = screen.getByRole('button', { name: /switch to light theme/i })
    fireEvent.click(lightButton)

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(JSON.parse(window.localStorage.getItem(themeStorageKey)).mode).toBe('light')
  })
})
