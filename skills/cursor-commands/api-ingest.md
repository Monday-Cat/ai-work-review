---
description: 接口摄取 · API ingest — normalize external API docs into one markdown summary (<source> [service])
---

Normalize external API material (web page / tables / txt / word / pasted) into the per-service summary `docs/接口文档/<服务>/_接口.md`：fetch web pages with your scraping ability (login-walled pages: ask the author to save or paste), parse any local format (convert office / pdf to text first)；fields missing from the source are marked 原文未提供, never invented；raw snapshot saved as `_源.<ext>`, `_索引.md` refreshed.

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「接口」，动作 `摄取` / Run dev-review subcommand `接口` action `摄取`, args: $ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
