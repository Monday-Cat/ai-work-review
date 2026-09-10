# AI Work Review

Review and approve AI's work on your markdown vault — right inside Obsidian.

AI coding assistants (ZCode, Claude Code, Cursor, …) edit your notes fast, but **you** are the one who decides what ships. This plugin gives every AI-touched markdown file a clear verdict — ✅ pass / ⚠️ needs work / ❌ rejected — shows exactly where the problems are, and lets the AI propose full replacements that you confirm via a diff before anything is written.

Chinese UI documentation: [中文说明](#中文说明) · Interface language: Chinese / English (auto-detected, configurable).

## Why

Vibe-editing a knowledge vault fails in a predictable way: small inconsistencies accumulate until nobody knows which files are trustworthy. This plugin closes the loop:

1. **Deterministic rule checks** (free, instant, in Obsidian) catch the mechanical failure modes.
2. **Deep AI review** (runs in your terminal with your AI agent) catches semantic issues, writes structured reports the plugin imports.
3. **Human approval** — nothing the AI writes ever reaches your files until you accept it in a diff view.

## Two modes

The panel header has a mode switch (persisted per vault):

- **Novel mode** — per-file review: every markdown file in scope gets a verdict, grouped by folder. Best for reviewing knowledge/setting files one by one.
- **Dev mode** — task-pipeline review. Each change lives in one **开发文档** under `docs/开发文档/<module>/`. The author can **Adjust** or **Approve**; templates live in the agent skill, not the vault. Fixed bugs are distilled into the module card's **缺陷史** (symptom → root cause), which the AI reads before start/change/deliver as a regression checklist. Shared concepts (e.g. a local currency) live as concept cards under `docs/公用配置/` (distilled via /dev-review 建卡 from the chat or from code), referenced from docs via `[[wikilinks]]` — the card is authoritative and the AI never guesses; variant terms in docs are unified to the canonical name. External API material (web pages / tables / txt / word) is normalized via /dev-review 接口摄取 into one per-service summary under `docs/接口文档/`; 接口变动 produces field-level change lists and can hand off adaptation requirements; 接口比对 diffs the doc against code call sites to find drift. Reusable components are registered into `docs/组件文档/` via /dev-review 组件解析; before writing UI, 组件查 recommends what to reuse instead of reinventing wheels. Legacy `开发需求/` + `开发交付/` pairs still show until migrated.

Pair Dev mode with a small agent skill (see the `skills/` folder in this repo) so the AI writes requirement docs & delivery notes there and consumes your adjustments — a full "AI works → you approve in Obsidian → AI continues" loop.

## Features

**Rule checks** (run instantly, no AI needed)
- Template completeness — map any folder to a template file; the plugin checks that sections (`## …`) and fields (`- **name**:`) exist and aren't left empty or still containing the template placeholder. Values written in sub-bullets are recognized.
- Draft/pending markers — configurable regex (defaults: 草案， 待定， TODO, …) with per-line locations.
- Reference integrity — `` `path/to/file.md` `` backtick references and `[[wikilinks]]` that point nowhere.
- Index consistency — an index file's table is cross-checked against the folder it indexes (missing listings / dead links, both directions).
- Status field checks — configurable per folder (`folder|field|final values`), e.g. flag chapters not yet final.

**AI bridge** (`.ai-review/` folder in your vault root, hidden from search)
- `reports/<mirrored path>/<file>.json` — structured AI review reports, auto-imported (20s polling) and archived.
- `proposals/<mirrored path>/<file>.md` — full proposed replacements; shown as a unified diff ("changes only" toggle), applied only on your click.
- `adjustments/<mirrored path>/<file>.md.json` — your adjustment notes written from the panel; the AI reads these and has to follow them. Cleared automatically once a proposal is applied.

**Review panel** (ribbon icon)
- Per-file status with counts, grouped by folder, "issues only" filter, click an issue to jump to the line.
- Verdicts: rules + AI combined; your manual verdict (approve / adjust) always wins.
- One click exports ready-to-paste prompts: "review these files" and "fix according to my adjustment notes".

## The workflow

```
Obsidian                              your terminal (AI agent)
┌──────────────────────────┐          ┌──────────────────────────────┐
│ 1. Re-check (rules)      │          │                              │
│ 2. Copy AI review prompt ─┼─ paste ─→│ 3. deep review, writes       │
│                          │          │    .ai-review/reports/*.json │
│ 4. auto-import (20s)  ←──┼──────────┤                              │
│ 5. read issues, jump to  │          │                              │
│    lines                 │          │                              │
│ 6. "Adjust" + write what │─paste ──→│ 7. /fix command reads        │
│    is wrong              │          │    adjustments/, writes      │
│                          │          │    .ai-review/proposals/*.md │
│ 8. diff → Apply&replace  │←─────────┤                              │
│ 9. approve manually      │          │                              │
└──────────────────────────┘          └──────────────────────────────┘
```

Nothing is written to your notes by the AI directly. Ever.

## Report schema

```json
{
  "schema": "novel-review/report@1",
  "file": "notes/some-file.md",
  "reviewer": "zcode",
  "timestamp": "2026-09-05T12:00:00+08:00",
  "verdict": "pass | warn | fail",
  "summary": "one-line summary",
  "issues": [
    {
      "severity": "error | warn | info",
      "dimension": "consistency | quality | plot | character | template",
      "section": "Section heading",
      "line": 42,
      "problem": "what is wrong (required)",
      "suggestion": "how to fix it"
    }
  ]
}
```

Adjustment notes (`novel-review/adjustment@1`): `{ "schema", "file", "timestamp", "note" }`.

The field names keep their historic `novel-review` prefix for backward compatibility with existing bridges.

## Settings

- Scope: folders and root files to scan; folder→template mapping; index files; status field checks; draft-marker regex.
- AI bridge: folder name (default `.ai-review`), auto-import toggle, archive toggle.
- General: interface language (auto / 中文 / English).
- Maintenance: clear all review data.

## Pairing with an AI agent

Any agent that can read/write files works. For [ZCode](https://zcode.dev) / Claude Code, drop a small skill file into the vault (`.zcode/skills/novel-review/SKILL.md` — ready-made copies live in this repo's `skills/` folder) that teaches the agent the protocol: load context files first, write reports to `reports/`, write full replacements to `proposals/`, never touch originals.

## Manual install

Build (`npm install && npm run build:only`) and copy `main.js`, `manifest.json`, `styles.css` into `<vault>/.obsidian/plugins/ai-work-review/`, then enable it in Obsidian settings. Or use `node scripts/install-to-vault.mjs <vault…>`.

For local development, create `vaults.local.json` in the repo root (git-ignored) listing your vault paths — `["/path/to/vault", …]`. All entries are the default install targets of `npm run build`; the first entry doubles as the dev vault for `npm run test`. Machine-specific, never committed.

## Development

```bash
npm install
npm run test        # unit tests (rule checker, report parser, diff) + full integration test
npm run build       # typecheck + bundle + install into the vaults listed in vaults.local.json
npm run dev         # watch mode
```

`vaults.local.json` (git-ignored) holds your local vault paths; without it, pass explicit vault paths to `node scripts/install-to-vault.mjs <vault…>` instead.

Source layout: `rules` (pure checker functions) · `store` (verdict state) · `ingest` (bridge protocol) · `diff` (LCS diff) · `view` (side panel) · `fixmodal` / `adjustmodal` · `settings` · `i18n` · `main`.

## License

[MIT](LICENSE)

---

# 中文说明

**AI 工作审核**：在 Obsidian 里审核并批准 AI 对你笔记库的修改。面板顶部可在两种模式间切换（按 vault 记忆）：**小说模式**逐文件审核设定档案；**开发模式**扫描 `docs/开发文档/<模块>/` 下的统一开发文档，需求阶段可点 **通过** / **调整**，对过代码以后可点 **完结** / **缺陷** / **需求变更**，变更合入文档后用 **定稿** 确认进入 `变更中`（该状态不能直接完结，避免跳过代码落地）。已修复的缺陷由 AI 汇入模块卡 **缺陷史**（症状 → 根因），开工 / 变更 / 交付前先读它做回归检查，防止旧缺陷复发；任务行与面板顶部会显示缺陷计数。公用概念（如本地货币）用 `/dev-review 建卡` 沉淀到 `docs/公用配置/` 概念卡（定义可从对话或代码提炼），开发文档用 `[[双链]]` 引用，AI 以卡为准、不猜测；建卡时会把文档里的变体叫法统一成规范词。外部接口资料（网页 / 表格 / txt / word）用 `/dev-review 接口摄取` 规范化成 `docs/接口文档/` 每服务一份总汇，`接口变动` 出字段级变动清单并可联动生成适配需求，`接口比对` 对照代码调用点找漂移。可复用组件用 `/dev-review 组件解析` 登记进 `docs/组件文档/`，写 UI 前 `组件查` 优先复用，避免重复造轮子。代码项目的模板写在技能里，不往仓库落模板文件；未合并的旧 `开发需求/` / `开发交付/` 仍可配对显示。

规则检查（模板完整性、草案标记、引用完整性、索引一致性、状态字段）在本地即时完成；AI 深度审核由终端里的智能体完成并把结构化报告写入 vault 根下的 `.ai-review/` 桥接目录（对 Obsidian 检索隐藏）；修改稿必须经 diff 对照、你点击「应用替换」后才会写入原文件。你还可以在面板里对文件点「调整」写明不足点，意见同步给 AI 生成针对性修改稿——文件只有在你人工标记「通过」后才算定稿。

完整工作流、协议 schema、技能接入方式见上方英文文档；界面语言可在设置中切换（自动 / 中文 / English）。

本机开发：在仓库根建 `vaults.local.json`（不入库）列出你的 vault 路径，`npm run build` 会自动安装到其中全部 vault，首项兼作 `npm run test` 的开发 vault；临时目标用 `node scripts/install-to-vault.mjs <vault…>` 指定。
