---
description: 组件登记 · Component register — card & index a reusable component (<path>)
---

Registers the given component file into the registry：write its card at `docs/组件文档/<分类>/<组件名>.md` (path / dual-dimension tags / responsibility / **layout ASCII sketch** / props API / minimal example / consumers；redraw the layout after the component changes)，**tags must come from the `_标签.md` controlled vocabulary, propose missing ones**, and refresh the capability-grouped `_索引.md`. Use it when a new reusable component is delivered, so future development can find it via `组件查`.

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「组件」，动作 `登记` / Run dev-review subcommand `组件` action `登记`, args: $ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
