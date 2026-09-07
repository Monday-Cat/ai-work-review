---
description: View the /novel-review workflow manual (English)
---

Show the following manual to the user (keep the Markdown formatting and content; do not perform any review or modification):

---

# /novel-review Manual

**What it is**: an AI review-and-fix workflow for the novel project, paired with the Obsidian "AI Work Review" plugin. The AI does deep review (cross-file consistency, prose quality) and drafts replacements; you read reports, review proposals in Obsidian, and make the final call.

## Commands

| Command | Purpose |
|---|---|
| `/novel-review 审核 <path\|全部>` | Deep-review the given file(s) (or everything); one report per file is written to `.ai-review/reports/<mirrored path>/<name>.json` |
| `/novel-review 整改 <path>` | Draft a full replacement based on your adjustment note + the review report, written to `.ai-review/proposals/<mirrored path>/<name>.md` |
| `/novel-review:info-cn` / `:info-en` | Show this manual (Chinese / English) |

## Where files go

| Location | Contents | Flow |
|---|---|---|
| `.ai-review/reports/` | Review reports (JSON) | AI writes → plugin auto-imports within 20s and archives |
| `.ai-review/proposals/` | Full proposed replacements | AI writes → you diff-confirm in the panel before it replaces the original |
| `.ai-review/adjustments/` | Your adjustment notes | Written from the panel's "Adjust" → read first by the AI when fixing |
| `.ai-review/archive/` | Processed files | Maintained automatically |

## The loop

```
/novel-review 审核 → read reports in the Obsidian panel → "Adjust" to state what's wrong
→ /novel-review 整改 → "View proposal" diff in the panel → Apply & replace → re-review → approve
```

## Core rules

1. **The AI never edits original files directly** — every change goes through a proposal + diff confirmation.
2. Before reviewing, it must load `世界观/00-核心铁律.md` and the `世界观.md` index, then relevant detail files as needed.
3. Verdicts: fail = violates the core laws / hard contradiction; warn = needs confirmation / soft inconsistency; pass = no substantive issues.
4. Reports must be actionable: the problem states what conflicts with what; the suggestion states what to change it to.

## Plugin side (clipboard icon in the Obsidian sidebar)

Re-check (rules) · Import AI reports · Copy AI review/fix prompt · View/apply proposals · Manual verdicts (approve/adjust)
