---
description: View the /dev-review workflow manual (English)
---

View the /dev-review workflow manual (English): commands, file locations, the loop, core rules.

Show the following manual to the user (keep the Markdown formatting and content; do not perform any development or modification):

---

# /dev-review Manual

**What it is**: a unified dev-doc workflow paired with the Obsidian "AI Work Review" plugin (Dev mode). Requirements and delivery live in **one** doc: the AI writes the requirement → you "Approve / Adjust" in the panel → the AI starts & delivers → you "Finish". Status maps 1:1 to commands: **调整中**→`调整` (doc only), **变更中**→`变更` (land code), **整改中**→`整改` (BUG only). Post-code requirement changes go two steps: log a change → 调整中 → `调整` settles the doc → 变更中 → `变更` lands the code.

## Commands

| Command | When | Purpose |
|---|---|---|
| `/dev-review 解析模块` | Onboarding | Scans every feature dir under `lib/features/`, creates `docs/开发文档/<module>/` and a module card `_模块.md` (structure index) |
| `/dev-review 解析业务 <module> [流程]` | Understand one module | Turns the module's current behavior into per-business-line docs (snapshot, status = 完结; with `流程` they stay 待审核 and enter the review-start loop) |
| `/dev-review 深度拆解 [modules…] [更新]` | Understand the whole project | Parses **all modules serially, one by one**: finish one (write docs + mark its module card) before the next; rerun after interruption resumes automatically; incremental by default, `更新` forces re-parse |
| `/dev-review 需求 <task description>` | Before starting | Turns the conversation's requirements into a dev doc (verifiable acceptance checkboxes, non-goals), status = 待审核 |
| `/dev-review 建卡 <concept>` | Distill a shared concept | Creates the concept card `docs/公用配置/<concept>.md`: definition from the chat or extracted from code/docs (AI drafts, author confirms); unifies variant terms in docs into the canonical name with wikilinks; suggests a terminology-unification requirement for code renames |
| `/dev-review 调整` | Doc in 调整中 | Regenerates the doc from new requirements (doc only); requirement stage → 待审核, post-code → 变更中 |
| `/dev-review 开工` | After you "Approve" | Implements approved docs (status 已通过 → 开发中); reads the module card's 缺陷史 first to avoid regressions |
| `/dev-review 交付 <task>` | Work finished | Fills the "交付" section of the same doc against acceptance, status = 已交付; self-test includes a regression check against 缺陷史 |
| `/dev-review 整改` (alias `添加BUG`) | After you log a bug | Fixes entries already written in the doc's 缺陷记录 section; never creates new docs; fills 整改 + 根因 and appends to the module card's 缺陷史 |
| `/dev-review 变更` | Doc in 变更中 | Doc already settled: land the change in code per the doc, fill 落实 |
| `/dev-review 继续` | A delivery got adjusted | Addresses adjustment notes (code + delivery section), re-delivers for review |
| `/dev-review 状态` | Anytime | Lists every doc grouped by module: where it's stuck and whose move is next |
| `/dev-review-info-cn` / `-info-en` | — | Show this manual (Chinese / English) |

## Where files go

| Location | Contents | Notes |
|---|---|---|
| `docs/开发文档/<module>/` | Dev docs (requirement + delivery in one) | The review targets; status field tracked by the plugin |
| `docs/开发文档/<module>/_模块.md` | Module card (structure index) | Layers / pages / responsibility / parse progress / 缺陷史 (root-cause index of fixed bugs; read before 开工/变更/交付); not a task, cannot be started |
| `docs/公用配置/<concept>.md` | Concept cards (shared concepts) | Targets of `[[concept]]` wikilinks; the card is authoritative — the AI never guesses a concept; the AI may draft a card but only the author confirms and saves it |
| `.ai-review/adjustments/` | Notes written from the panel's "Adjust" | Read first by the skill, auto-removed once handled |

## The loop

```
(optional) 深度拆解 / 解析业务 → understand the current behavior
/dev-review 需求 → review in Obsidian Dev mode: "Adjust" regenerates the doc / "Approve" releases it
→ /dev-review 开工 → /dev-review 交付 → you "Finish"
→ post-code requirement change: log "Change req" → 调整中 → /dev-review 调整 settles the doc → 变更中 → /dev-review 变更 lands the code (if the AI forgets to flip the status, use the panel's "Finalize" button)
→ bug: "Bug" → /dev-review 整改
```

## Core rules

1. Be honest in every doc: failing tests are reported as failing — you make approval decisions based on them.
2. The state machine gates work: only 已通过 can start; business snapshots stay 完结 so they can never be started by accident.
3. Parsed business docs must map back to code: pages & entries, main flow, business rules, branches & errors, data & dependencies; mark assumptions instead of inventing details.
4. Shared concepts are authoritative in `docs/公用配置/` concept cards: reference them via wikilinks; on a dead link or an undefined concept the AI stops and asks the author instead of guessing.

## Scope

The skill lives inside the project (Cursor: `.cursor/skills/`; ZCode: `.zcode/skills/`) and manages this project's `docs/开发文档/`. Modules map to `lib/features/<module>` by default; other project layouts map their own code dirs the same way.
