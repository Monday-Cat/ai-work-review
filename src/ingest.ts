/**
 * AI 报告 / 修改稿桥接协议（.ai-review/ 目录）：
 *
 *   .ai-review/reports/<镜像路径>/<文件名>.json   AI 审核报告
 *   .ai-review/proposals/<镜像路径>/<文件名>.md   AI 修改稿（整份新内容）
 *   .ai-review/archive/<时间戳>/…                 导入/应用后归档
 *
 * 报告 JSON schema（novel-review/report@1）：
 * {
 *   "schema": "novel-review/report@1",
 *   "file": "人物库/沈临.md",            // vault 相对路径，必填
 *   "reviewer": "zcode",
 *   "timestamp": "2026-09-05T12:00:00+08:00",
 *   "verdict": "pass" | "warn" | "fail", // 必填
 *   "summary": "一句话总评",
 *   "issues": [{
 *     "severity": "error" | "warn" | "info",
 *     "dimension": "consistency" | "quality" | "template" | ...,
 *     "section": "能力设定",
 *     "line": 42,
 *     "problem": "问题描述（必填）",
 *     "suggestion": "修改建议"
 *   }]
 * }
 */

export interface ParsedAiIssue {
	severity: "error" | "warn" | "info";
	dimension: string;
	section?: string;
	line?: number;
	problem: string;
	suggestion?: string;
}

export interface ParsedAiReport {
	file: string;
	reviewer?: string;
	timestamp?: string;
	verdict: "pass" | "warn" | "fail";
	summary?: string;
	issues: ParsedAiIssue[];
}

export function parseAiReport(raw: string): { report?: ParsedAiReport; error?: string } {
	let obj: any;
	try {
		obj = JSON.parse(raw);
	} catch (e) {
		return { error: `JSON 解析失败：${(e as Error).message}` };
	}
	if (typeof obj !== "object" || obj === null) return { error: "报告根节点不是对象" };
	const file = typeof obj.file === "string" ? obj.file.trim() : "";
	if (!file) return { error: "缺少必填字段 file（vault 相对路径）" };
	const verdict = obj.verdict;
	if (verdict !== "pass" && verdict !== "warn" && verdict !== "fail") {
		return { error: `verdict 非法：${String(verdict)}（应为 pass/warn/fail）` };
	}
	const issues: ParsedAiIssue[] = [];
	if (obj.issues !== undefined) {
		if (!Array.isArray(obj.issues)) return { error: "issues 应为数组" };
		for (const it of obj.issues) {
			if (typeof it !== "object" || it === null || typeof it.problem !== "string" || !it.problem.trim()) {
				return { error: "issues 中存在缺少 problem 的条目" };
			}
			const sev = it.severity === "error" || it.severity === "info" ? it.severity : "warn";
			issues.push({
				severity: sev,
				dimension: typeof it.dimension === "string" && it.dimension ? it.dimension : "consistency",
				section: typeof it.section === "string" && it.section ? it.section : undefined,
				line: typeof it.line === "number" && Number.isFinite(it.line) ? Math.max(1, Math.round(it.line)) : undefined,
				problem: it.problem.trim(),
				suggestion: typeof it.suggestion === "string" && it.suggestion.trim() ? it.suggestion.trim() : undefined,
			});
		}
	}
	return {
		report: {
			file,
			reviewer: typeof obj.reviewer === "string" ? obj.reviewer : undefined,
			timestamp: typeof obj.timestamp === "string" ? obj.timestamp : undefined,
			verdict,
			summary: typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim() : undefined,
			issues,
		},
	};
}

const SEVERITY_RANK: Record<string, number> = { error: 0, warn: 1, info: 2 };
export function worstVerdict(issues: ParsedAiIssue[]): "pass" | "warn" | "fail" {
	if (issues.some((i) => i.severity === "error")) return "fail";
	if (issues.some((i) => i.severity === "warn")) return "warn";
	return "pass";
}

/** 镜像路径 ↔ vault 路径 */
export function proposalTargetPath(proposalRelPath: string, proposalsRoot: string): string {
	// proposalRelPath: ".ai-review/proposals/人物库/沈临.md" → "人物库/沈临.md"
	return proposalRelPath.slice(proposalsRoot.length + 1);
}
