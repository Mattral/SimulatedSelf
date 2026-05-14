# Contributing

> Document owner: Min Htet Myet · Last reviewed: 2026-05-14

Thanks for considering a contribution. This project ships to non-technical
users; the bar for UX, accessibility, and reliability is intentionally high.

## 1. Local setup

```bash
bun install
cp .env.example .env.local      # add your Groq key
bun run dev
```

## 2. Coding conventions

- **TypeScript strict.** No `any` in new code unless wrapped in a typed adapter.
- **Hooks own state.** UI components stay declarative; side effects live in hooks.
- **Three.js stays imperative.** Talk to `Scene3D` via its imperative handle.
- **Tailwind tokens only.** No raw hex colors in components — use design tokens
  defined in `src/index.css` and `tailwind.config.ts`.
- **Status enums over booleans** for any flow with three or more states.

## 3. Commit hygiene

- One concern per commit. A refactor and a feature do not share a commit.
- Imperative subject line, ≤ 72 chars (`Add streaming retry to GroqService`).
- Reference the doc you updated when behavior changes
  (`docs/VOICE_PIPELINE.md`).

## 4. Pull-request checklist

- [ ] Build passes (`bun run build`).
- [ ] No new `console.log` left behind (use `console.warn`/`error` with prefix).
- [ ] New env vars documented in `.env.example` + `docs/SECURITY.md`.
- [ ] User-visible changes have a screenshot or short clip in the PR description.
- [ ] If the voice or perception pipeline changed, the relevant doc is updated.

## 5. Review bar

We optimize for:

1. **Reliability** — the demo must survive flaky networks and missing keys.
2. **Latency** — first token < 600 ms; pose loop < 33 ms.
3. **Clarity** — a new engineer should be productive within a day.

If a change trades any of these for cleverness, it does not ship.
