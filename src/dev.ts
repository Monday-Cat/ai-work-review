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
	/** 「需求变更」节还有未落实的条目：文档已进入代码期（调整中→变更中 流转） */
	pendingChange?: boolean;
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
			pendingChange: hasPendingChange(d.content),
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

/** 「需求变更」节里还有没落地（落实未填内容）的条目：变更没完成，文档处于代码期 */
export function hasPendingChange(content: string): boolean {
	const idx = content.indexOf(CHANGE_HEADING);
	if (idx < 0) return false;
	let tail = content.slice(idx + CHANGE_HEADING.length);
	const next = tail.indexOf("\n## ");
	if (next >= 0) tail = tail.slice(0, next);
	const blocks = tail.split(/^###\s/m).slice(1);
	if (blocks.length === 0) return /^[-*]\s+\S/m.test(tail); // 手写变更，未分条目
	return blocks.some((b) => !/\*\*落实\*\*[:：]\s*\S/.test(b));
}

export function todayStamp(d = new Date()): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** 条目时间戳：精确到分钟，同一天多条意见也能区分先后 */
export function nowStamp(d = new Date()): string {
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${todayStamp(d)} ${hh}:${mm}`;
}

/**
 * 删除某节下**最新一条**条目（条目按插入顺序倒挂：节标题后第一条就是最新）。
 * - 「需求变更」「缺陷记录」：删第一个 `### ` 块（到下一个 `### ` 或节尾）。
 * - 「补充需求」：删第一行 `- （时间戳）…`。
 */
export function removeLatestSectionEntry(content: string, heading: string): { content: string; removed: string } {
	const idx = content.indexOf(heading);
	if (idx < 0) return { content, removed: "" };
	const bodyStart = idx + heading.length;
	let section = content.slice(bodyStart);
	const nextSection = section.indexOf("\n## ");
	const rest = nextSection >= 0 ? section.slice(nextSection) : "";
	if (nextSection >= 0) section = section.slice(0, nextSection);

	const entryStart = section.search(/^###\s/m);
	if (entryStart >= 0) {
		const nextEntry = section.indexOf("\n### ", entryStart);
		const blockEnd = nextEntry >= 0 ? nextEntry + 1 : section.length;
		const removed = section.slice(entryStart, blockEnd);
		const kept = section.slice(0, entryStart) + section.slice(blockEnd);
		return { content: content.slice(0, bodyStart) + kept.replace(/\n{3,}/g, "\n\n") + rest, removed };
	}
	const bullet = section.match(/^[-*]\s+（[^）]+）.*$/m);
	if (bullet && bullet.index != null) {
		const removed = bullet[0];
		const kept = (section.slice(0, bullet.index) + section.slice(bullet.index + removed.length)).replace(/\n{3,}/g, "\n\n");
		return { content: content.slice(0, bodyStart) + kept + rest, removed };
	}
	return { content, removed: "" };
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

/** 开工之后才能写缺陷：开发中/已交付/完结/整改中/变更中。需求阶段不行。 */
export function canRecordBug(status: string | undefined, delivered = false): boolean {
	return delivered || isCloseOutStatus(status);
}

export interface DevAuthorActions {
	approve: "pass" | "done";
	adjust: boolean;
	change: boolean;
	bug: boolean;
}

/**
 * 面板作者按钮。
 * 需求阶段（待审核/调整/已通过）：通过 + 调整（按新需求重新生成文档，不改代码）。
 * 对过代码以后（开发中/已交付/完结/整改中/变更中）：完结 + 缺陷（只记 BUG）+ 需求变更（改代码落地）。
 * 三者互不混用：文档的事走调整，已过代码的需求落地走变更，BUG 走缺陷。
 */
export function devAuthorActions(status: string | undefined, delivered = false): DevAuthorActions {
	const closeOut = delivered || isCloseOutStatus(status);
	return {
		approve: closeOut ? "done" : "pass",
		adjust: !closeOut,
		change: closeOut,
		bug: closeOut,
	};
}

export function isApprovedReqStatus(status: string | undefined): boolean {
	const s = (status ?? "").trim();
	return s.includes("已通过") && !s.includes("待") && !s.includes("完结");
}

/** 待审核点通过=已通过（可开工）；开发中/已交付/整改中点通过=完结。交付后即使状态被改成「调整」也仍完结。 */
export function nextApproveStatus(current: string | undefined, delivered = false): string {
	const s = (current ?? "").trim();
	if (delivered || isCloseOutStatus(s)) return "完结";
	return "已通过";
}

export function isCloseOutStatus(status: string | undefined): boolean {
	const s = (status ?? "").trim();
	return s.includes("开发中") || s.includes("已交付") || s.includes("整改中") || s.includes("已完成") || s.includes("完结") || s.includes("变更中");
}

/** 需求变更只在对过代码以后（开发中/已交付/整改中/完结/变更中）：改代码落地。需求阶段要改需求走「调整」。 */
export function canRecordRequirementChange(status: string | undefined): boolean {
	return isCloseOutStatus(status);
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
