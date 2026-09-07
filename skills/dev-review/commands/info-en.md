---
description: View the /dev-review workflow manual (English)
---

Show the following manual to the user (keep the Markdown formatting and content; do not perform any development or modification):

---

# /dev-review Manual

**What it is**: a delivery-review workflow for development tasks, paired with the Obsidian "AI Work Review" plugin (switch the panel header to Dev mode to see tasks). The AI works → a delivery note lands in Obsidian → you review → the AI continues from your notes, until you approve.

## Commands

| Command | When | Purpose |
|---|---|---|
| `/dev-review 需求 <task description>` | Before starting | Turns the conversation's requirements into a requirement doc (goals, verifiable acceptance checkboxes, non-goals) saved under `开发需求/` |
| `/dev-review 交付 <task>` | Work finished | Self-checks against the requirements and writes a delivery note (change list, real test results, acceptance steps, risks) under `开发交付/`, status = 待审核 (pending review) |
| `/dev-review 继续` | After you reviewed | Reads your panel "Adjust" notes + the delivery note's review-notes section, addresses each item, then re-delivers |
| `/dev-review 状态` | Anytime | Lists every task: where it's stuck and whose move is next |
| `/dev-review:info-cn` / `:info-en` | — | Show this manual (Chinese / English) |

## Where files go

| Location | Contents | Notes |
|---|---|---|
| `开发需求/` | Requirement docs (visible) | Read and annotate directly in Obsidian |
| `开发交付/` | Delivery notes (visible) | The review targets; the status field is tracked by the plugin (pending / revising / approved) |
| `.ai-review/adjustments/` | Notes written from the panel's "Adjust" | Read first by `继续`, auto-removed once handled |
| `.ai-review/proposals/` | Doc replacements | Any vault doc outside the dev folders goes through diff confirmation |

## The loop

```
/dev-review 需求 (optional) → develop → /dev-review 交付
→ review the delivery in Obsidian Dev mode: "Approve" or "Adjust" with what's wrong (or write in its review-notes section)
→ /dev-review 继续 → the AI addresses every note and re-delivers → re-review → approved
```

## Core rules

1. Delivery notes must be honest: failing tests are reported as failing — you make approval decisions based on them.
2. The AI never edits vault docs outside the dev folders directly (proposals + diff only); code changes are exempt.
3. Requirements and deliveries are paired automatically by task name (date prefix stripped); folder names are configurable in the plugin settings.

## Scope

This skill is installed at workspace level: every project under the wuEIEEkpa6 workspace can use it. The review vault defaults to `wuEIEEkpa6/小说`; point the `vault` field of `wuEIEEkpa6/.zcode/dev-review.json` at a different vault if needed.
