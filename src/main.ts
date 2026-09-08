import { MarkdownView, Notice, Plugin, TFile, normalizePath } from "obsidian";
import { Issue, RuleCheckContext, TemplateSpec, StatusCheck, checkFile, extractTemplateSpec, isInScope, isTemplateLike } from "./rules";
import { ReviewStore, effectiveStatus, simpleHash } from "./store";
import { parseAiReport } from "./ingest";
import { AiWorkReviewSettingTab, DEFAULT_SETTINGS, codeProjectDevSettings, needsCodeProjectLayout, parseList, parseStatusChecks, parseTemplateMap } from "./settings";
import type { AiWorkReviewSettings } from "./settings";
import { setLang, t } from "./i18n";
import { ReviewView, VIEW_TYPE_AI_WORK_REVIEW } from "./view";
import {
	BUG_HEADING,
	CHANGE_HEADING,
	SUPPLEMENT_HEADING,
	extractFieldValue,
	isAdjustReqStatus,
	isApprovedReqStatus,
	isBugFixReqStatus,
	hasPendingChange,
	isUnderNamedFolder,
	DEFAULT_DEV_DOC_FOLDER,
	nextApproveStatus,
	nowStamp,
	removeLatestSectionEntry,
	setFieldValue,
	shouldUseProjectDocsLayout,
	targetFolderOf,
	upsertBugSection,
	upsertChangeSection,
	upsertSupplementSection,
} from "./dev";
import { DELIVER_TEMPLATE, REQ_TEMPLATE } from "./dev-templates";

export interface ProposalEntry {
	abs: string;
	added?: number;
	removed?: number;
}

export default class AiWorkReviewPlugin extends Plugin {
	settings: AiWorkReviewSettings = { ...DEFAULT_SETTINGS };
	store: ReviewStore = new ReviewStore(null);
	view: ReviewView | null = null;
	/** vaultPath → 修改稿信息（来自桥接目录 proposals/） */
	proposals: Map<string, ProposalEntry> = new Map();

	private async rawLoad(): Promise<void> {
		const raw = ((await this.loadData()) as any) ?? {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw.settings ?? {});
		this.store = new ReviewStore(raw.store ?? null);
	}

	async saveAll(): Promise<void> {
		await this.saveData({ settings: this.settings, store: this.store.data });
	}

	applyLang(): void {
		setLang(this.settings.language);
	}

	async setMode(mode: "novel" | "dev"): Promise<void> {
		this.settings.mode = mode;
		await this.saveAll();
		this.refreshView();
	}

	async clearStore(): Promise<void> {
		this.store = new ReviewStore(null);
		this.proposals.clear();
		await this.saveAll();
		this.refreshView();
	}

	async onload(): Promise<void> {
		await this.rawLoad();
		this.applyLang();
		this.addSettingTab(new AiWorkReviewSettingTab(this.app, this));

		this.registerView(VIEW_TYPE_AI_WORK_REVIEW, (leaf) => {
			this.view = new ReviewView(leaf, this);
			return this.view;
		});

		this.addRibbonIcon("clipboard-check", t("command.openPanel"), () => this.activateView());

		this.addCommand({ id: "open-panel", name: t("command.openPanel"), callback: () => this.activateView() });
		this.addCommand({ id: "run-rules", name: t("command.runRules"), callback: () => this.runRuleCheck() });
		this.addCommand({ id: "ingest", name: t("command.ingest"), callback: () => this.ingestBridge(true) });
		this.addCommand({ id: "copy-ai-prompt", name: t("command.copyReviewPrompt"), callback: () => this.copyAiPrompt() });
		this.addCommand({ id: "copy-ai-fix-prompt", name: t("command.copyFixPrompt"), callback: () => this.copyAiFixPrompt() });
		this.addCommand({ id: "copy-req-adjust", name: t("command.copyReqAdjust"), callback: () => this.copyReqAdjustPrompt() });
		this.addCommand({ id: "copy-req-start", name: t("command.copyReqStart"), callback: () => this.copyReqStartPrompt() });

		this.app.workspace.onLayoutReady(() => {
			void this.prepareDevLayout().then(() => {
				if (this.settings.autoIngest) {
					this.registerInterval(
						window.setInterval(() => {
							this.ingestBridge(false);
						}, 20000),
					);
				}
				this.ingestBridge(false);
			});
		});
	}

