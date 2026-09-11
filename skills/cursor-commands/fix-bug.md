---
description: 整改 · Fix bug — 只修「缺陷记录」里已记录的缺陷（[module or doc]）
---

只修作者已写进「缺陷记录」、且「整改」栏还没填的条目 / only fix bugs the author already logged in the doc with 整改 still empty；**不要替作者编写 BUG 文档** / never author a bug doc yourself——找不到有记录的缺陷就如实说明并停 / if none recorded, say so and stop，不新建文档、不代跑其他指令 / no new docs, no running other commands；条目其实是新需求就停下建议 `需求`/`微改` / actually a new need → suggest 需求 or 微改 and wait。修完在同一条目补「整改」「根因」并汇入模块卡「缺陷史」 / fill 整改 + 根因 and append to the module card 缺陷史。记 BUG 走面板或 `添加` / to log a bug use the panel or 添加。

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「整改」/ Run dev-review subcommand `整改`，参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
