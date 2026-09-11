/**
 * 规则检查器（纯函数，无 obsidian 依赖，可独立测试）。
 *
 * 检查维度：
 *  - template  模板完整性：是否按映射的模板填齐章节与字段，字段是否留空
 *  - draft     草案/待定标记扫描（可配置正则）
 *  - reference 引用完整性：文中 `.md` 路径引用与 `[[wikilink]]` 是否存在
 *  - index     索引文件 ↔ 实际目录双向核对
 *  - status    状态字段检查（可配置：文件夹|字段名|完成值）
 */

import { t } from "./i18n";

export type Severity = "error" | "warn" | "info";
export type Verdict = "pass" | "warn" | "fail" | "unchecked";

export interface IssueLocation {
	line: number;
	text: string;
}

export interface Issue {
	id: string;
	source: "rule" | "ai";
	dimension: string;
	severity: Severity;
	section?: string;
	line?: number;
	problem: string;
	suggestion?: string;
	locations?: IssueLocation[];
}

export interface RuleCheckResult {
	path: string;
	status: Verdict;
	issues: Issue[];
}

export interface TemplateSpec {
	sections: string[];
	/** name 为字段名；section 为所属章节标题（顶层字段为 null） */
	fields: { section: string | null; name: string; placeholder: string }[];
}

export interface StatusCheck {
	/** 文件夹前缀，如 章节库 */
	folder: string;
	/** 字段名，如 当前状态 */
	field: string;
	/** 视为完成的值（任一包含即通过） */
	finals: string[];
}

export interface RuleCheckContext {
	/** folder → 模板文件路径 */
	templateMap: Record<string, string>;
	/** 模板文件内容缓存：templatePath → 解析后的规格 */
	templates: Record<string, TemplateSpec>;
	draftMarkerRegex: string;
	statusChecks: StatusCheck[];
}

export const DEFAULT_DRAFT_REGEX = "草案|待定|待补充|待定夺|存疑|TODO|FIXME|待写|未定";

/** 判断文件是否为模板/说明类文件，应跳过审核 */
export function isTemplateLike(path: string): boolean {
	const base = path.split("/").pop() ?? path;
	return base.startsWith("_模板") || base.endsWith("模板.md") || /^readme\.md$/i.test(base) || base === "_模块.md";
}

/** 最长前缀匹配；若无前缀命中，再按路径中的目录名（最后一段）匹配，以支持任意层级的 开发文档/ */
export function matchingFolderPrefix(path: string, folders: string[]): string | null {
	const normalized = folders.map((f) => f.replace(/\/+$/, "")).filter((f) => f.length > 0);
	const prefixHits = normalized
		.filter((f) => path === f || path.startsWith(f + "/"))
		.sort((a, b) => b.length - a.length);
	if (prefixHits[0]) return prefixHits[0];

	const parts = path.split("/");
	const nameHits = normalized
		.filter((f) => parts.includes(f.split("/").pop() ?? f))
		.sort((a, b) => b.length - a.length);
	return nameHits[0] ?? null;
}

/** 判断路径是否属于审核范围 */
export function isInScope(path: string, scanFolders: string[], scanRootFiles: string[]): boolean {
	if (isTemplateLike(path)) return false;
	if (matchingFolderPrefix(path, scanFolders)) return true;
	return scanRootFiles.includes(path);
}

