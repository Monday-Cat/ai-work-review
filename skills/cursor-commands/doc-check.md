---
description: 文档检查 · Doc check — dev-doc spec check + report-driven fix loop ([module|整改])
---

**Report loop**: check produces a report → fix per the report → delete the report when done. `文档检查 [module]` (no arg = whole vault) audits `docs/开发文档/` against six spec rules — ①six 基本信息 fields / legal status values / **premature 交付日期** (待审核~开发中 must not have one); ②slim-doc four-section structure & 来源=微改; ③timestamped entry formats with 整改/落实 placeholders (broken formats silently break panel counts and undo); ④status-entry drift; ⑤dead [[概念]]/[[组件]] links; ⑥slim-doc abuse hint — findings go into `docs/开发文档/_检查报告.md` (the `_` prefix marks it a non-task file; overwritten each run), grouped into 待整改 (AI-fixable) and 需作者定夺 (author decides). `文档检查 整改` reads the report and fixes item by item: missing sections restored, inferable fields filled, premature dates cleared only when the delivery section is empty, formats repaired panel-style (format only, never content, **never status**); each fixed item gets its checkbox ticked; author-decides items (status drift → panel, dubious dates → verify, dead links → 建卡) are never done on the author's behalf; once everything is handled the **report is deleted**, otherwise it stays with a summary of what's left. No report → run the check first; never fix from memory.

先加载并遵守技能 dev-review 的 SKILL.md：优先项目级 `.cursor/skills/dev-review/SKILL.md`（ZCode 为 `.zcode/skills/`），没有则读用户级 `~/.cursor/skills/dev-review/SKILL.md`（ZCode 为 `~/.zcode/skills/`）。

执行 dev-review 的子命令「文档检查」/ Run dev-review subcommand `文档检查`，参数：$ARGUMENTS

按技能执行，不要往仓库写模板文件。开发文档固定写在 `docs/开发文档/<模块>/`。
