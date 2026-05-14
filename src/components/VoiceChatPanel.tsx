import React from 'react';
import type { VoiceChatStatus, VoiceChatError } from '../hooks/useVoiceInteraction';

interface VoiceChatPanelProps {
  status: VoiceChatStatus;
  isConfigured: boolean;
  transcribedText: string;
  partialResponse: string;
  lastResponse: string;
  lastError: VoiceChatError | null;
  onCancel: () => void;
  onRetry: () => void;
}

const STATUS_META: Record<VoiceChatStatus, { label: string; dot: string; ring: string }> = {
  idle:       { label: 'Ready',         dot: 'bg-slate-400',  ring: 'ring-slate-400/30' },
  listening:  { label: 'Listening…',    dot: 'bg-rose-400 animate-pulse',   ring: 'ring-rose-400/40' },
  processing: { label: 'Thinking…',     dot: 'bg-amber-400 animate-pulse',  ring: 'ring-amber-400/40' },
  streaming:  { label: 'Generating…',   dot: 'bg-cyan-400 animate-pulse',   ring: 'ring-cyan-400/40' },
  speaking:   { label: 'Speaking',      dot: 'bg-emerald-400 animate-pulse', ring: 'ring-emerald-400/40' },
  error:      { label: 'Error',         dot: 'bg-red-500',    ring: 'ring-red-500/40' },
};

/**
 * VoiceChatPanel — glass-morphism HUD that surfaces every state of the voice
 * pipeline (idle → listening → processing → streaming → speaking → error).
 *
 * Designed to feel like a piece of in-flight Apple/Disney UI: rounded glass,
 * soft shadows, animated status dot, monospace caret while tokens stream.
 */
export const VoiceChatPanel: React.FC<VoiceChatPanelProps> = ({
  status,
  isConfigured,
  transcribedText,
  partialResponse,
  lastResponse,
  lastError,
  onCancel,
  onRetry,
}) => {
  const meta = STATUS_META[status];
  const showStreaming = status === 'streaming' && partialResponse;
  const showFinal = (status === 'speaking' || status === 'idle') && lastResponse;
  const showError = status === 'error' && lastError;

  if (
    status === 'idle' &&
    !transcribedText &&
    !lastResponse &&
    !lastError &&
    isConfigured
  ) {
    return null;
  }

  return (
    <div className="w-72 max-w-[80vw] rounded-2xl border border-white/15 bg-white/5 p-4 text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <header className={`mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/70`}>
        <span className={`inline-block h-2 w-2 rounded-full ring-4 ${meta.dot} ${meta.ring}`} />
        <span>{meta.label}</span>
        {(status === 'processing' || status === 'streaming') && (
          <button
            onClick={onCancel}
            className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium tracking-wider hover:bg-white/20"
          >
            Cancel
          </button>
        )}
      </header>

      {!isConfigured && (
        <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-2 text-xs text-amber-100">
          AI is not configured. Add <code className="font-mono">VITE_GROQ_API_KEY</code> to your environment.
        </p>
      )}

      {transcribedText && (
        <section className="mb-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-white/50">You</p>
          <p className="text-sm leading-snug text-white/90">{transcribedText}</p>
        </section>
      )}

      {showStreaming && (
        <section>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-cyan-300/80">Assistant · live</p>
          <p className="text-sm leading-snug text-cyan-50">
            {partialResponse}
            <span className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 animate-pulse bg-cyan-300" />
          </p>
        </section>
      )}

      {showFinal && (
        <section>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-emerald-300/80">Assistant</p>
          <p className="text-sm leading-snug text-emerald-50">{lastResponse}</p>
        </section>
      )}

      {status === 'processing' && !showStreaming && (
        <div className="flex items-center gap-2 text-xs text-white/70">
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:-0.2s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70 [animation-delay:-0.1s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/70" />
          </span>
          Contacting AI…
        </div>
      )}

      {showError && (
        <section className="rounded-lg border border-red-400/30 bg-red-500/10 p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-red-200">
            {lastError!.code === 'TIMEOUT' ? 'Timed out' : 'Error'}
          </p>
          <p className="mb-2 text-xs text-red-50">{lastError!.message}</p>
          {lastError!.retryable && (
            <button
              onClick={onRetry}
              className="rounded-full bg-red-400/20 px-3 py-1 text-xs font-medium text-red-50 hover:bg-red-400/30"
            >
              Try again
            </button>
          )}
        </section>
      )}
    </div>
  );
};

export default VoiceChatPanel;
