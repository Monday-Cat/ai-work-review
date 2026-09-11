---
description: 添加BUG · Add bug — 记一条 BUG 进「缺陷记录」并切「整改中」（[module or doc]）
---

`添加 BUG` 的快捷写法 / quick form of `添加 BUG`：按面板同款格式把作者口述的缺陷写进指定开发文档的「缺陷记录」顶部（`### 时间戳`＋症状＋`- **整改**：` 空占位，最新在前）/ log the reported bug at the top of 缺陷记录 in the panel's exact format，状态切「整改中」/ status flips to 整改中。只写记录不修 BUG——修用 `整改` / records only, fixing is 整改；定位不到文档就问，不新建 / can't locate the doc → ask, never create。面板「撤回」不覆盖 AI 记的条目，记错让 AI 删 / panel undo does not cover AI-written entries。

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「添加」，按 `BUG` 类型记录（本命令 `添加BUG` 是 `添加 BUG` 的快捷写法 / quick form of `添加 BUG`），参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
