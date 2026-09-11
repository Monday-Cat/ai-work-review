# Companion agent skills（可选，随仓库分发）

These are the author's own agent-workflow files that drive this plugin's `.ai-review/` bridge protocol end-to-end. Copy what fits your tool:

```
skills/
├── novel-review/            小说审核工作流（深度审核 + 整改）
│   ├── SKILL.md             ZCode 技能（/novel-review 审核|整改）
│   └── commands/
│       ├── info-cn.md       ZCode 冒号命令 /novel-review:info-cn（中文说明书）
│       └── info-en.md       /novel-review:info-en（English manual）
├── dev-review/              开发文档工作流（解析模块 / 解析业务 / 深度拆解 → 需求 / 微改 → 添加 → 开工 → 交付 → 整改 / 变更）
│   ├── SKILL.md             ZCode 技能（/dev-review 解析模块|解析业务|深度拆解|需求|微改|添加|交付|整改|变更|调整|开工|继续|状态）
│   └── commands/
│       ├── info-cn.md       /dev-review:info-cn（中文说明书）
│       └── info-en.md       /dev-review:info-en（English manual）
├── dev-parse-biz/           业务解析技能（被 dev-review 的 解析业务 / 深度拆解 调用；单独装也可用）
│   └── SKILL.md             解析单个模块 / 深度拆解整个项目的业务逻辑 → docs/开发文档/<模块>/
└── cursor-commands/         Cursor 版命令（.cursor/commands/，平铺命名；ZCode 用户级同构可用）
    ├── novel-review.md          /novel-review
    ├── novel-review-info-cn.md  /novel-review-info-cn
    ├── novel-review-info-en.md  /novel-review-info-en
    ├── dev-review.md            /dev-review（薄入口，加载技能后按子命令执行）
    ├── dev-review-info-cn.md    /dev-review-info-cn
    ├── dev-review-info-en.md    /dev-review-info-en
    └── 子命令直达入口（中英双语，等价于 /dev-review <同名子命令>）：
        深度拆解=deep-parse · 解析模块=parse-modules · 解析业务=parse-biz ·
        需求=requirement · 微改=minor-change · 添加=add-record · 交付=deliver · 整改=fix-bug ·
        添加BUG=add-bug（记一条 BUG，`添加 BUG` 的快捷写法；修 BUG 用 整改=fix-bug） ·
        变更=change · 调整=adjust · 开工=start · 继续=continue · 状态=status ·
        接口摄取=api-ingest · 接口变动=api-changes · 接口比对=api-compare · 接口列表=api-list ·
        组件解析=component-parse · 组件查=component-find · 组件登记=component-register ·
        组件影响=component-impact · 组件比对=component-compare · 整合=integrate · 建卡=add-concept ·
        文档检查=doc-check
```

## 安装

- **ZCode（项目级）**: copy `dev-review/`、`dev-parse-biz/`（含 SKILL.md 与 commands/）into `<project>/.zcode/skills/<name>/`, and the `commands/` folders into `<project>/.zcode/commands/<name>/` (nested dirs become colon commands).
- **ZCode（全局，所有项目可用）**: 同样结构拷到 `~/.zcode/skills/<name>/` 与 `~/.zcode/commands/`。
- **Cursor（项目级）**: copy `dev-review/SKILL.md`、`dev-parse-biz/SKILL.md` into `<project>/.cursor/skills/<name>/`, and the files from `cursor-commands/` into `<project>/.cursor/commands/`（dev-review.md 是薄入口，必须与技能目录一起装）.
- **Cursor（全局，所有项目可用）**: 技能拷到 `~/.cursor/skills/<name>/`，命令拷到 `~/.cursor/commands/`。
- **ChatGPT**: see [`chatgpt/`](../chatgpt/) for a Custom GPT kit.

项目级与用户级同时存在时，命令入口优先加载项目级技能。The skills are templates — module mapping defaults to `lib/features/<模块>`（Flutter）；其他项目结构由「解析模块」自动识别一级业务目录，不需要改文件. The plugin itself works with any agent that follows the bridge protocol in the main README.
