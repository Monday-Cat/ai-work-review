---
description: 调整 · Adjust — 处理「调整中」文档：按新需求重新生成需求文档（doc only）
---

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「调整」/ Run dev-review subcommand `调整`，参数：$ARGUMENTS
（处理所有状态为「调整中」的开发文档 / process every doc in 调整中 status：把「补充需求」「需求变更」未落实条目合入需求/验收/边界，只改文档不改代码 / merge pending notes into the spec, doc only。完成后：需求阶段→`待审核`；对过代码→`变更中` 等变更落地 / requirement stage back to 待审核, post-code to 变更中。没有「调整中」文档但 adjustments/ 有待处理意见时按状态直接分流，不要停下来问 / if none in 调整中 but notes are pending, route by status without asking：变更中→`变更`；整改中→`整改`；旧档交付调整→`继续`。）

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