export function extractTemplateSpec(tpl: string): TemplateSpec {
	const lines = tpl.split(/\r?\n/);
	const sections: string[] = [];
	const fields: TemplateSpec["fields"] = [];
	let cur: string | null = null;
	const boldFieldRe = /^(?:[-*]\s*|>\s*)\*\*(.+?)\*\*\s*[:：]?\s*(.*)$/;
	const bqFieldRe = /^>\s*([^*\s#][^*：\n]{0,20}?)\s*[:：]\s*(.*)$/;
	for (const raw of lines) {
		const h = raw.match(/^#{2,3}\s+(.+?)\s*$/);
		if (h) {
			cur = h[1].trim();
			sections.push(cur);
			continue;
		}
		const f = raw.match(boldFieldRe);
		if (f && f[1].trim()) {
			fields.push({ section: cur, name: f[1].trim(), placeholder: (f[2] ?? "").trim() });
			continue;
		}
		const b = raw.match(bqFieldRe);
		if (b && b[1].trim()) {
			fields.push({ section: cur, name: b[1].trim(), placeholder: (b[2] ?? "").trim() });
		}
	}
	return { sections, fields };
}

function stripMd(s: string): string {
	return s.replace(/[*_`]/g, "").trim();
}

/** 字段值去掉括号注释与标点后是否为空 */
function isBlankValue(value: string): boolean {
	const s = stripMd(value);
	if (!s) return true;
	const noParen = s.replace(/[（(][^）)]*[）)]/g, "");
	return !noParen.replace(/[-—_/、，,。.：:；;～~\s]/g, "");
}

interface FoundField {
	name: string;
	line: number;
	value: string;
}

function collectFields(content: string): FoundField[] {
	const out: FoundField[] = [];
	const boldFieldRe = /^(?:[-*]\s*|>\s*)\*\*(.+?)\*\*\s*[:：]?\s*(.*)$/;
	const bqFieldRe = /^>\s*([^*\s#][^*：\n]{0,20}?)\s*[:：]\s*(.*)$/;
	const lines = content.split(/\r?\n/);
	lines.forEach((raw, i) => {
		const f = raw.match(boldFieldRe);
		if (f && f[1].trim()) {
			out.push({ name: f[1].trim(), line: i + 1, value: (f[2] ?? "").trim() });
			return;
		}
		const b = raw.match(bqFieldRe);
		if (b && b[1].trim()) {
			out.push({ name: b[1].trim(), line: i + 1, value: (b[2] ?? "").trim() });
		}
	});
	return out;
}

/** 字段行下方紧邻的缩进子行是否提供了实际内容（值可写在子列表里） */
function hasSubContent(lines: string[], fieldIdx: number): boolean {
	for (let j = fieldIdx + 1; j < lines.length; j++) {
		const l = lines[j];
		if (!l.trim()) continue;
		if (/^\s+[-*]\s*\S/.test(l) || l.startsWith("\t")) return true;
		return false;
	}
	return false;
}

let issueSeq = 0;
function mkIssue(p: Omit<Issue, "id" | "source">): Issue {
	issueSeq += 1;
	return { id: `rule-${p.dimension}-${issueSeq}`, source: "rule", ...p };
}

function checkTemplate(path: string, content: string, tpl: TemplateSpec): Issue[] {
	const issues: Issue[] = [];
	const contentLines = content.split(/\r?\n/);
	const contentSections = new Set(
		contentLines
			.map((l) => (l.match(/^#{1,4}\s+(.+?)\s*$/) ?? [])[1])
			.filter((x): x is string => !!x)
			.map((x) => x.trim()),
	);
	for (const sec of tpl.sections) {
		if (!contentSections.has(sec)) {
			issues.push(
				mkIssue({
					dimension: "template",
					severity: "warn",
					section: sec,
					problem: t("rule.missingSection", { sec }),
					suggestion: t("rule.sectionHint"),
				}),
			);
		}
	}
	const found = collectFields(content);
	const byName = new Map<string, FoundField[]>();
	for (const f of found) {
		const arr = byName.get(f.name) ?? [];
		arr.push(f);
		byName.set(f.name, arr);
	}
	for (const tf of tpl.fields) {
		const hits = byName.get(tf.name);
		if (!hits || hits.length === 0) {
			issues.push(
				mkIssue({
					dimension: "template",
					severity: "warn",
					section: tf.section ?? undefined,
					problem: t("rule.missingField", { field: tf.name }),
					suggestion: tf.section
						? t("rule.fieldHintSection", { sec: tf.section, field: tf.name })
						: t("rule.fieldHint", { field: tf.name }),
				}),
			);
			continue;
		}
		const first = hits[0];
		const valueFilled =
			hasSubContent(contentLines, first.line - 1) ||
			(!isBlankValue(first.value) && stripMd(first.value) !== stripMd(tf.placeholder));
		if (!valueFilled) {
			issues.push(
				mkIssue({
					dimension: "template",
					severity: "warn",
					section: tf.section ?? undefined,
					line: first.line,
					problem: t("rule.unfilled", { field: tf.name }),
					suggestion: t("rule.unfilledHint"),
				}),
			);
		}
	}
	return issues;
}

function checkDraft(path: string, content: string, regexSource: string): Issue[] {
	let re: RegExp;
	try {
		re = new RegExp(regexSource, "g");
	} catch {
		re = new RegExp(DEFAULT_DRAFT_REGEX, "g");
	}
	const locations: IssueLocation[] = [];
	const counts = new Map<string, number>();
	content.split(/\r?\n/).forEach((line, i) => {
		// 标题行是结构（如模板自带的「待定项」章节），不作为待确认标记
		if (/^\s*#{1,6}\s/.test(line)) return;
		re.lastIndex = 0;
		if (re.test(line)) {
			const m = line.match(new RegExp(regexSource, "g"));
			const hits = m ?? [];
			for (const h of hits) counts.set(h, (counts.get(h) ?? 0) + 1);
			locations.push({ line: i + 1, text: line.trim().slice(0, 60) });
		}
	});
	if (locations.length === 0) return [];
	const breakdown = [...counts.entries()].map(([k, v]) => `${k}×${v}`).join("、");
	const focus = locations.slice(0, 6).map((l) => `L${l.line}：${l.text}`);
	return [
		mkIssue({
			dimension: "draft",
			severity: "warn",
			problem: t("rule.draft", { n: locations.length, breakdown }),
			suggestion: focus.length ? t("rule.draftHint", { focus: focus.join("\n") }) : undefined,
			locations,
		}),
	];
}

const MD_REF_RE = /`([^`\n]+?\.md)`|\[\[([^\]\n|]+?\.md)(?:\|[^\]\n]*)?\]\]/g;
const WIKILINK_RE = /\[\[([^\]\n|#]+)(?:#[^\]\n|]*)?(?:\|[^\]\n]*)?\]\]/g;

/** 解析引用：支持精确路径、相对路径（./ ../）、同名文件（含补 .md） */
function resolveRef(fromPath: string, ref: string, allPaths: string[]): boolean {
	const candidates = new Set<string>();
	const add = (r: string) => {
		candidates.add(r);
		candidates.add(`${r}.md`);
	};
	add(ref);
	if (ref.startsWith("./") || ref.startsWith("../")) {
		const parts = fromPath.includes("/") ? fromPath.split("/").slice(0, -1) : [];
		let r = ref;
		while (r.startsWith("../")) {
			r = r.slice(3);
			parts.pop();
		}
		r = r.replace(/^\.\//, "");
		if (r) add([...parts, r].join("/"));
	}
	for (const c of candidates) {
		if (allPaths.includes(c)) return true;
	}
	const base = ref.split("/").pop() ?? ref;
	return allPaths.some((p) => {
		const pb = p.split("/").pop() ?? p;
		return pb === base || pb === `${base}.md`;
	});
}

function checkReferences(path: string, content: string, allPaths: string[]): Issue[] {
	const issues: Issue[] = [];
	const lines = content.split(/\r?\n/);
	const seen = new Set<string>();
	lines.forEach((line, i) => {
		for (const re of [MD_REF_RE, WIKILINK_RE]) {
			re.lastIndex = 0;
			let m: RegExpExecArray | null;
			while ((m = re.exec(line)) !== null) {
				const ref = (m[1] ?? m[2] ?? "").trim();
				if (!ref || seen.has(ref)) continue;
				seen.add(ref);
				if (!resolveRef(path, ref, allPaths)) {
					issues.push(
						mkIssue({
							dimension: "reference",
							severity: "warn",
							line: i + 1,
							problem: t("rule.refMissing", { ref }),
							suggestion: t("rule.refHint"),
						}),
					);
				}
			}
		}
	});
	return issues;
}

/** 解析索引文件（如 世界观.md）表格中列出的 .md 路径 */
export function parseIndexEntries(content: string): string[] {
	const out = new Set<string>();
	for (const line of content.split(/\r?\n/)) {
		if (!line.trim().startsWith("|")) continue;
		MD_REF_RE.lastIndex = 0;
		let m: RegExpExecArray | null;
		while ((m = MD_REF_RE.exec(line)) !== null) {
			const ref = (m[1] ?? m[2] ?? "").trim();
			if (ref) out.add(ref);
		}
	}
	return [...out];
}

function commonDir(paths: string[]): string {
	const parts = paths.map((p) => p.split("/"));
	if (parts.some((x) => x.length < 2)) return "";
	let common = parts[0].slice(0, -1);
	for (const segs of parts.slice(1)) {
		const dir = segs.slice(0, -1);
		let i = 0;
		while (i < common.length && i < dir.length && common[i] === dir[i]) i++;
		common = common.slice(0, i);
		if (common.length === 0) break;
	}
	return common.join("/");
}

export function checkIndexFile(indexPath: string, content: string, allPaths: string[]): Issue[] {
	const issues: Issue[] = [];
	const entries = parseIndexEntries(content).filter((p) => p !== indexPath);
	const existing = entries.filter((p) => allPaths.includes(p));
	for (const ref of entries) {
		if (!allPaths.includes(ref)) {
			issues.push(
				mkIssue({
					dimension: "index",
					severity: "error",
					problem: t("rule.indexGhost", { ref }),
					suggestion: t("rule.indexGhostHint", { index: indexPath }),
				}),
			);
		}
	}
	if (existing.length === 0) return issues;

	// 索引覆盖目录：取条目的公共父目录；取不到时回退为「与索引文件同名的目录」
	let folder = commonDir(existing);
	if (!folder) {
		const base = (indexPath.split("/").pop() ?? indexPath).replace(/\.md$/i, "");
		const selfDir = indexPath.includes("/") ? indexPath.split("/").slice(0, -1).join("/") : "";
		const candidate = selfDir ? `${selfDir}/${base}` : base;
		if (allPaths.some((p) => p.startsWith(candidate + "/"))) folder = candidate;
	}
	if (!folder) return issues;

	const indexedSet = new Set(entries);
	for (const f of allPaths) {
		if (!f.startsWith(folder + "/")) continue;
		if (isTemplateLike(f)) continue;
		if (!indexedSet.has(f)) {
			issues.push(
				mkIssue({
					dimension: "index",
					severity: "warn",
					problem: t("rule.indexMissing", { f }),
					suggestion: t("rule.indexMissingHint", { index: indexPath }),
				}),
			);
		}
	}
	return issues;
}

function checkStatusFields(path: string, content: string, checks: StatusCheck[]): Issue[] {
	const issues: Issue[] = [];
	for (const check of checks) {
		if (!matchingFolderPrefix(path, [check.folder])) continue;
		const fieldEsc = check.field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const re = new RegExp(`^[ \\t]*[-*][ \\t]*\\*\\*${fieldEsc}\\*\\*[ \\t]*[:：][ \\t]*([^\\r\\n]*?)[ \\t]*$`, "m");
		const m = content.match(re);
		if (!m) continue;
		const value = stripMd(m[1]);
		if (!value) continue;
		if (check.finals.length > 0 && !check.finals.some((f) => value.includes(f))) {
			issues.push(
				mkIssue({
					dimension: "status",
					severity: "info",
					line: content.slice(0, m.index ?? 0).split(/\r?\n/).length,
					problem: t("rule.statusField", { field: check.field, status: value }),
					suggestion: t("rule.statusFieldHint"),
				}),
			);
		}
	}
	return issues;
}

export function verdictFromIssues(issues: Issue[]): Verdict {
	if (issues.some((i) => i.severity === "error")) return "fail";
	if (issues.some((i) => i.severity === "warn")) return "warn";
	return "pass";
}

export function checkFile(
	path: string,
	content: string,
	allPaths: string[],
	ctx: RuleCheckContext,
	isIndexFile = false,
): RuleCheckResult {
	const issues: Issue[] = [];

	const folder = matchingFolderPrefix(path, Object.keys(ctx.templateMap));
	const tplPath = folder ? ctx.templateMap[folder] : undefined;
	if (folder && tplPath && ctx.templates[tplPath]) {
		issues.push(...checkTemplate(path, content, ctx.templates[tplPath]));
	}

	issues.push(...checkDraft(path, content, ctx.draftMarkerRegex));
	issues.push(...checkReferences(path, content, allPaths));
	issues.push(...checkStatusFields(path, content, ctx.statusChecks ?? []));

	if (isIndexFile) {
		issues.push(...checkIndexFile(path, content, allPaths));
	}

	return { path, status: verdictFromIssues(issues), issues };
}
