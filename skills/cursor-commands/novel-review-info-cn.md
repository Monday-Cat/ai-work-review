---
description: 查看 /novel-review 工作流说明书（中文版）
---

查看小说审核工作流说明书（中文版）：审核/整改子命令、报告 schema、载入纪律。

请向用户展示以下说明书（保持 Markdown 格式与原文内容，不要执行任何审核或修改操作）：

---

# /novel-review 说明书

**这是什么**：小说项目的 AI 审核与整改工作流，与 Obsidian「AI Work Review」插件配合使用。AI 负责深度审核（跨文件设定一致性、章节正文质量）和生成修改稿；你在 Obsidian 里看报告、审修改稿、做最终裁决。

## 命令用法

| 命令 | 作用 |
|---|---|
| `/novel-review 审核 <路径\|全部>` | 深度审核指定文件（或全部），每份报告写入 `.ai-review/reports/<镜像路径>/<文件名>.json` |
| `/novel-review 整改 <路径>` | 按「调整意见+审核报告」生成整份修改稿，写入 `.ai-review/proposals/<镜像路径>/<文件名>.md` |
| `/novel-review:info-cn` / `:info-en` | 显示本说明书（中/英文） |

## 文件去向

| 位置 | 内容 | 谁写谁读 |
|---|---|---|
| `.ai-review/reports/` | 审核报告 JSON | AI 写 → 插件 20 秒自动导入并归档 |
| `.ai-review/proposals/` | 修改稿（整份新内容） | AI 写 → 你在面板 diff 确认后替换原文件 |
| `.ai-review/adjustments/` | 你的调整意见 | 面板「调整」写 → AI 整改时优先读取 |
| `.ai-review/archive/` | 已处理文件自动归档 | 系统维护 |

## 工作闭环

```
/novel-review 审核 → Obsidian 面板看报告 → 不满意点「调整」写意见
→ /novel-review 整改 → 面板「查看修改稿」diff 对照 → 应用替换 → 复审 → 人工标记通过
```

## 核心规则

1. **AI 绝不直接改原文件**，一切修改走修改稿 + diff 确认。
2. 审核前必须先载入 `世界观/00-核心铁律.md` 与 `世界观.md` 索引，再按需载入细节文件。
3. verdict 标准：fail=违反铁律/硬矛盾；warn=待确认/软性不一致；pass=无实质问题。
4. 报告必须可执行：problem 说清和什么矛盾，suggestion 说清改成什么。

## 配套插件操作（Obsidian 侧边栏剪贴板图标）

重新检查（规则）· 导入AI报告 · 复制AI审核/整改指令 · 查看/应用修改稿 · 人工裁决通过/调整
