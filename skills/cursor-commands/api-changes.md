---
description: 接口变动 · API changes — re-fetch and diff the provider's APIs, field-level change list (<service>)
---

Re-fetch the provider's API material per the source recorded in `_接口.md`, diff against the stored doc endpoint by endpoint, and produce a **field-level change list** (added / removed / changed)；update the doc, raw snapshot and index；after asking the author, optionally generate an adaptation requirement under `docs/开发文档/` (待审核， review-then-start flow) — never touch business code directly.

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「接口」，动作 `变动` / Run dev-review subcommand `接口` action `变动`, args: $ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
