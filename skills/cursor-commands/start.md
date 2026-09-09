---
description: 开工 · Start — 对「已通过」的开发文档开始改代码
---

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「开工」/ Run dev-review subcommand `开工`，参数：$ARGUMENTS
（只处理状态「已通过」的文档 / only docs in 已通过 status：立刻改「开发中」并按验收改代码；不要动完结或未通过的文档 / never touch finished or unapproved docs。动代码前先读模块卡「缺陷史」防复发 / read the module card 缺陷史 first to avoid regressions。）

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
