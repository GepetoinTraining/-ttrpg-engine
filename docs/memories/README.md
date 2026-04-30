# Project memories — version-controlled

This folder mirrors `~/.claude/projects/D---ttrpg-engine/memory/` so the auto-memory state lives in the repo and travels through GitHub between machines.

**[`MEMORY.md`](MEMORY.md) is the index** — start there. It points at the individual `project_*.md` and `feedback_*.md` notes by topic, in load-priority order (the top two are always the live handover for the current pass).

## Read order in any new conversation

1. **Live handover** — top two pointers in `MEMORY.md` (currently `project_frontend_and_wave4.md` and `project_next_routing_pass.md`)
2. **Cert hierarchy** — `project_cert_hierarchy.md` (the architectural keystone)
3. **Feedback rules** — every `feedback_*.md` (the rules of engagement)
4. **Project context** — relevant `project_*.md` files for the slice you're touching

## What lives where

| Prefix | Type | Use |
|---|---|---|
| `feedback_*.md` | Rules of engagement | How Pedro wants Claude to operate. Read once per session, apply across all responses. |
| `project_*.md`  | Architectural / state notes | Specific design decisions, build logs, current handovers. |
| `MEMORY.md`     | Index | One-line pointers with hooks. Always loaded into context. |

## Why duplicated?

The `~/.claude` location is per-machine. To work on multiple computers (school, home), the memory state has to live in the repo. This folder is the canonical version. The user-folder copy is a working mirror; if it drifts, the repo wins.

## Updating

- New memory: write the file in `~/.claude/projects/D---ttrpg-engine/memory/` (so the runtime auto-memory system sees it), add a line to `MEMORY.md`, then `cp` to this folder.
- Or simpler: write directly here, then sync back to `~/.claude` with `cp docs/memories/*.md ~/.claude/projects/D---ttrpg-engine/memory/`.

## Build logs

`project_build_log_v1.md`, `_v2.md`, and `_v3.md` are time-stamped snapshots. Each captures the state at the end of a long sprint — read the latest first, fall back to older ones for archaeology.
