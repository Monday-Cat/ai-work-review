---
description: 深度拆解 · Deep parse — 逐模块拆解全项目业务逻辑 → dev docs（[modules…] [更新/refresh]）
---

无参数 = 全部未拆解模块 / no args = all unparsed modules；可传模块名清单 / module names；带 `更新`（refresh）强制重拆。逐模块串行、可中断续跑 / serial, resumable。

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。再加载技能 `dev-parse-biz` 的 SKILL.md（查找方式同上）。

执行 dev-review 的子命令「深度拆解」/ Run dev-review subcommand `深度拆解`，参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
