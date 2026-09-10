---
description: 组件解析 · Component parse — scan widgets into a component registry ([module])
---

Scans component directories into the **component registry** `docs/组件文档/`：one card per reusable component (path / dual-dimension tags / responsibility / props API / minimal example / consumers)，tags taken from the `_标签.md` controlled vocabulary (能力=what it does, 场景=where it fits, native `#能力/xx` searchable in Obsidian)；`_索引.md` grouped by capability tag；one-off private widgets are skipped. **Duplicated look-alike components across modules are never refactored in place** — instead a 组件抽取 requirement doc is generated (待审核， review-then-start flow).

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「组件」，动作 `解析` / Run dev-review subcommand `组件` action `解析`, args: $ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
