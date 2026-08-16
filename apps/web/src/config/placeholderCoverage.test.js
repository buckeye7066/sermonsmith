import { describe, expect, it } from 'vitest'
import { navItems } from './navItems.js'
import { getPlaceholderContent, placeholderContents } from './placeholders.js'

describe('primary navigation placeholder coverage', () => {
  it('has friendly placeholder content for every not-yet-built workflow area', () => {
    const notYetBuiltItems = navItems.filter((item) => item.isBuilt === false)

    expect(notYetBuiltItems.length).toBeGreaterThan(0)

    for (const item of notYetBuiltItems) {
      const matchingPlaceholder = placeholderContents.find((content) => content.route === item.route)

      expect(matchingPlaceholder, `${item.label} needs placeholder content`).toBeTruthy()
      expect(matchingPlaceholder.areaName).toBe(item.label)
      expect(matchingPlaceholder.comingSoonMessage.trim().length).toBeGreaterThan(20)
      expect(matchingPlaceholder.whatYouCanDoNow.trim().length).toBeGreaterThan(20)
    }
  })

  it('returns a plain-language fallback when a placeholder record is missing', () => {
    const fallback = getPlaceholderContent('/a-page-that-is-not-ready-yet')

    expect(fallback.areaName).toBe('This area')
    expect(fallback.comingSoonMessage).toMatch(/still being prepared/i)
    expect(fallback.whatYouCanDoNow).toMatch(/go back home/i)
  })

  it('keeps admin and developer-only links out of the primary navigation', () => {
    const visibleRoutesAndLabels = navItems
      .map((item) => `${item.label} ${item.route} ${item.id}`.toLowerCase())
      .join(' ')

    expect(visibleRoutesAndLabels).not.toMatch(/admin/)
    expect(visibleRoutesAndLabels).not.toMatch(/developer/)
    expect(visibleRoutesAndLabels).not.toMatch(/function tester/)
    expect(visibleRoutesAndLabels).not.toMatch(/reviewer/)
  })
})
