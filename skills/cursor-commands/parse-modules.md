---
description: 解析模块 · Parse modules — 扫描代码业务目录建模块卡（structure index only）
---

无参数 = 扫描全部 / no args = scan all；只建结构索引 `_模块.md`，不写业务文档 / structure index only。

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「解析模块」/ Run dev-review subcommand `解析模块`，参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
