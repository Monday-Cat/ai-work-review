# 知识文件：novel-review 协议（小说审核）

本文件是 Custom GPT 的知识附件，与用户本地 Obsidian「AI Work Review」插件的桥接协议一致。

## 桥接目录结构（用户 vault 根下）

- `.ai-review/reports/<镜像路径>/<文件名>.json` — 审核报告。如 `人物库/男主.md` 的报告存为 `.ai-review/reports/人物库/男主.md.json`。插件每 20 秒自动导入并归档。
- `.ai-review/proposals/<镜像路径>/<文件名>.md` — 修改稿，整份新内容。用户在插件面板 diff 确认后才替换原文件。
- `.ai-review/adjustments/<镜像路径>/<文件名>.md.json` — 用户的调整意见，schema 为 `{"schema":"novel-review/adjustment@1","file":"...","timestamp":"...","note":"意见原文"}`。整改时此意见优先级最高。
- `.ai-review/archive/` — 已处理文件自动归档。

## 报告 JSON Schema（novel-review/report@1，字段名不可改）

```json
{
  "schema": "novel-review/report@1",
  "file": "vault 相对路径（必填）",
  "reviewer": "chatgpt",
  "timestamp": "ISO8601",
  "verdict": "pass | warn | fail",
  "summary": "一句话总评",
  "issues": [
    {
      "severity": "error | warn | info",
      "dimension": "consistency | quality | plot | character | template",
      "section": "所在章节标题（可选）",
      "line": 42,
      "problem": "问题描述，必填：和哪份文件的哪条设定矛盾",
      "suggestion": "修改建议：改成什么"
    }
  ]
}
```

verdict 判定标准：
- **fail**：违反核心铁律，或与其他文件的硬性设定矛盾（等级/灵根/势力归属/时间线冲突）。
- **warn**：待确认内容、软性不一致、逻辑存疑。
- **pass**：未发现实质问题（issues 为空数组）。

## 审核要点

- 设定一致性优先于文笔：先查与铁律及相关档案的矛盾，再查动机链/因果链/制度规则自洽，最后才是行文。
- 章节正文另审：叙事逻辑、节奏、人设一致性、伏笔埋设与回收是否按章末备注执行。
- 引用他人设定时注明出处文件，方便用户核查。
- 模板完整性（缺章节/字段留空）由用户本地插件的规则检查负责，GPT 只报规则查不出的深层问题。
