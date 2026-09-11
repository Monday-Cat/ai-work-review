---
description: 调整 · Adjust — 处理「调整中」文档：按已记录意见重新生成需求文档（doc only）
---

处理所有状态为「调整中」的开发文档 / process every doc in 调整中 status：把「补充需求」「需求变更」里**已记录**的未落实条目合入需求/验收/边界 / merge the **recorded** pending notes into the spec，只改文档不改代码 / doc only。**只处理有记录的，不管别的** / recorded notes only, nothing else：没有「调整中」文档或没有待落实条目就如实说明并停，不替作者编意见、不代跑其他指令 / if nothing recorded, say so and stop；扫到别的问题只一句话提示 / other findings get a one-line hint at most。完成后 / afterwards：需求阶段→`待审核`；对过代码→`变更中` 等变更落地 / requirement stage back to 待审核, post-code to 变更中。

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「调整」/ Run dev-review subcommand `调整`，参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
