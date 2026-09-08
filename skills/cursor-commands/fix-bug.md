---
description: 整改 · Fix bug — 修复文档「缺陷记录」里已写下的缺陷（[module or doc]）
---

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「整改」/ Run dev-review subcommand `整改`，参数：$ARGUMENTS
（只修作者已写进「缺陷记录」的条目 / only fix bugs the author already logged in the doc；不要替作者编写 BUG 文档，找不到就问 / never author a bug doc yourself。）

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
