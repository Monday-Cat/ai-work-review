# Companion agent skills（可选，随仓库分发）

These are the author's own agent-workflow files that drive this plugin's `.ai-review/` bridge protocol end-to-end. Copy what fits your tool:

```
skills/
├── novel-review/            小说审核工作流（深度审核 + 整改）
│   ├── SKILL.md             ZCode 技能（/novel-review 审核|整改）
│   └── commands/
│       ├── info-cn.md       ZCode 冒号命令 /novel-review:info-cn（中文说明书）
│       └── info-en.md       /novel-review:info-en（English manual）
├── dev-review/              开发交付工作流（需求 → 交付 → 继续迭代）
│   ├── SKILL.md             ZCode 技能（/dev-review 需求|交付|继续|状态）
│   └── commands/
│       ├── info-cn.md       /dev-review:info-cn
│       └── info-en.md       /dev-review:info-en
└── cursor-commands/         Cursor 版命令（.cursor/commands/，平铺连字符命名）
    ├── novel-review.md          /novel-review
    ├── novel-review-info-cn.md  /novel-review-info-cn
    ├── novel-review-info-en.md  /novel-review-info-en
    ├── dev-review.md            /dev-review
    ├── dev-review-info-cn.md    /dev-review-info-cn
    └── dev-review-info-en.md    /dev-review-info-en
```

## 安装

- **ZCode**: copy `SKILL.md` into `<project>/.zcode/skills/<name>/`, and the `commands/` folders into `<project>/.zcode/commands/<name>/` (nested dirs become colon commands).
- **Cursor**: copy the files from `cursor-commands/` into `<project>/.cursor/commands/`.
- **ChatGPT**: see [`chatgpt/`](../chatgpt/) for a Custom GPT kit.

The skills are templates — adjust the vault paths inside to your own setup. The plugin itself works with any agent that follows the bridge protocol in the main README.
