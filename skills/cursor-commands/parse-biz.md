---
description: 解析业务 · Parse business — 解析单个模块业务逻辑 → dev docs（<module> [流程/flow]）
---

参数：模块名 / module name；带 `流程`（flow）则状态待审核走审核-开工闭环。整个项目请用 deep-parse / whole project: use deep-parse。

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。再加载技能 `dev-parse-biz` 的 SKILL.md（查找方式同上）。

执行 dev-review 的子命令「解析业务」/ Run dev-review subcommand `解析业务`，参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
