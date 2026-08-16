import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HomeWorkspace, { assistants } from './HomeWorkspace';

function renderHome() {
  return render(
    <MemoryRouter>
      <HomeWorkspace />
    </MemoryRouter>,
  );
}

describe('HomeWorkspace', () => {
  it('shows a clear headline and a one-sentence purpose', () => {
    renderHome();
    expect(
      screen.getByRole('heading', { name: /welcome to sermonsmith/i, level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /calm, plain-language workspace for reading scripture, studying, and building/i,
      ),
    ).toBeInTheDocument();
  });

  it('offers three obvious starting points: Read, Study, and Build', () => {
    renderHome();
    expect(
      screen.getByRole('button', { name: /read scripture/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /study/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /build a message/i }),
    ).toBeInTheDocument();
  });

  it('describes Larry and Arlynn each in one plain sentence', () => {
    renderHome();
    expect(
      screen.getByRole('heading', { name: /larry/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /arlynn/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/helps you draft one sermon or lesson/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/helps you plan a whole series/i),
    ).toBeInTheDocument();
  });

  it('exports assistant data with the required plain-language fields', () => {
    const names = assistants.map((a) => a.name);
    expect(names).toContain('Larry');
    expect(names).toContain('Arlynn');
    assistants.forEach((a) => {
      expect(a.oneLineDescription.length).toBeGreaterThan(0);
      expect(a.role.length).toBeGreaterThan(0);
    });
  });
});
