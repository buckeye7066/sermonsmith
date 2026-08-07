// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// --- Mock the heavy dependency chain so we test SermonBuilder's own flow,
//     not the network, auth, router, or its child builders. ---
const invokeLLM = vi.fn();
// Streaming is unavailable in the test env, so it throws and the builder falls
// back to InvokeLLM — which is exactly what the assertions below exercise.
const streamLLM = vi.fn(async () => { throw new Error('stream-unavailable-in-test'); });
const createSermon = vi.fn(async (data) => ({ id: 'sermon-1', ...data }));

vi.mock('@/api/apiClient', () => ({
  api: {
    integrations: { Core: { InvokeLLM: (...a) => invokeLLM(...a), StreamLLM: (...a) => streamLLM(...a) } },
    entities: { Sermon: { create: (...a) => createSermon(...a) } },
  },
}));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', denomination: 'Baptist', content_preferences: {} } }),
}));
vi.mock('react-router', () => ({
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
import { toast } from 'sonner';

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

  it('stays clickable and gives clear feedback when required fields are missing', async () => {
    render(<SermonBuilder />);
    const btn = screen.getByRole('button', { name: /Generate Sermon with Larry/i });
    // Intentionally NOT disabled — a silently-disabled button reads as broken;
    // clicking with empty fields surfaces a toast instead.
    expect(btn).toBeEnabled();

    fireEvent.click(btn);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Please provide both a topic and scripture passage'),
    );
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(streamLLM).not.toHaveBeenCalled();
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
    expect(arg.prompt).toContain('<<<USER INPUT>>>');
    expect(arg.prompt).toContain('Grace');
    expect(arg.prompt).toContain('Ephesians 2:8');
    expect(arg.prompt).toContain('<<<END USER INPUT>>>');

    // The normalized sermon is handed to the (stubbed) editor.
    expect(await screen.findByTestId('sermon-editor')).toHaveTextContent('Amazing Grace');
  });

  it('shows daily-limit copy for 429 AI failures', async () => {
    invokeLLM.mockRejectedValueOnce(Object.assign(new Error('raw quota backend text'), { status: 429 }));
    render(<SermonBuilder />);

    fireEvent.change(screen.getByPlaceholderText(/Faith, Grace, Prayer/i), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByPlaceholderText(/John 3:16, Romans/i), { target: { value: 'Ephesians 2:8' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Sermon with Larry/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "You've hit today's AI limit. Upgrade or try again tomorrow."
    ));
  });

  it('shows retry copy for 502 AI failures', async () => {
    invokeLLM.mockRejectedValueOnce(Object.assign(new Error('invalid json internals'), { status: 502 }));
    render(<SermonBuilder />);

    fireEvent.change(screen.getByPlaceholderText(/Faith, Grace, Prayer/i), { target: { value: 'Grace' } });
    fireEvent.change(screen.getByPlaceholderText(/John 3:16, Romans/i), { target: { value: 'Ephesians 2:8' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate Sermon with Larry/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The AI service is busy. Please retry.'));
  });
});
