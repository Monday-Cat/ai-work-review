---
description: 添加 · Add record — 记录入口：把 BUG/需求变更/补充需求写进文档（BUG|change|note [module or doc]）
---

面板「缺陷」「需求变更」「调整」按钮的 AI 侧等价 / the AI-side equivalent of the panel's 缺陷 / 需求变更 / 调整 buttons：按面板同款时间戳格式（`YYYY-MM-DD HH:mm` 分钟级，最新在前）把作者口述的内容记进对应章节顶部 / log what the author dictates at the top of the matching section in the panel's exact timestamped format，并切状态——BUG→`整改中`、变更/补充→`调整中` / status flips to 整改中 for bugs, 调整中 for changes and notes。只写记录，不改正文、不改代码 / records only — never edits the spec or code，后续交给 `整改`/`调整`/`变更` 处理 / processing is left to 整改 / 调整 / 变更。状态门槛同面板 / same status gates as the panel：BUG/变更 只记已对过代码的文档，补充 只记需求阶段文档 / bugs & changes only on code-touched docs, notes only at requirement stage；定位不到文档就问，不新建 / can't locate the doc → ask, never create。面板「撤回」不覆盖 AI 记的条目，记错让 AI 删 / panel undo does not cover AI-written entries。

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「添加」/ Run dev-review subcommand `添加`，参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
