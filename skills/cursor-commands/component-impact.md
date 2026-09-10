---
description: 组件影响 · Component impact — reverse-map who uses a component or page before changing it (<name|page|path>)
---

**Reverse mapping**: before changing a component or page, reverse-map every consumer — **code search is the source of truth** (references across the project), cross-checked against the card's 使用方 list whose stale entries get corrected；outputs an **impact list**: affected pages/components/modules → business docs mentioning them (grep [[页面]]/[[组件]] wikilinks) → each module's 缺陷史 (every consumer needs regression). Suggests a 组件/页面变更 requirement (待审核) with the blast radius in boundaries and one acceptance point per consumer；after landing, `组件登记` refreshes the card and `整合` merges behavior changes into business docs.

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「组件」，动作 `影响` / Run dev-review subcommand `组件` action `影响`, args: $ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
