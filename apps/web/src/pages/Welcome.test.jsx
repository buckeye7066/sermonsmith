import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Welcome from './Welcome';
import { ASSISTANTS } from '../data/assistants';

afterEach(() => cleanup());

describe('Welcome (Home) page', () => {
  function renderHome() {
    render(
      <MemoryRouter>
        <Welcome />
      </MemoryRouter>,
    );
  }

  it('shows a clear headline and a one-sentence purpose', () => {
    renderHome();
    expect(screen.getByRole('heading', { name: /welcome to sermonsmith/i })).toBeInTheDocument();
    expect(screen.getByText(/calm, plain-language workspace/i)).toBeInTheDocument();
  });

  it('shows obvious Read, Study, and Build starting buttons', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /start reading/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start studying/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start building/i })).toBeInTheDocument();
  });

  it('describes Larry and Arlynn each in one plain sentence', () => {
    renderHome();
    for (const assistant of ASSISTANTS) {
      expect(screen.getAllByText(assistant.name).length).toBeGreaterThan(0);
      expect(screen.getByText(assistant.oneLineDescription)).toBeInTheDocument();
    }
  });
});
