import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrimaryNav from './PrimaryNav';
import { ordinaryPrimaryNavItems, primaryNavItems } from '../routes/routes';

describe('PrimaryNav', () => {
  it('shows the ordinary ministry workflow links', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PrimaryNav />
      </MemoryRouter>,
    );

    for (const item of ordinaryPrimaryNavItems) {
      const link = screen.getByRole('link', { name: new RegExp(item.label, 'i') });
      expect(link.getAttribute('href')).toBe(item.route);
      expect(screen.getByText(item.description)).toBeTruthy();
    }
  });

  it('does not show admin or developer links in the primary navigation', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PrimaryNav />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/admin/i)).toBeNull();
    expect(screen.queryByText(/developer/i)).toBeNull();
    expect(primaryNavItems.every((item) => item.visibleToOrdinaryUser === true)).toBe(true);
  });
});
