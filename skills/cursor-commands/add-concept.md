---
description: 建卡 · Add concept — 建公用概念卡并统一项目词汇（<concept>）
---

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「建卡」/ Run dev-review subcommand `建卡`, args: $ARGUMENTS
（建 `docs/公用配置/<概念>.md` 概念卡：定义来自对话或从代码/文档提取，AI 代拟、作者确认 / create the concept card from the chat or from code/docs, AI drafts, author confirms；文档变体词统一为规范名并加双链，历史条目不回改 / unify variant terms in docs with `[[wikilinks]]`, never rewrite history entries；代码命名不统一只建议开需求 / suggest a terminology-unification requirement for code, never touch code directly。）

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
