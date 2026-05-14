import Groq from 'groq-sdk';

/**
 * GroqService — Conversational AI backed by Groq (Llama 3.1 8B Instant).
 *
 * Capabilities
 * ------------
 *  - `generateResponse`         : one-shot completion (legacy compatibility).
 *  - `generateResponseStream`   : async iterable yielding partial chunks for
 *                                 real-time UI updates.
 *
 * Reliability
 * -----------
 *  - Hard request timeout via AbortController (default 15 s).
 *  - Bounded automatic retries with exponential backoff for transient errors
 *    (network errors, HTTP 5xx, HTTP 429).
 *  - Graceful degradation when the API key is missing or the upstream fails.
 *
 * Security
 * --------
 *  The API key is read from `import.meta.env.VITE_GROQ_API_KEY` and must never
 *  be hard-coded. Because Vite inlines `VITE_*` variables at build time, the
 *  resulting bundle is still client-readable; for production traffic, proxy
 *  these requests through a Lovable Cloud edge function.
 */

export class GroqServiceError extends Error {
  readonly code: 'NOT_CONFIGURED' | 'TIMEOUT' | 'NETWORK' | 'UPSTREAM' | 'UNKNOWN';
  readonly retryable: boolean;
  constructor(
    code: GroqServiceError['code'],
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'GroqServiceError';
    this.code = code;
    this.retryable = retryable;
  }
}

export interface StreamOptions {
  signal?: AbortSignal;
  /** Hard timeout in milliseconds (default 15 000). */
  timeoutMs?: number;
  /** Max retry attempts on transient failures (default 2 = 3 total tries). */
  maxRetries?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const MODEL = 'llama-3.1-8b-instant';
const SYSTEM_PROMPT =
  "You are a friendly humanoid robot assistant created by Min Htet Myet. " +
  "Always respond in 50 words or less. Be warm, concise, and engaging. " +
  "Use plain conversational language suitable for text-to-speech.";

class GroqService {
  private groq: Groq | null = null;
  readonly isConfigured: boolean;

  constructor() {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
    this.isConfigured = Boolean(apiKey);

    if (!apiKey) {
      console.warn(
        '[GroqService] VITE_GROQ_API_KEY is not set. Add it to .env.local to enable AI chat.',
      );
      return;
    }

    this.groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  }

  /** Streaming generation. Yields incremental text chunks as they arrive. */
  async *generateResponseStream(
    userInput: string,
    options: StreamOptions = {},
  ): AsyncGenerator<string, void, void> {
    if (!this.groq) {
      throw new GroqServiceError(
        'NOT_CONFIGURED',
        'AI is not configured. Set VITE_GROQ_API_KEY in your environment.',
      );
    }
    const trimmed = userInput?.trim();
    if (!trimmed) return;

    const {
      signal: externalSignal,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      maxRetries = DEFAULT_MAX_RETRIES,
    } = options;

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
      const onAbort = () => controller.abort('user-cancelled');
      externalSignal?.addEventListener('abort', onAbort);

      try {
        const stream = await this.groq.chat.completions.create(
          {
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: trimmed },
            ],
            model: MODEL,
            temperature: 0.8,
            max_completion_tokens: 256,
            top_p: 1,
            stream: true,
          },
          { signal: controller.signal },
        );

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        }
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', onAbort);
        return;
      } catch (err) {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', onAbort);

        const mapped = mapError(err, controller.signal.aborted, externalSignal?.aborted);

        // Don't retry user cancellations or non-retryable errors.
        if (!mapped.retryable || externalSignal?.aborted || attempt >= maxRetries) {
          throw mapped;
        }
        const backoff = Math.min(2_000, 300 * 2 ** attempt);
        await delay(backoff);
        attempt += 1;
      }
    }
  }

  /** One-shot, non-streaming completion. */
  async generateResponse(userInput: string, options?: StreamOptions): Promise<string> {
    let acc = '';
    for await (const chunk of this.generateResponseStream(userInput, options)) {
      acc += chunk;
    }
    return acc.trim() || "I'm sorry, I couldn't generate a response.";
  }
}

function mapError(
  err: unknown,
  controllerAborted: boolean,
  externalAborted: boolean | undefined,
): GroqServiceError {
  if (externalAborted) {
    return new GroqServiceError('NETWORK', 'Request cancelled.', false);
  }
  if (controllerAborted) {
    return new GroqServiceError('TIMEOUT', 'AI took too long to respond.', true);
  }
  const anyErr = err as { status?: number; message?: string };
  const status = anyErr?.status;
  if (status === 429 || (status && status >= 500)) {
    return new GroqServiceError('UPSTREAM', `Upstream error (${status}).`, true);
  }
  if (status && status >= 400 && status < 500) {
    return new GroqServiceError('UPSTREAM', anyErr.message ?? 'Bad request.', false);
  }
  if (err instanceof TypeError) {
    return new GroqServiceError('NETWORK', 'Network error.', true);
  }
  return new GroqServiceError('UNKNOWN', anyErr?.message ?? 'Unknown error.', false);
}

function delay(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms));
}

// Backwards-compatible export name used across the app.
export const geminiService = new GroqService();
export const groqService = geminiService;
