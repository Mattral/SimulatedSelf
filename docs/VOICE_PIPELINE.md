# Voice Pipeline

> Document owner: Min Htet Myet · Last reviewed: 2026-05-14

## 1. State machine

The voice pipeline is implemented as an explicit finite state machine in
`src/hooks/useVoiceInteraction.ts`.

```text
                ┌──────────┐    user taps mic     ┌────────────┐
                │   idle   │ ───────────────────▶ │ listening  │
                └──────────┘                      └────────────┘
                     ▲                                  │
                     │ TTS finished / error              │ final transcript
                     │                                   ▼
                ┌──────────┐    first token       ┌────────────┐
                │ speaking │ ◀────── stream ◀──── │ processing │
                └──────────┘                      └────────────┘
                     ▲                                  │
                     │ stream complete                  │ error
                     │                                  ▼
                ┌──────────┐                      ┌────────────┐
                │streaming │ ─────── error ─────▶ │   error    │
                └──────────┘                      └────────────┘
                                                        │
                                                        │ retry
                                                        ▼
                                                  (back to processing)
```

Every transition is observable from the UI via the exported `status` value,
so the HUD never invents state from booleans.

## 2. Streaming contract

`GroqService.generateResponseStream(input, options)` returns an
`AsyncGenerator<string>`. Consumers must:

1. Treat each yielded chunk as **append-only** text.
2. Reset accumulated state on a fresh call.
3. Honor cancellation via the optional `AbortSignal`.

## 3. Reliability features

| Concern        | Mechanism                                                                 |
|----------------|----------------------------------------------------------------------------|
| Hang on flaky network | `AbortController` triggered by a 15 s timeout (`timeoutMs`).        |
| User cancellation     | External `AbortSignal` propagated into the SDK call.                |
| Transient 5xx / 429   | Bounded exponential backoff: 300 ms → 600 ms → 1.2 s, max 2 retries.|
| Permanent 4xx         | Surfaced as `GroqServiceError` with `retryable = false`.            |
| Missing API key       | Constructor warns; calls reject with `code = NOT_CONFIGURED`.       |

## 4. Error taxonomy

```ts
type ErrorCode = 'NOT_CONFIGURED' | 'TIMEOUT' | 'NETWORK' | 'UPSTREAM' | 'UNKNOWN';
```

The UI uses `code` to choose the icon, copy, and whether to show a Retry
button. `retryable` is the single source of truth for retry affordance.

## 5. UI contract

`VoiceChatPanel` consumes the hook output and never recomputes status from
implicit signals. This guarantees that:

- Streaming text is shown only while `status === 'streaming'`.
- The Retry button appears **only** when `status === 'error'` **and**
  `lastError.retryable === true`.
- The Cancel button appears while `status` ∈ {`processing`, `streaming`}.

## 6. Text-to-Speech

We deliberately wait for the full reply before speaking. Sentence-level TTS
sounds choppy with the Web Speech API on most browsers; the perceived UX
gain from streaming TTS is small relative to the regression in prosody.
Streaming text in the HUD already provides the "live" feedback users want.
