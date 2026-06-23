// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// --- Mock the heavy dependency chain so we test SermonBuilder's own flow,
//     not the network, auth, router, or its child builders. ---
const invokeLLM = vi.fn();
const createSermon = vi.fn(async (data) => ({ id: 'sermon-1', ...data }));

vi.mock('@/api/apiClient', () => ({
  api: {
    integrations: { Core: { InvokeLLM: (...a) => invokeLLM(...a) } },
    entities: { Sermon: { create: (...a) => createSermon(...a) } },
  },
}));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', denomination: 'Baptist', content_preferences: {} } }),
}));
vi.mock('react-router-dom', () => ({
  Link: ({ children }) => <a href="#">{children}</a>,
}));
vi.mock('@/utils', () => ({ createPageUrl: (s) => `/${s}` }));
vi.mock('@/lib/logError', () => ({ logError: vi.fn() }));
vi.mock('@/components/admin/UserActivityLogger', () => ({ logActivity: vi.fn() }));
vi.mock('@/components/sermon/SermonEditor', () => ({
  default: ({ sermonData }) => <div data-testid="sermon-editor">editor:{sermonData?.title}</div>,
}));
vi.mock('@/components/sermon/SeriesBuilder', () => ({ default: () => <div>series-builder</div> }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import SermonBuilder from '@/pages/SermonBuilder';

const validSermon = {
  title: 'Amazing Grace',
  big_idea: 'Grace is a free gift.',
  theological_notes: 'Baptist perspective.',
  points: [{ title: 'Grace defined', exegesis: 'x', illustration: 'y', application: 'z', supporting_scriptures: ['Ephesians 2:8'] }],
  conclusion: 'Respond to grace.',
};

describe('SermonBuilder UI flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders the builder form', () => {
    render(<SermonBuilder />);
    expect(screen.getByPlaceholderText(/Faith, Grace, Prayer/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate Sermon with Larry/i })).toBeInTheDocument();
  });

  it('keeps the generate button disabled until BOTH topic and passage are set', () => {
    render(<SermonBuilder />);
    const btn = screen.getByRole('button', { name: /Generate Sermon with Larry/i });
    expect(btn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Faith, Grace, Prayer/i), { target: { value: 'Grace' } });
    expect(btn).toBeDisabled(); // topic only — still blocked

    fireEvent.change(screen.getByPlaceholderText(/John 3:16, Romans/i), { target: { value: 'Ephesians 2:8' } });
    expect(btn).toBeEnabled();
  });

  it('calls Larry and renders the editor once a topic + passage are given', async () => {
    invokeLLM.mockResolvedValueOnce(validSermon);
    render(<SermonBuilder />);

    fireEvent.change(screen.getByPlaceholderText(/Faith, Grace, Prayer/i), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByPlaceholderText(/John 3:16, Romans/i), { target: { value: 'Ephesians 2:8' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Sermon with Larry/i }));

    await waitFor(() => expect(invokeLLM).toHaveBeenCalledTimes(1));
    // Larry's call carries a system prompt and the structured-output schema.
    const arg = invokeLLM.mock.calls[0][0];
    expect(arg).toHaveProperty('system_prompt');
    expect(arg).toHaveProperty('response_json_schema');

    // The normalized sermon is handed to the (stubbed) editor.
    expect(await screen.findByTestId('sermon-editor')).toHaveTextContent('Amazing Grace');
  });
});
