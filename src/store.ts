import { Issue, Verdict } from "./rules";

export type UserVerdict = "pass" | "fail";

export interface HistoryEntry {
	t: number;
	action: string;
	detail?: string;
}

export interface FileReview {
	path: string;
	ruleStatus: Verdict;
	ruleIssues: Issue[];
	lastRuleCheck?: number;
	aiVerdict?: "pass" | "warn" | "fail";
	aiIssues: Issue[];
	aiSummary?: string;
	lastAiReport?: number;
	aiReportHash?: string;
	userVerdict?: UserVerdict;
	userNote?: string;
	fixedCount: number;
	history: HistoryEntry[];
}

/** 撤回栈：每记一条作者意见时压入，撤回时按 path 弹最新一条恢复状态 */
export interface UndoEntry {
	path: string;
	kind: "req" | "bug" | "change";
	prevStatus: string;
	stamp: string;
	note: string;
}

export interface StoreData {
	version: number;
	files: Record<string, FileReview>;
	undoLog?: UndoEntry[];
}

export function emptyFileReview(path: string): FileReview {
	return {
		path,
		ruleStatus: "unchecked",
		ruleIssues: [],
		aiIssues: [],
		fixedCount: 0,
		history: [],
	};
}

export const STATUS_ORDER: Record<string, number> = {
	fail: 0,
	warn: 1,
	unchecked: 2,
	pass: 3,
};

/** 综合状态：人工裁决 > 规则与 AI 中更严重者 */
export function effectiveStatus(
	fr: FileReview | undefined,
): { status: Exclude<Verdict, "unchecked"> | "unchecked"; origin: "user" | "ai" | "rule" | "none" } {
	if (!fr) return { status: "unchecked", origin: "none" };
	if (fr.userVerdict) return { status: fr.userVerdict, origin: "user" };
	const candidates: Array<{ s: Exclude<Verdict, "unchecked">; origin: "ai" | "rule"; rank: number }> = [];
	if (fr.aiVerdict) candidates.push({ s: fr.aiVerdict, origin: "ai", rank: STATUS_ORDER[fr.aiVerdict] });
	if (fr.ruleStatus !== "unchecked")
		candidates.push({ s: fr.ruleStatus, origin: "rule", rank: STATUS_ORDER[fr.ruleStatus] });
	if (candidates.length === 0) return { status: "unchecked", origin: "none" };
	candidates.sort((a, b) => a.rank - b.rank);
	return { status: candidates[0].s, origin: candidates[0].origin };
}

export class ReviewStore {
	data: StoreData = { version: 1, files: {} };

	constructor(data?: StoreData | null) {
		this.data = data ?? { version: 1, files: {} };
		if (data && data.files) {
			this.data = data;
			// 兼容缺字段
			for (const p of Object.keys(this.data.files)) {
				const fr = this.data.files[p];
				fr.ruleIssues ??= [];
				fr.aiIssues ??= [];
				fr.fixedCount ??= 0;
				fr.history ??= [];
				fr.ruleStatus ??= "unchecked";
			}
		}
		this.data.undoLog ??= [];
	}

	/** 记一条作者意见时压入撤回栈（只留最近 20 条） */
	pushUndo(entry: UndoEntry): void {
		const log = (this.data.undoLog ??= []);
		log.push(entry);
		if (log.length > 20) log.splice(0, log.length - 20);
	}

	/** 弹出该文档最新一条可撤回记录；没有则 undefined */
	popUndo(path: string): UndoEntry | undefined {
		const log = this.data.undoLog ?? [];
		for (let i = log.length - 1; i >= 0; i--) {
			if (log[i].path === path) return log.splice(i, 1)[0];
		}
		return undefined;
	}

	peekUndo(path: string): UndoEntry | undefined {
		const log = this.data.undoLog ?? [];
		for (let i = log.length - 1; i >= 0; i--) {
			if (log[i].path === path) return log[i];
		}
		return undefined;
	}

	get(path: string): FileReview {
		let fr = this.data.files[path];
		if (!fr) {
			fr = emptyFileReview(path);
			this.data.files[path] = fr;
		}
		return fr;
	}

	applyRuleResult(path: string, status: Verdict, issues: Issue[]) {
		const fr = this.get(path);
		const prev = fr.ruleStatus;
		fr.ruleStatus = status;
		fr.ruleIssues = issues;
		fr.lastRuleCheck = Date.now();
		if (prev !== status) {
			fr.history.push({ t: Date.now(), action: "规则检查", detail: `${prev} → ${status}` });
		}
	}

	applyAiReport(
		path: string,
		verdict: "pass" | "warn" | "fail",
		issues: Issue[],
		summary: string | undefined,
		reportHash: string,
		timestampMs: number,
	) {
		const fr = this.get(path);
		fr.aiVerdict = verdict;
		fr.aiIssues = issues;
		fr.aiSummary = summary;
		fr.aiReportHash = reportHash;
		fr.lastAiReport = timestampMs;
		fr.history.push({ t: Date.now(), action: "导入AI报告", detail: verdict });
	}

	applyUserVerdict(path: string, verdict: UserVerdict | undefined, note?: string) {
		const fr = this.get(path);
		fr.userVerdict = verdict;
		fr.userNote = verdict ? note : undefined;
		fr.history.push({
			t: Date.now(),
			action: verdict === "pass" ? "人工标记通过" : verdict === "fail" ? "人工调整（提交意见）" : "清除人工裁决",
		});
	}

	applyFixApplied(path: string) {
		const fr = this.get(path);
		fr.fixedCount += 1;
		fr.aiVerdict = undefined;
		fr.aiIssues = [];
		fr.aiSummary = undefined;
		fr.ruleStatus = "unchecked";
		fr.ruleIssues = [];
		fr.lastAiReport = undefined;
		fr.userVerdict = undefined;
		fr.history.push({ t: Date.now(), action: "应用AI修改稿", detail: `第 ${fr.fixedCount} 次整改，待重新检查` });
	}

	/** 供渲染的排序：严重者优先，再按路径 */
	sortedPaths(paths: string[]): string[] {
		return [...paths].sort((a, b) => {
			const sa = effectiveStatus(this.data.files[a]);
			const sb = effectiveStatus(this.data.files[b]);
			const ra = STATUS_ORDER[sa.status] ?? 9;
			const rb = STATUS_ORDER[sb.status] ?? 9;
			if (ra !== rb) return ra - rb;
			return a.localeCompare(b, "zh-Hans-CN");
		});
	}
}

export function simpleHash(s: string): string {
	let h1 = 0xdeadbeef ^ s.length;
	let h2 = 0x41c6ce57 ^ s.length;
	for (let i = 0; i < s.length; i++) {
		const ch = s.charCodeAt(i);
		h1 = Math.imul(h1 ^ ch, 2654435761);
		h2 = Math.imul(h2 ^ ch, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
