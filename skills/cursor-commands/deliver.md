---
description: 交付 · Deliver — 对照验收填交付节，状态改已交付（<path or task name>）
---

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「交付」/ Run dev-review subcommand `交付`，参数：$ARGUMENTS
（参数：开发文档路径或任务名 / doc path or task name。填同一文档的「交付」节，不要另建交付文件 / fill the same doc, no new file。自测结果含对照模块卡「缺陷史」的回归检查 / self-test includes a regression check against 缺陷史。）

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