	onunload(): void {
		this.view = null;
	}

	async activateView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(VIEW_TYPE_AI_WORK_REVIEW)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false)!;
			await leaf.setViewState({ type: VIEW_TYPE_AI_WORK_REVIEW, active: true });
		}
		workspace.revealLeaf(leaf);
		this.view?.render();
	}

	refreshView(): void {
		this.view?.render();
	}

	/** 代码项目：模板在技能内，不写进仓库。小说库仍在根目录放需求/交付模板。 */
	private async prepareDevLayout(): Promise<void> {
		const markerNames = ["pubspec.yaml", "package.json", "Cargo.toml", "go.mod", "pyproject.toml", "人物库", "章节库"];
		const topEntries: string[] = [];
		for (const name of markerNames) {
			if (await this.app.vault.adapter.exists(name)) topEntries.push(name);
		}

		const codeProject = shouldUseProjectDocsLayout(topEntries);
		if (needsCodeProjectLayout(this.settings, topEntries)) {
			Object.assign(this.settings, codeProjectDevSettings());
			await this.saveAll();
			this.refreshView();
		}

		if (codeProject) return;

		if (this.settings.devReqFolder) {
			await this.ensureFolder(this.settings.devReqFolder);
			await this.ensureFile(`${this.settings.devReqFolder}/需求模板.md`, REQ_TEMPLATE);
		}
		if (this.settings.devDeliverFolder) {
			await this.ensureFolder(this.settings.devDeliverFolder);
			await this.ensureFile(`${this.settings.devDeliverFolder}/交付模板.md`, DELIVER_TEMPLATE);
		}
	}

	private async ensureFolder(rel: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		let cur = "";
		for (const seg of normalizePath(rel).split("/").filter(Boolean)) {
			cur = cur ? `${cur}/${seg}` : seg;
			if (!(await adapter.exists(cur))) await adapter.mkdir(cur);
		}
	}

	private async ensureFile(rel: string, contents: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		const path = normalizePath(rel);
		if (await adapter.exists(path)) return;
		await this.ensureFolder(path.split("/").slice(0, -1).join("/"));
		await adapter.write(path, contents);
	}

	// ---------- 审核范围 ----------

	scanFolders(): string[] {
		return parseList(this.settings.scanFolders);
	}

	scanRootFiles(): string[] {
		return parseList(this.settings.scanRootFiles);
	}

	indexFiles(): string[] {
		return parseList(this.settings.indexFiles);
	}

	statusChecks(): StatusCheck[] {
		return parseStatusChecks(this.settings.statusChecksText);
	}

	templateMap(): Record<string, string> {
		return parseTemplateMap(this.settings.templateMapText);
	}

	inScopePaths(): string[] {
		return this.app.vault
			.getMarkdownFiles()
			.map((f) => f.path)
			.filter((p) => isInScope(p, this.scanFolders(), this.scanRootFiles()));
	}

	// ---------- 规则检查 ----------

	async runRuleCheck(): Promise<void> {
		const mdFiles = this.app.vault.getMarkdownFiles();
		const allPaths = mdFiles.map((f) => f.path);
		const templateMap = this.templateMap();
		const templates: Record<string, TemplateSpec> = {};
		for (const tplPath of Object.values(templateMap)) {
			const f = this.app.vault.getAbstractFileByPath(tplPath);
			if (f instanceof TFile) {
				templates[tplPath] = extractTemplateSpec(await this.app.vault.cachedRead(f));
			}
		}
		const ctx: RuleCheckContext = {
			templateMap,
			templates,
			draftMarkerRegex: this.settings.draftMarkerRegex,
			statusChecks: this.statusChecks(),
		};
		const indexSet = new Set(this.indexFiles());
		let checked = 0;
		for (const file of mdFiles) {
			if (!isInScope(file.path, this.scanFolders(), this.scanRootFiles())) continue;
			const content = await this.app.vault.cachedRead(file);
			const res = checkFile(file.path, content, allPaths, ctx, indexSet.has(file.path));
			this.store.applyRuleResult(file.path, res.status, res.issues);
			checked++;
		}
		await this.saveAll();
		new Notice(t("notice.ruleDone", { n: checked }));
		this.refreshView();
	}

	// ---------- AI 桥接导入 ----------

	private async walkFiles(dir: string, suffix: string): Promise<string[]> {
		const adapter = this.app.vault.adapter;
		const out: string[] = [];
		try {
			const listing = await adapter.list(dir);
			for (const f of listing.files) {
				if (f.endsWith(suffix)) out.push(f);
			}
			for (const d of listing.folders) {
				out.push(...(await this.walkFiles(d, suffix)));
			}
		} catch {
			// 目录不存在
		}
		return out;
	}

	private async archive(abs: string): Promise<void> {
		const root = normalizePath(this.settings.bridgeFolder);
		const rel = abs.startsWith(root + "/") ? abs.slice(root.length + 1) : abs.split("/").slice(-1)[0];
		const stamp = new Date().toISOString().replace(/[:.]/g, "-");
		const dest = `${root}/archive/${stamp}/${rel}`;
		const adapter = this.app.vault.adapter;
		const parent = dest.split("/").slice(0, -1).join("/");
		let cur = "";
		for (const seg of parent.split("/")) {
			cur = cur ? `${cur}/${seg}` : seg;
			if (!(await adapter.exists(cur))) await adapter.mkdir(cur);
		}
		await adapter.write(dest, await adapter.read(abs));
		await adapter.remove(abs);
	}

	/** 扫描桥接目录：导入新报告，刷新修改稿列表 */
	async ingestBridge(verbose: boolean): Promise<void> {
		const root = normalizePath(this.settings.bridgeFolder);
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(root))) {
			if (verbose) new Notice(t("notice.noBridge", { p: root }));
			return;
		}

		let imported = 0;
		const reportsDir = `${root}/reports`;
		for (const abs of await this.walkFiles(reportsDir, ".json")) {
			let raw: string;
			try {
				raw = await adapter.read(abs);
			} catch {
				continue;
			}
			const { report, error } = parseAiReport(raw);
			if (!report) {
				if (verbose) new Notice(t("notice.reportBad", { f: abs.split("/").pop() ?? abs, e: error ?? "" }));
				continue;
			}
			if (!this.app.vault.getAbstractFileByPath(report.file)) {
				if (verbose) new Notice(t("notice.reportFileMissing", { p: report.file }));
				continue;
			}
			const hash = simpleHash(raw);
			const ts = report.timestamp ? Date.parse(report.timestamp) : NaN;
			const existing = this.store.get(report.file);
			if (existing.aiReportHash === hash) {
				if (this.settings.archiveAfterIngest) await this.archive(abs);
				continue;
			}
			const issues: Issue[] = report.issues.map((it, idx) => ({
				id: `ai-${idx + 1}`,
				source: "ai" as const,
				dimension: it.dimension,
				severity: it.severity,
				section: it.section,
				line: it.line,
				problem: it.problem,
				suggestion: it.suggestion,
			}));
			this.store.applyAiReport(report.file, report.verdict, issues, report.summary, hash, Number.isNaN(ts) ? Date.now() : ts);
			imported++;
			if (this.settings.archiveAfterIngest) await this.archive(abs);
		}

		// 修改稿：整目录扫描刷新列表
		this.proposals.clear();
		const proposalsDir = `${root}/proposals`;
		for (const abs of await this.walkFiles(proposalsDir, ".md")) {
			const target = abs.slice(proposalsDir.length + 1);
			if (!this.app.vault.getAbstractFileByPath(target)) continue;
			this.proposals.set(target, { abs });
		}

		if (imported > 0) await this.saveAll();
		if (imported > 0 || verbose) {
			new Notice(imported > 0 ? t("notice.imported", { n: imported }) : t("notice.noNewReports"));
		}
		this.refreshView();
	}

	/** 应用修改稿：替换原文件并归档 */
	async applyProposal(vaultPath: string): Promise<boolean> {
		const prop = this.proposals.get(vaultPath);
		if (!prop) return false;
		const file = this.app.vault.getAbstractFileByPath(vaultPath);
		if (!(file instanceof TFile)) {
			new Notice(t("notice.targetMissing", { path: vaultPath }));
			return false;
		}
		let newContent: string;
		try {
			newContent = await this.app.vault.adapter.read(prop.abs);
		} catch (e) {
			new Notice(t("notice.readFailed", { msg: (e as Error).message }));
			return false;
		}
		await this.app.vault.process(file, () => newContent);
		this.store.applyFixApplied(vaultPath);
		if (this.settings.archiveAfterIngest) await this.archive(prop.abs);
		await this.removeBridgeFile(this.bridgeAdjustPath(vaultPath));
		this.proposals.delete(vaultPath);
		await this.saveAll();
		new Notice(t("notice.applied", { path: vaultPath }));
		this.refreshView();
		return true;
	}

	// ---------- 人工调整（驳回 + 不足点意见，供 AI 整改） ----------

	bridgeAdjustPath(vaultPath: string): string {
		return `${normalizePath(this.settings.bridgeFolder)}/adjustments/${vaultPath}.json`;
	}

	private async ensureBridgeParent(rel: string): Promise<void> {
		const adapter = this.app.vault.adapter;
		const parent = rel.split("/").slice(0, -1).join("/");
		let cur = "";
		for (const seg of parent.split("/")) {
			cur = cur ? `${cur}/${seg}` : seg;
			if (!(await adapter.exists(cur))) await adapter.mkdir(cur);
		}
	}

	private async removeBridgeFile(rel: string): Promise<void> {
		try {
			const adapter = this.app.vault.adapter;
			if (await adapter.exists(rel)) await adapter.remove(rel);
		} catch {
			// 清理失败不阻塞主流程
		}
	}

	isReqPath(path: string): boolean {
		const doc = this.settings.devDocFolder || DEFAULT_DEV_DOC_FOLDER;
		return isUnderNamedFolder(path, doc) || isUnderNamedFolder(path, this.settings.devReqFolder);
	}

	private async patchMarkdown(path: string, mutate: (content: string) => string): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return false;
		await this.app.vault.process(file, mutate);
		return true;
	}

	async setMarkdownStatus(path: string, status: string): Promise<void> {
		await this.patchMarkdown(path, (c) => setFieldValue(c, "状态", status));
	}

	async approveRequirement(path: string): Promise<void> {
		this.store.applyUserVerdict(path, "pass");
		await this.removeAdjustment(path);
		let next = "已通过";
		if (this.isReqPath(path)) {
			const file = this.app.vault.getAbstractFileByPath(path);
			let current = "";
			let delivered = false;
			if (file instanceof TFile) {
			const content = await this.app.vault.cachedRead(file);
			current = extractFieldValue(content, "状态") ?? "";
			delivered = !!(extractFieldValue(content, "交付日期") ?? "").trim() || hasPendingChange(content);
			}
			next = nextApproveStatus(current, delivered);
			await this.setMarkdownStatus(path, next);
		}
		await this.saveAll();
		new Notice(t(next === "完结" ? "notice.reqClosed" : "notice.reqApproved", { path }));
		this.refreshView();
	}

	/** 记录调整意见（需求阶段）：按新需求重新生成文档。写入插件状态并同步到桥接目录供 AI 读取 */
	async applyUserAdjustment(path: string, note: string, kind: "req" | "file" = "file"): Promise<void> {
		this.store.applyUserVerdict(path, "fail", note);
		await this.writeAdjustmentBridge(path, note, kind);
		if (kind === "req" && this.isReqPath(path)) {
			const stamp = nowStamp();
			let prevStatus = "";
			const ok = await this.patchMarkdown(path, (c) => {
				prevStatus = extractFieldValue(c, "状态") ?? "";
				return upsertSupplementSection(setFieldValue(c, "状态", "调整中"), note, stamp);
			});
			if (ok) this.store.pushUndo({ path, kind: "req", prevStatus, stamp, note });
		}
		await this.saveAll();
		new Notice(t("notice.adjustSaved", { path }));
		this.refreshView();
	}

	/** 记缺陷（只针对 BUG，与调整分开）：记入「缺陷记录」，状态「整改中」 */
	async recordBug(path: string, note: string): Promise<void> {
		this.store.applyUserVerdict(path, "fail", note);
		await this.writeAdjustmentBridge(path, note, "bug");
		if (this.isReqPath(path)) {
			const stamp = nowStamp();
			let prevStatus = "";
			const ok = await this.patchMarkdown(path, (c) => {
				prevStatus = extractFieldValue(c, "状态") ?? "";
				return upsertBugSection(setFieldValue(c, "状态", "整改中"), note, stamp);
			});
			if (ok) this.store.pushUndo({ path, kind: "bug", prevStatus, stamp, note });
		}
		await this.saveAll();
		new Notice(t("notice.bugSaved", { path }));
		this.refreshView();
	}

	/**
	 * 记需求变更（对过代码以后）：记入「需求变更」，状态先到「调整中」——
	 * 先用 /dev-review 调整 把变更合入文档定稿，状态再变「变更中」，最后 /dev-review 变更 落地代码。
	 */
	async recordChange(path: string, note: string): Promise<void> {
		this.store.applyUserVerdict(path, "fail", note);
		await this.writeAdjustmentBridge(path, note, "change");
		if (this.isReqPath(path)) {
			const stamp = nowStamp();
			let prevStatus = "";
			const ok = await this.patchMarkdown(path, (c) => {
				prevStatus = extractFieldValue(c, "状态") ?? "";
				return upsertChangeSection(setFieldValue(c, "状态", "调整中"), note, stamp);
			});
			if (ok) this.store.pushUndo({ path, kind: "change", prevStatus, stamp, note });
		}
		await this.saveAll();
		new Notice(t("notice.changeSaved", { path }));
		this.refreshView();
	}

	/**
	 * 撤回该文档最新一条作者意见：删掉文档里对应条目、恢复记录前的状态、
	 * 清理桥接意见与人工裁决。桥接意见已被 AI 处理（桥接文件被清）时拒绝撤回，避免文档与代码不一致。
	 */
	async undoLatestEntry(path: string): Promise<void> {
		const entry = this.store.peekUndo(path);
		if (!entry) {
			new Notice(t("notice.undoNone"));
			return;
		}
		if (!(await this.app.vault.adapter.exists(this.bridgeAdjustPath(path)))) {
			this.store.popUndo(path);
			await this.saveAll();
			new Notice(t("notice.undoProcessed", { path }));
			return;
		}
		const heading = entry.kind === "change" ? CHANGE_HEADING : entry.kind === "bug" ? BUG_HEADING : SUPPLEMENT_HEADING;
		let removed = "";
		let mismatch = false;
		const ok = await this.patchMarkdown(path, (c) => {
			const res = removeLatestSectionEntry(c, heading);
			removed = res.removed;
			if (!removed) return c;
			if (!removed.includes(entry.stamp)) {
				mismatch = true;
				return c;
			}
			return setFieldValue(res.content, "状态", entry.prevStatus || "待审核");
		});
		this.store.popUndo(path);
		if (!ok || !removed || mismatch) {
			await this.saveAll();
			new Notice(t("notice.undoMissingEntry", { path }));
			this.refreshView();
			return;
		}
		await this.removeBridgeFile(this.bridgeAdjustPath(path));
		this.store.applyUserVerdict(path, undefined);
		await this.saveAll();
		new Notice(t("notice.undone", { path, status: entry.prevStatus || "待审核" }));
		this.refreshView();
	}

	/** 作者意见同步到桥接目录 adjustments/ 供 AI 读取（同一文件只保留最新一条待处理意见） */
	private async writeAdjustmentBridge(path: string, note: string, kind: string): Promise<void> {
		await this.ensureBridgeParent(this.bridgeAdjustPath(path));
		await this.app.vault.adapter.write(
			this.bridgeAdjustPath(path),
			JSON.stringify({ schema: "novel-review/adjustment@1", file: path, timestamp: new Date().toISOString(), note, kind }, null, 2),
		);
	}

	/** 清除人工裁决，同时清理桥接目录中的调整意见 */
	async clearUserVerdict(path: string): Promise<void> {
		this.store.applyUserVerdict(path, undefined);
		await this.removeBridgeFile(this.bridgeAdjustPath(path));
		if (this.isReqPath(path)) {
			const file = this.app.vault.getAbstractFileByPath(path);
			let current = "";
			let content = "";
			if (file instanceof TFile) content = await this.app.vault.cachedRead(file);
			current = extractFieldValue(content, "状态") ?? "";
			const next = current.includes("整改中") || current.includes("完结") || current.includes("已完成")
				? "完结"
				: current.includes("调整") && hasPendingChange(content)
					? "调整中" // 对过代码的调整中：变更还没定稿落地，保持调整中
					: current.includes("变更中") || current.includes("开发中")
						? "开发中"
						: "待审核";
			await this.setMarkdownStatus(path, next);
		}
		await this.saveAll();
		this.refreshView();
	}

	/** 仅清理桥接目录中的调整意见（如人工标记通过时） */
	async removeAdjustment(path: string): Promise<void> {
		await this.removeBridgeFile(this.bridgeAdjustPath(path));
	}

	// ---------- AI 审核指令 ----------

	async copyAiPrompt(): Promise<void> {
		const todo = this.inScopePaths().filter((p) => {
			const { status } = effectiveStatus(this.store.data.files[p]);
			return status !== "pass";
		});
		if (todo.length === 0) {
			new Notice(t("notice.allPassed"));
			return;
		}
		const prompt = [
			t("prompt.reviewIntro"),
			...todo.map((p) => `- ${p}`),
			"",
			t("prompt.contextHintLabel") + "：" + this.settings.aiContextHint,
			t("prompt.reviewSteps"),
		].join("\n");
		await navigator.clipboard.writeText(prompt);
		new Notice(t("notice.reviewCopied", { n: todo.length }));
	}

	/** 复制 AI 整改指令：列出所有带调整意见的文件 */
	async copyAiFixPrompt(): Promise<void> {
		const todo = this.inScopePaths().filter((p) => {
			const fr = this.store.data.files[p];
			return fr?.userVerdict === "fail" && !!fr.userNote;
		});
		if (todo.length === 0) {
			new Notice(t("notice.fixNone"));
			return;
		}
		const prompt = [
			t("prompt.fixIntro"),
			...todo.map((p) => {
				const note = this.store.data.files[p].userNote ?? "";
				const brief = note.length > 60 ? `${note.slice(0, 60)}…` : note;
				return `- ${p}（${brief}）`;
			}),
			"",
			t("prompt.contextHintLabel") + "：" + this.settings.aiContextHint,
			t("prompt.fixSteps"),
		].join("\n");
		await navigator.clipboard.writeText(prompt);
		new Notice(t("notice.fixCopied", { n: todo.length }));
	}

	async listRequirementFiles(): Promise<Array<{ path: string; status?: string; target: string; note?: string }>> {
		const files = this.app.vault.getMarkdownFiles().filter((f) => this.isReqPath(f.path) && !isTemplateLike(f.path));
		const out: Array<{ path: string; status?: string; target: string; note?: string }> = [];
		for (const f of files) {
			const content = await this.app.vault.cachedRead(f);
			out.push({
				path: f.path,
				status: extractFieldValue(content, "状态"),
				target:
					extractFieldValue(content, "目标目录") ||
					targetFolderOf(
						f.path,
						isUnderNamedFolder(f.path, this.settings.devDocFolder || DEFAULT_DEV_DOC_FOLDER)
							? this.settings.devDocFolder || DEFAULT_DEV_DOC_FOLDER
							: this.settings.devReqFolder,
					),
				note: this.store.data.files[f.path]?.userNote,
			});
		}
		return out;
	}

	async copyReqAdjustPrompt(): Promise<void> {
		const all = await this.listRequirementFiles();
		const bugs = all.filter((r) => (r.status ?? "").includes("整改中"));
		const changes = all.filter((r) => (r.status ?? "").includes("变更中"));
		const adjs = all.filter(
			(r) =>
				(isAdjustReqStatus(r.status) || (!!r.note && !isBugFixReqStatus(r.status) && !(r.status ?? "").includes("变更中"))) &&
				!bugs.includes(r) &&
				!changes.includes(r),
		);
		if (adjs.length === 0 && bugs.length === 0 && changes.length === 0) {
			new Notice(t("notice.reqAdjustNone"));
			return;
		}
		const line = (r: { path: string; target: string; note?: string }) => {
			const note = r.note ? `\n  ${t("note.prefix")}${r.note}` : "";
			return `- \`${r.path}\`（${t("dev.targetFolder")}：${r.target || "—"}）${note}`;
		};
		const prompt = [
			...(adjs.length ? [t("prompt.reqAdjustIntro"), ...adjs.map(line), ""] : []),
			...(changes.length ? [t("prompt.reqChangeIntro"), ...changes.map(line), ""] : []),
			...(bugs.length ? [t("prompt.reqBugIntro"), ...bugs.map(line), ""] : []),
			t("prompt.contextHintLabel") + "：" + this.settings.aiContextHint,
		].join("\n");
		await navigator.clipboard.writeText(prompt);
		new Notice(t("notice.reqAdjustCopied", { n: adjs.length + bugs.length + changes.length }));
	}

	async copyReqStartPrompt(): Promise<void> {
		const todo = (await this.listRequirementFiles()).filter((r) => {
			const s = r.status ?? "";
			return isApprovedReqStatus(s) && !s.includes("开发中") && !s.includes("已交付") && !s.includes("变更中") && !s.includes("整改中");
		});
		if (todo.length === 0) {
			new Notice(t("notice.reqStartNone"));
			return;
		}
		const prompt = [
			t("prompt.reqStartIntro"),
			...todo.map((r) => `- \`${r.path}\`（${t("dev.targetFolder")}：${r.target || "—"}）`),
			"",
			t("prompt.contextHintLabel") + "：" + this.settings.aiContextHint,
		].join("\n");
		await navigator.clipboard.writeText(prompt);
		new Notice(t("notice.reqStartCopied", { n: todo.length }));
	}

	// ---------- 打开文件定位 ----------

	async openAt(path: string, line?: number): Promise<void> {
		await this.app.workspace.openLinkText(path, "", false);
		if (line == null) return;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view) return;
		const editor = view.editor;
		const l = Math.min(Math.max(0, line - 1), Math.max(0, editor.lineCount() - 1));
		editor.setCursor({ line: l, ch: 0 });
		editor.scrollIntoView({ from: { line: l, ch: 0 }, to: { line: l, ch: 0 } }, true);
	}
}
