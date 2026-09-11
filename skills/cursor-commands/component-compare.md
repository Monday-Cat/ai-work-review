---
description: 组件比对 · Component compare — registry health check + report-driven fix loop, incl. page-layout cards ([module|整改])
---

**Report loop** (same as 「文档检查」): compare produces a report → fix per the report → delete the report when done. `组件比对 [module]` (no arg = whole project) checks five things — ①page coverage: code page without a card = missing (author decides: run 组件解析); card whose page is gone = orphan (author decides). ②slot drift: what the page actually references vs the legend's 组件 column (AI-fixable). ③link health: dead 业务 links, legend filenames due for a `[[卡名]]` upgrade (AI-fixable), dead card links (author decides). ④weaving backlog: business docs missing the 双链清单 or pages still bare class names (author decides: run 整合). ⑤consumer cross-check (AI-fixable) — findings go into `docs/组件文档/_比对报告.md` (overwritten per run, split into AI-fixable vs author-decides). `组件比对 整改` reads the report and fixes item by item (**docs only, never code**, ticks checkboxes), **deletes the report** once everything is handled; no report → run the compare first, never fix from memory. Task-doc spec issues belong to `文档检查`, not here.

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「组件」，动作 `比对` / Run dev-review subcommand `组件` action `比对`, args: $ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
