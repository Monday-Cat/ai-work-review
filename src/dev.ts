/**
 * 开发模式：扫描统一「开发文档」，并兼容旧的 开发需求/ + 开发交付/ 配对。
 * 纯函数，可独立测试。
 */

import { isTemplateLike } from "./rules";

export interface DevFileRef {
	path: string;
	content: string;
}

export interface DevTask {
	slug: string;
	reqPath?: string;
	reqStatus?: string;
	deliverPath?: string;
	deliverStatus?: string;
	deliverDate?: string;
	targetFolder?: string;
	/** 文档里的「目标目录」：要改的代码路径 */
	codeTarget?: string;
	unified?: boolean;
}

export type TaskKind = "final" | "wait" | "ready" | "active" | "none";

/** "2026-09-07-登录接口.md" → "登录接口" */
export function stripDatePrefix(base: string): string {
	return base
		.replace(/^\d{4}-\d{2}-\d{2}-/, "")
		.replace(/\.md$/i, "");
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractFieldValue(content: string, field: string): string | undefined {
	const re = new RegExp(`^\\s*[-*]\\s*\\*\\*${escapeRe(field)}\\*\\*\\s*[:：]\\s*(.+?)\\s*$`, "m");
	const m = content.match(re);
	return m ? m[1].replace(/[*_`]/g, "").trim() : undefined;
}

/** 按任务名合并两个目录的文件；任务名 = 文件名去掉日期前缀 */
export function matchTasks(reqs: DevFileRef[], dels: DevFileRef[]): DevTask[] {
	const map = new Map<string, DevTask>();
	for (const r of reqs) {
		const slug = stripDatePrefix(r.path.split("/").pop() ?? r.path);
		if (!slug || isTemplateLike(r.path)) continue;
		const t: DevTask = map.get(slug) ?? { slug };
		t.reqPath = r.path;
		t.reqStatus = extractFieldValue(r.content, "状态");
		map.set(slug, t);
	}
	for (const d of dels) {
		const slug = stripDatePrefix(d.path.split("/").pop() ?? d.path);
		if (!slug || isTemplateLike(d.path)) continue;
		const t: DevTask = map.get(slug) ?? { slug };
		t.deliverPath = d.path;
		t.deliverStatus = extractFieldValue(d.content, "状态");
		t.deliverDate = extractFieldValue(d.content, "交付日期");
		map.set(slug, t);
	}
	return [...map.values()];
}

/** 统一开发文档 + 旧版需求/交付配对 */
export function collectDevTasks(docs: DevFileRef[], reqs: DevFileRef[], dels: DevFileRef[], docFolder: string): DevTask[] {
	const map = new Map<string, DevTask>();
	for (const d of docs) {
		const slug = stripDatePrefix(d.path.split("/").pop() ?? d.path);
		if (!slug || isTemplateLike(d.path)) continue;
		map.set(slug, {
			slug,
			unified: true,
			reqPath: d.path,
			deliverPath: d.path,
			reqStatus: extractFieldValue(d.content, "状态"),
			deliverDate: extractFieldValue(d.content, "交付日期"),
			codeTarget: extractFieldValue(d.content, "目标目录"),
			targetFolder: targetFolderOf(d.path, docFolder),
		});
	}
	for (const t of matchTasks(reqs, dels)) {
		if (map.has(t.slug)) continue;
		map.set(t.slug, t);
	}
	return [...map.values()];
}

/** 任务当前所处阶段：交付单优先；无交付时看需求的调整/通过 */
export function taskState(t: DevTask): { label: string; kind: TaskKind } {
	const d = (t.deliverStatus ?? "").trim();
	const r = (t.reqStatus ?? "").trim();
	if (d.includes("整改中") || r.includes("整改中")) return { label: d.includes("整改中") ? d : r, kind: "active" };
	if (d.includes("变更中") || r.includes("变更中")) return { label: d.includes("变更中") ? d : r, kind: "wait" };
	if (d.includes("完结") || d.includes("已完成")) return { label: d, kind: "final" };
	if (d.includes("已通过")) return { label: d, kind: "final" };
	if (d.includes("待审核") || d.includes("修改中") || d.includes("已交付")) return { label: d, kind: "wait" };
	if (r.includes("完结") || r.includes("已完成")) return { label: r, kind: "final" };
	if (r.includes("已交付")) return { label: r, kind: "wait" };
	if (r.includes("调整")) return { label: r, kind: "wait" };
	if (r.includes("已通过")) return { label: r, kind: "ready" };
	if (r.includes("开发中")) return { label: r, kind: "active" };
	if (r.includes("待审核") || r.includes("待开发")) return { label: r, kind: "wait" };
	if (d) return { label: d, kind: "active" };
	if (r) return { label: r, kind: "active" };
	return { label: "", kind: "none" };
}

export function folderLeafName(folderSetting: string): string {
	return folderSetting.replace(/\/+$/, "").split("/").pop() ?? folderSetting;
}

/** 任意层级下名为该目录的文件夹都算（如 docs/开发文档/finance/x.md） */
export function isUnderNamedFolder(path: string, folderSetting: string): boolean {
	const name = folderLeafName(folderSetting);
	return name.length > 0 && path.split("/").includes(name);
}

/**
 * 文档所在模块文件夹。
 * - `docs/开发文档/finance/a.md` → `docs/开发文档/finance`
 * - `lib/features/finance/开发需求/a.md` → `lib/features/finance`
 */
export function targetFolderOf(path: string, folderSetting: string): string {
	const name = folderLeafName(folderSetting);
	const parts = path.split("/");
	const idx = parts.lastIndexOf(name);
	if (idx < 0) return parts.slice(0, -1).join("/");
	if (idx + 2 < parts.length) return parts.slice(0, idx + 2).join("/");
	if (idx > 0) return parts.slice(0, idx).join("/");
	return parts.slice(0, -1).join("/");
}

export function setFieldValue(content: string, field: string, value: string): string {
	const re = new RegExp(`^(\\s*[-*]\\s*\\*\\*${escapeRe(field)}\\*\\*\\s*[:：]\\s*).*$`, "m");
	if (re.test(content)) return content.replace(re, `$1${value}`);
	return content;
}

export const SUPPLEMENT_HEADING = "## 补充需求";
export const BUG_HEADING = "## 缺陷记录";
export const CHANGE_HEADING = "## 需求变更";

export function upsertSupplementSection(content: string, note: string, stamp: string): string {
	const lines = note
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
		.map((l) => l.replace(/^[-*]\s+/, ""));
	const block = lines.map((l) => `- （${stamp}）${l}`).join("\n");
	if (content.includes(SUPPLEMENT_HEADING)) {
		return content.replace(SUPPLEMENT_HEADING, `${SUPPLEMENT_HEADING}\n${block}`);
	}
	return `${content.trimEnd()}\n\n${SUPPLEMENT_HEADING}\n${block}\n`;
}

export function upsertBugSection(content: string, note: string, stamp: string): string {
	const lines = note
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
		.map((l) => l.replace(/^[-*]\s+/, ""));
	const block = [`### ${stamp}`, ...lines.map((l) => `- ${l}`), "- **整改**："].join("\n");
	if (content.includes(BUG_HEADING)) {
		return content.replace(BUG_HEADING, `${BUG_HEADING}\n${block}\n`);
	}
	return `${content.trimEnd()}\n\n${BUG_HEADING}\n${block}\n`;
}

export function upsertChangeSection(content: string, note: string, stamp: string): string {
	const lines = note
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
		.map((l) => l.replace(/^[-*]\s+/, ""));
	const block = [`### ${stamp}`, ...lines.map((l) => `- ${l}`), "- **落实**："].join("\n");
	if (content.includes(CHANGE_HEADING)) {
		return content.replace(CHANGE_HEADING, `${CHANGE_HEADING}\n${block}\n`);
	}
	return `${content.trimEnd()}\n\n${CHANGE_HEADING}\n${block}\n`;
}

export function todayStamp(d = new Date()): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function isAdjustReqStatus(status: string | undefined): boolean {
	const s = (status ?? "").trim();
	return s.includes("调整") && !s.includes("变更");
}

/** 已完成后在原文档记缺陷（不是新需求） */
export function isBugFixReqStatus(status: string | undefined): boolean {
	const s = (status ?? "").trim();
	return s.includes("整改中") || s.includes("已完成") || s.includes("完结");
}

export function isApprovedReqStatus(status: string | undefined): boolean {
	const s = (status ?? "").trim();
	return s.includes("已通过") && !s.includes("待") && !s.includes("完结");
}

/** 待审核点通过=已通过（可开工）；开发中/已交付/整改中点通过=完结 */
export function nextApproveStatus(current: string | undefined): string {
	const s = (current ?? "").trim();
	if (s.includes("开发中") || s.includes("已交付") || s.includes("整改中") || s.includes("已完成") || s.includes("完结") || s.includes("变更中")) {
		return "完结";
	}
	return "已通过";
}

export function isCloseOutStatus(status: string | undefined): boolean {
	const s = (status ?? "").trim();
	return s.includes("开发中") || s.includes("已交付") || s.includes("整改中") || s.includes("已完成") || s.includes("完结") || s.includes("变更中");
}

export function canRecordRequirementChange(status: string | undefined): boolean {
	const s = (status ?? "").trim();
	if (!s || s.includes("待审核") || (s.includes("调整") && !s.includes("变更"))) return false;
	return s.includes("已通过") || s.includes("开发中") || s.includes("已交付") || s.includes("完结") || s.includes("已完成") || s.includes("变更中") || s.includes("整改中");
}

export const DEFAULT_DEV_DOC_FOLDER = "开发文档";
export const DEFAULT_DEV_REQ_FOLDER = "开发需求";
export const DEFAULT_DEV_DELIVER_FOLDER = "开发交付";
export const PROJECT_DOCS_DEV_FOLDER = "docs/开发文档";
export const PROJECT_DOCS_REQ_FOLDER = "docs/开发需求";
export const PROJECT_DOCS_DELIVER_FOLDER = "docs/开发交付";

const CODE_PROJECT_MARKERS = ["pubspec.yaml", "package.json", "Cargo.toml", "go.mod", "pyproject.toml"];
const NOVEL_VAULT_MARKERS = ["人物库", "章节库"];

/** vault 根条目像代码项目、又不像小说库时，需求/交付落到 docs/ 下 */
export function shouldUseProjectDocsLayout(vaultTopEntries: string[]): boolean {
	const names = new Set(vaultTopEntries.map((n) => n.replace(/\/+$/, "")));
	if (NOVEL_VAULT_MARKERS.some((m) => names.has(m))) return false;
	return CODE_PROJECT_MARKERS.some((m) => names.has(m));
}

export function isNovelDefaultDevFolders(reqFolder: string, deliverFolder: string): boolean {
	return reqFolder === DEFAULT_DEV_REQ_FOLDER && deliverFolder === DEFAULT_DEV_DELIVER_FOLDER;
}
