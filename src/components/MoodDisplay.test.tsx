import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MoodDisplay from './MoodDisplay';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({
        data: {
          ok: true,
          message: 'Vision worker model preflight passed.',
          models: [
            { file: 'tiny_face_detector_model-weights_manifest.json', ok: true, status: 200 },
            { file: 'face_expression_model-weights_manifest.json', ok: true, status: 200 },
          ],
        },
        error: null,
      }),
    },
  },
}));

describe('MoodDisplay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders "Not active" when inactive', () => {
    render(<MoodDisplay emotion={null} confidence={0} expressions={{}} isActive={false} />);
    expect(screen.getByText('Not active')).toBeInTheDocument();
  });

  it('shows the dominant emotion + confidence', () => {
    render(
      <MoodDisplay
        emotion="happy"
        confidence={0.87}
        expressions={{ happy: 0.87, neutral: 0.1, sad: 0.03 }}
        isActive
      />,
    );
    expect(screen.getByText('happy')).toBeInTheDocument();
    expect(screen.getByText('87% confidence')).toBeInTheDocument();
  });

  it('polls vision-diagnostics on mount and renders per-model status', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    render(<MoodDisplay emotion="neutral" confidence={0.5} expressions={{ neutral: 0.5 }} isActive />);
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'vision-diagnostics',
      expect.objectContaining({ body: expect.objectContaining({ origin: expect.any(String) }) }),
    ));
    await waitFor(() => expect(
      screen.getByText('Vision worker model preflight passed.'),
    ).toBeInTheDocument());
  });
});
