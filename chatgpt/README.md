# 把工作流装到 ChatGPT（Custom GPT 套件）

> 说明：Obsidian 插件本体（ai-work-review）只能运行在 Obsidian 桌面端，无法安装到 ChatGPT。本套件把 **AI 侧工作流** 做成 Custom GPT：审核/整改的逻辑与桥接协议和本地完全一致，只是文件交换从「AI 直接读写」变成「你手动上传/下载」。

## 套件内容

| 文件 | 用途 |
|---|---|
| `gpt-instructions.md` | 粘贴到 Custom GPT 的 Instructions（指令）栏 |
| `knowledge-novel-protocol.md` | 知识附件：小说审核协议（报告 schema、桥接目录、判定标准） |
| `knowledge-dev-protocol.md` | 知识附件：开发交付评审协议 |

## 创建步骤（需要 ChatGPT Plus）

1. 打开 ChatGPT → 左下角头像 → **My GPTs** → **Create a GPT**
2. Name 填 `AI 工作审核`
3. 把 `gpt-instructions.md` 全文粘贴进 **Instructions** 栏
4. **Knowledge** 处上传另外两个 `knowledge-*.md` 文件
5. Create 并保存（可见范围建议 Only me）

## 日常怎么用

**小说审核：**
1. 在 GPT 对话里上传：要审的文件 + `世界观/00-核心铁律.md` + 相关背景档案（ChatGPT 看不到你本地文件，背景要一并提供）
2. 说「审核这个文件，vault 路径是 人物库/男主.md」
3. 复制它输出的 JSON，存为 vault 下的 `.ai-review/reports/人物库/男主.md.json`（注意目录要镜像原文件路径）
4. Obsidian 插件 20 秒内自动导入，之后照常在面板看问题、跳转、点「调整」

**整改：**
1. 把原文件内容 + 调整意见（或问题清单）发给 GPT
2. 复制它输出的整份修改稿，存为 `.ai-review/proposals/人物库/男主.md`
3. 回 Obsidian 面板「查看修改稿」→ diff 对照 → 应用替换

**开发评审：** 上传需求档案 + 交付单，让它评审验收达成情况；把「建议退回」的理由粘贴回交付单的「审核意见」节，本地 ZCode/Cursor 执行 `/dev-review 继续` 即可衔接。

## 三个工具怎么选

| 工具 | 文件访问 | 适合 |
|---|---|---|
| ZCode / Cursor | 直接读写 vault | 日常主力：审核、整改、继续开发 |
| ChatGPT (Custom GPT) | 手动上传/下载 | 不在电脑前用手机审、想要第二意见交叉审核 |

## 已知限制

- ChatGPT 看不到 vault，背景文件每次要手动提供，报告/修改稿要手动放回（放错位置插件会忽略并在通知里提示）
- 报告 JSON 里的 `file` 字段必须是 vault 相对路径，GPT 不知道时会在指引里先问你
