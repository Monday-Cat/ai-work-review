---
description: 组件查 · Component find — recommend which existing component to reuse (<need description>)
---

**Selection**: given a need description, search `docs/组件文档/` and the code, recommend which component to reuse with a minimal usage example；say plainly when nothing fits and ask the author about creating one (register new reusable components with `组件登记` at delivery). Run this before writing UI — don't reinvent wheels.

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「组件」，动作 `查` / Run dev-review subcommand `组件` action `查`, args: $ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
