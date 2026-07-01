# AGENTS.md — Fo The Win

This file is the agent-level operating ruleset for the project. Every subagent working on this repo must follow these rules in addition to the full build spec in `systemdesignftw.md`.

## Source of truth

- `systemdesignftw.md` at the repo root is the authoritative build spec.
- Do not change topic IDs, the problem schema, the scoring model, the timing model, or the data model without flagging the deviation and getting explicit approval.
- Topic IDs from Section 6 are frozen. Use them exactly as written, including underscores and group prefixes.

## Secrets

- Never write secrets to the repo.
- All credentials live in `.env.local` (gitignored) and provider dashboards.
- `.env.local.example` may only contain keys with empty values. Never commit real keys, tokens, or passwords.

## Human checkpoints

- Stop and prompt the human at every `HUMAN CHECKPOINT` in Section 19 of `systemdesignftw.md`.
- Never provision Supabase, Vercel, OAuth apps, or any paid service without an explicit answer.
- Never spend money or create accounts on the user's behalf.

## Problem bank quality

- Every generated problem must pass `content/validator.ts` (Section 10.6) before it enters the bank.
- Correct answers must be independently verified by a symbolic or numeric checker. Never trust an answer that came only from a generator.
- Reject and regenerate any problem that fails validation.

## Style and punctuation

- Do not use em dashes anywhere in code comments, documentation, or content. Use hyphens, colons, or sentence breaks instead.
- Keep a high-contrast, distinct visual identity for the game UI; avoid default-looking styling.

## Commits

- Do not run `git commit`, `git push`, `git reset`, `git rebase`, or any other git mutation unless the human explicitly asks for it.
- When asked to commit, inspect `git status`, `git diff`, and recent history first; stage only intended files and never stage secrets.
