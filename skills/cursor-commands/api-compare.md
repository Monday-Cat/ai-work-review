---
description: 接口比对 · API compare — diff the API doc against code call sites and dev docs (<service> [module])
---

Compare the API doc against code call sites and dev docs；report three mismatch classes：**documented but unused in code** (missing or deprecated) / **used in code but not documented** (doc gap) / **same endpoint with different params or path** (implementation drift, highest risk). Report only — fixes go through 需求 / 变更.

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「接口」，动作 `比对` / Run dev-review subcommand `接口` action `比对`, args: $ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
