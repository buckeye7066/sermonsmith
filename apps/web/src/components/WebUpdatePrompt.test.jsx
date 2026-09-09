// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebUpdatePrompt from './WebUpdatePrompt';
const fetchManifest = vi.hoisted(() => vi.fn());
vi.mock('@/lib/mobileUpdater', () => ({
  BAKED_BUNDLE_VERSION: '1.0.1.100',
  fetchUpdateManifest: fetchManifest,
  isNewerVersion: (candidate, current) => Number(candidate.split('.').at(-1)) > Number(current.split('.').at(-1)),
}));
vi.mock('@/lib/platform', () => ({ isNativeApp: () => false }));
describe('browser update notification', () => {
  beforeEach(() => {
    vi.stubEnv('PROD', true);
    fetchManifest.mockResolvedValue({ version: '1.0.1.101' });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  it('offers a same-package newer build and Later leaves the page running', async () => {
    render(<WebUpdatePrompt />);
    expect(await screen.findByRole('button', { name: 'Update' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });
  it('requires confirmation before reloading unsaved work', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<WebUpdatePrompt />);
    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Save your changes'));
    expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();
  });
  it('does not announce equal versions or a failed network check', async () => {
    fetchManifest.mockResolvedValueOnce({ version: '1.0.1.100' }).mockRejectedValueOnce(new Error('offline'));
    render(<WebUpdatePrompt />);
    await waitFor(() => expect(fetchManifest).toHaveBeenCalled());
    await act(async () => window.dispatchEvent(new Event('online')));
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  });
});
