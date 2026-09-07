---
description: 小说审核与整改。用法：/novel-review 审核 <路径|全部> 或 /novel-review 整改 <路径>
---

你执行小说项目的审核与整改工作流（配合 Obsidian「AI Work Review」插件）。**永远不直接修改原文件**——所有修改以「修改稿」形式写入桥接目录，由作者在 Obsidian 里 diff 确认后才替换。

用户参数：$ARGUMENTS
（第一个词是子命令：`审核` 或 `整改`；其余是被审文件路径或 `全部`。没有参数时询问用户要做什么。）

## 路径约定（本 vault 根目录 = 当前项目根）

- 报告：`.ai-review/reports/<镜像路径>/<文件名>.json`（如 `人物库/男主.md` → `.ai-review/reports/人物库/男主.md.json`，先建目录）
- 修改稿：`.ai-review/proposals/<镜像路径>/<文件名>.md`（整份新内容，不是片段、不是 diff、不带解释文字）
- 作者的调整意见在 `.ai-review/adjustments/<镜像路径>/<文件名>.md.json` 的 `note` 字段

## 载入纪律（每次审核前必做）

1. 先读 `世界观/00-核心铁律.md`，再读 `世界观.md`（索引）。
2. 按被审文件内容，按索引的载入条件读取相关细节文件（修炼/等级→01、06；势力→04；地理/历史/世界真相→05；道/交汇→07；死亡/轮回→02；时间→03）。
3. 审人物档案时，同时读其关系表中出现的其他人物档案。

## 子命令：审核

逐文件检查：跨文件设定一致性（等级/灵根/势力/关系与世界观及其他档案的矛盾）、逻辑漏洞、待定项；章节文件另审正文质量（叙事、节奏、人设一致性）。每个文件写一份报告 JSON，然后给用户简短汇总（各文件 verdict 与最重要的问题）。

报告 schema（novel-review/report@1，字段名勿改，插件按此解析）：

```json
{
  "schema": "novel-review/report@1",
  "file": "人物库/男主.md",
  "reviewer": "cursor",
  "timestamp": "ISO8601",
  "verdict": "pass | warn | fail",
  "summary": "一句话总评",
  "issues": [
    { "severity": "error | warn | info", "dimension": "consistency | quality | plot | character | template",
      "section": "能力设定", "line": 42, "problem": "和哪份文件的哪条设定矛盾（必填）", "suggestion": "改成什么" }
  ]
}
```

verdict 判定：**fail**=违反核心铁律或硬性矛盾；**warn**=待确认/软性不一致；**pass**=无实质问题。没有问题就写空 issues + pass，不要凑数。

## 子命令：整改

1. **先读调整意见**：`.ai-review/adjustments/…` 若存在，**优先级最高**，逐条满足。
2. 读该文件的审核报告（可能已归档到 `.ai-review/archive/`）；都没有则先执行审核。
3. 针对意见+问题生成整份修改稿写入 proposals/。要求：保留模板结构与格式；只改相关内容；文风与原文一致。
4. 告诉用户：回 Obsidian「AI Work Review」面板，点该文件「查看修改稿」，对照后「应用替换」。

## 纪律

- 绝不修改 `世界观/00-核心铁律.md` 的铁律来迁就被审文件；矛盾就是问题。
- 只写 `.ai-review/` 内的文件；引用设定注明出处文件。
