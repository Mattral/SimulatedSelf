# Security

> Document owner: Min Htet Myet · Last reviewed: 2026-05-14

## 1. Threat model summary

Simulated Self runs entirely client-side. The privacy and security boundary
is **the user's browser**. The only outbound traffic is the Groq HTTPS
endpoint used by the chat feature.

| Asset                     | Threat                              | Mitigation                                            |
|---------------------------|-------------------------------------|--------------------------------------------------------|
| Camera/microphone stream  | Exfiltration                        | Never uploaded; processed in-browser only.             |
| Groq API key              | Theft via repo / bundle             | `.env.local` (gitignored); rotation guidance below.    |
| User prompts              | Logged by upstream                  | Documented in privacy notice; user consent required.   |
| Browser dependencies      | Supply-chain compromise             | Pinned versions in `package.json`; `bun audit` in CI.  |

## 2. Secret handling

- Keys are read from `import.meta.env.VITE_GROQ_API_KEY`.
- `.env.local` is listed in `.gitignore`. Never commit real keys.
- `.env.example` documents the variable name with a placeholder value.

> ⚠️ **Vite caveat.** Variables prefixed with `VITE_` are inlined into the
> client bundle at build time. They are visible to anyone who downloads the
> site. This is acceptable for low-risk demo usage but **not** for
> production keys. For production:
>
> 1. Move the Groq call into a **Lovable Cloud edge function**.
> 2. Store the key as a server-side secret (`add_secret`).
> 3. Have the browser POST `{ prompt }` to the function and stream the
>    response back via SSE/fetch streaming.

## 3. Rotation playbook

If a key is suspected compromised:

1. Revoke the old key in the Groq console.
2. Issue a new key.
3. Update `.env.local` (and any deployment secret store).
4. Restart `bun run dev` so Vite re-reads the env file.
5. Audit Groq usage logs for anomalous calls between issue and revocation.

## 4. Browser permissions

The app requests:

- **Camera** — required for pose, hand, and emotion detection.
- **Microphone** — required for voice chat.

Both are gated behind an explicit `PermissionHandler` screen so users know
*why* before granting. Revoking either at any time gracefully degrades the
relevant pipeline without crashing the app.

## 5. Dependencies

- Run `bun audit` (or `npm audit`) before each release.
- Avoid adding packages that touch `eval`, `dangerouslySetInnerHTML`, or
  shell out at install time.
- The Groq SDK is loaded with `dangerouslyAllowBrowser: true` — this flag
  acknowledges the bundle-exposure caveat above and is **not** a blanket
  invitation to put more secrets in the client.
