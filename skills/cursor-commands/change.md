---
description: 变更 · Change — 处理「变更中」文档：按定稿文档落地代码（[module or doc]）
---

只处理状态「变更中」的开发文档 / only process docs in 变更中 status：变更已由「调整」合入文档定稿 / changes already merged & settled by 调整，按文档调整目标目录里的代码完成落地、补「落实」/ land the change in code per the settled doc and fill 落实，不新开文档、不新记变更条目 / no new doc, no new change entries。**先文档确认，再执行** / doc confirmed first, then execute：文档还在「调整中」就停下，告知作者先跑「调整」定稿，不要自己串跑 / if still 调整中, stop and wait for 调整 to settle, never chain it yourself；没有「变更中」文档就如实说明并停 / if none in 变更中, say so and stop。落地前读模块卡「缺陷史」作回归清单 / read 缺陷史 as a regression checklist first。

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「变更」/ Run dev-review subcommand `变更`，参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
