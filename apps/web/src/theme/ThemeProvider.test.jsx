import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider, THEME_STORAGE_KEY, useTheme } from './ThemeProvider.jsx'

function ThemeProbe() {
  const { mode, toggleTheme } = useTheme()

  return (
    <button type="button" onClick={toggleTheme}>
      Theme is {mode}
    </button>
  )
}

function renderThemeProbe() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.style.colorScheme = ''

    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })))
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.localStorage.clear()
    document.documentElement.className = ''
    document.documentElement.style.colorScheme = ''
  })

  it('switches from light to dark and saves the choice in localStorage', () => {
    renderThemeProbe()

    expect(screen.getByRole('button', { name: /theme is light/i })).toBeInTheDocument()
    expect(document.documentElement).not.toHaveClass('dark')

    fireEvent.click(screen.getByRole('button', { name: /theme is light/i }))

    expect(screen.getByRole('button', { name: /theme is dark/i })).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')

    const savedPreference = JSON.parse(window.localStorage.getItem(THEME_STORAGE_KEY))
    expect(savedPreference).toMatchObject({
      mode: 'dark',
      isDefault: false,
    })
    expect(typeof savedPreference.persistedAt).toBe('string')
  })

  it('restores a saved dark theme after the provider is mounted again', () => {
    window.localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({
        mode: 'dark',
        isDefault: false,
        persistedAt: '2026-08-15T00:00:00.000Z',
      }),
    )

    const firstRender = renderThemeProbe()

    expect(screen.getByRole('button', { name: /theme is dark/i })).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')

    firstRender.unmount()
    document.documentElement.className = ''

    renderThemeProbe()

    expect(screen.getByRole('button', { name: /theme is dark/i })).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')
  })

  it('keeps working when localStorage cannot be read or written', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage is not available')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage is not available')
    })

    expect(() => renderThemeProbe()).not.toThrow()

    expect(screen.getByRole('button', { name: /theme is light/i })).toBeInTheDocument()

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /theme is light/i }))
    }).not.toThrow()

    expect(screen.getByRole('button', { name: /theme is dark/i })).toBeInTheDocument()
    expect(document.documentElement).toHaveClass('dark')
  })
})
