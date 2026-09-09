---
description: 添加BUG · Add bug — 整改别名：处理文档里已记录的缺陷（[module or doc]）
---

读开发文档「缺陷记录」里已有的条目并修复 / read & fix bugs already logged in the doc；不要另写一套 BUG 文档。

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「整改」（本命令 `添加BUG` 是它的别名 / alias of `整改`），参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
