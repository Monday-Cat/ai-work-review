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
	let obj: unknown;
	try {
		obj = JSON.parse(raw);
	} catch (e) {
		return { error: `JSON 解析失败：${(e as Error).message}` };
	}
	if (typeof obj !== "object" || obj === null) return { error: "报告根节点不是对象" };
	const o = obj as Record<string, unknown>;
	const file = typeof o.file === "string" ? o.file.trim() : "";
	if (!file) return { error: "缺少必填字段 file（vault 相对路径）" };
	const verdict = o.verdict;
	if (verdict !== "pass" && verdict !== "warn" && verdict !== "fail") {
		return { error: `verdict 非法：${String(verdict)}（应为 pass/warn/fail）` };
	}
	const issues: ParsedAiIssue[] = [];
	if (o.issues !== undefined) {
		if (!Array.isArray(o.issues)) return { error: "issues 应为数组" };
		for (const rawIssue of o.issues as unknown[]) {
			if (typeof rawIssue !== "object" || rawIssue === null || typeof (rawIssue as Record<string, unknown>).problem !== "string") {
				return { error: "issues 中存在缺少 problem 的条目" };
			}
			const it = rawIssue as Record<string, unknown>;
			const problem = it.problem as string;
			if (!problem.trim()) return { error: "issues 中存在缺少 problem 的条目" };
			const sev = it.severity === "error" || it.severity === "info" ? it.severity : "warn";
			issues.push({
				severity: sev,
				dimension: typeof it.dimension === "string" && it.dimension ? it.dimension : "consistency",
				section: typeof it.section === "string" && it.section ? it.section : undefined,
				line: typeof it.line === "number" && Number.isFinite(it.line) ? Math.max(1, Math.round(it.line)) : undefined,
				problem: problem.trim(),
				suggestion: typeof it.suggestion === "string" && it.suggestion.trim() ? it.suggestion.trim() : undefined,
			});
		}
	}
	return {
		report: {
			file,
			reviewer: typeof o.reviewer === "string" ? o.reviewer : undefined,
			timestamp: typeof o.timestamp === "string" ? o.timestamp : undefined,
			verdict,
			summary: typeof o.summary === "string" && o.summary.trim() ? o.summary.trim() : undefined,
			issues,
		},
	};
}

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
