---
description: 开发文档工作流：/dev-review 解析模块|解析业务|深度拆解|需求|交付|整改|变更|调整|开工|继续|状态
---

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。若子命令是 `解析业务` 或 `深度拆解`，用同样方式再加载技能 `dev-parse-biz` 的 SKILL.md。

用户参数：$ARGUMENTS
（第一个词是子命令：`解析模块` / `解析业务` / `深度拆解` / `需求` / `交付` / `整改` / `添加BUG` / `变更` / `调整` / `开工` / `继续` / `状态`，其余为参数。没有参数时执行 `状态`。）

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。缺陷写「缺陷记录」用 `整改`；开工后改需求写「需求变更」用 `变更`。都不要新开文档。
