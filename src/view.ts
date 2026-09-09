import { App, ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { Issue, isTemplateLike } from "./rules";
import { effectiveStatus } from "./store";
import { diffLines } from "./diff";
import { collectDevTasks, DevFileRef, DevTask, DEFAULT_DEV_DOC_FOLDER, devAuthorActions, isUnderNamedFolder, targetFolderOf, taskState } from "./dev";
import { t } from "./i18n";
import type AiWorkReviewPlugin from "./main";
import { FixModal } from "./fixmodal";
import { AdjustModal } from "./adjustmodal";
import { DevEntryModal, UndoModal } from "./devmodals";

export const VIEW_TYPE_AI_WORK_REVIEW = "ai-work-review-view";

const DIM_KEY: Record<string, string> = {
	template: "dim.template",
	draft: "dim.draft",
	reference: "dim.reference",
	index: "dim.index",
	status: "dim.status",
	consistency: "dim.consistency",
	quality: "dim.quality",
	plot: "dim.plot",
	character: "dim.character",
};

const GROUP_ORDER = ["__root__", "世界观", "人物库", "大道库", "事件库", "技能库", "章节库"];

export class ReviewView extends ItemView {
	plugin: AiWorkReviewPlugin;
	private expanded = new Set<string>();
	private onlyIssues = false;
	private currentPath: string | null = null;
	private renderSeq = 0;

	constructor(leaf: WorkspaceLeaf, plugin: AiWorkReviewPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_AI_WORK_REVIEW;
	}

	getDisplayText(): string {
		return t("panel.title");
	}

	getIcon(): string {
		return "clipboard-check";
	}

	async onOpen(): Promise<void> {
		this.registerEvent(
			this.app.workspace.on("file-open", (f) => {
				this.currentPath = f?.path ?? null;
				void this.render();
			}),
		);
		await this.render();
	}

	async onClose(): Promise<void> {}

	async render(): Promise<void> {
		const seq = ++this.renderSeq;
		const root = this.contentEl;
		root.empty();
		root.addClass("nr-root");

		// ---- 顶部：标题 + 模式切换 ----
		const header = root.createDiv({ cls: "nr-header" });
		const titleRow = header.createDiv({ cls: "nr-title-row" });
		titleRow.createDiv({ cls: "nr-title", text: t("panel.title") });
		const mode = this.plugin.settings.mode;
		const modes = titleRow.createDiv({ cls: "nr-modes" });
		const mbtn = (m: "novel" | "dev", label: string) => {
			modes
				.createEl("button", { cls: `nr-btn nr-btn-sm ${mode === m ? "nr-btn-active" : ""}`, text: label })
				.addEventListener("click", () => void this.plugin.setMode(m));
		};
		mbtn("novel", t("mode.novel"));
		mbtn("dev", t("mode.dev"));

		if (mode === "dev") {
			await this.renderDev(root, seq);
			return;
		}
		if (seq !== this.renderSeq) return;
		this.renderNovel(root);
	}

	// ==================== 小说模式：逐文件审核 ====================

	private renderNovel(root: HTMLElement): void {
		const store = this.plugin.store;
		const devFolders = [
			this.plugin.settings.devDocFolder,
			this.plugin.settings.devReqFolder,
			this.plugin.settings.devDeliverFolder,
		].filter(Boolean);
		const paths = this.plugin
			.inScopePaths()
			.filter((p) => !devFolders.some((f) => isUnderNamedFolder(p, f)));

		// ---- 统计 ----
		const stats = { pass: 0, warn: 0, fail: 0, unchecked: 0 };
		for (const p of paths) {
			const { status } = effectiveStatus(store.data.files[p]);
			stats[status]++;
		}
		const statRow = root.createDiv({ cls: "nr-stats" });
		const chip = (cls: string, label: string, n: number) => {
			statRow.createSpan({ cls: `nr-chip ${cls}`, text: `${label} ${n}` });
		};
		chip("nr-chip-fail", t("status.fail"), stats.fail);
		chip("nr-chip-warn", t("status.warn"), stats.warn);
		chip("nr-chip-pass", t("status.pass"), stats.pass);
		chip("nr-chip-unchecked", t("status.unchecked"), stats.unchecked);

		// ---- 操作按钮 ----
		this.renderActions(root);

		// ---- 分组文件列表 ----
		const list = root.createDiv({ cls: "nr-list" });
		if (paths.length === 0) {
			list.createDiv({ cls: "nr-empty", text: t("view.emptyScope") });
			return;
		}

		const groups = new Map<string, string[]>();
		for (const p of paths) {
			const g = p.includes("/") ? p.split("/")[0] : "__root__";
			const arr = groups.get(g) ?? [];
			arr.push(p);
			groups.set(g, arr);
		}
		const groupNames = [...groups.keys()].sort((a, b) => {
			const ia = GROUP_ORDER.indexOf(a);
			const ib = GROUP_ORDER.indexOf(b);
			return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "zh-Hans-CN");
		});

		let visibleCount = 0;
		for (const g of groupNames) {
			let groupPaths = store.sortedPaths(groups.get(g)!);
			if (this.onlyIssues) {
				groupPaths = groupPaths.filter((p) => effectiveStatus(store.data.files[p]).status !== "pass");
			}
			if (groupPaths.length === 0) continue;
			visibleCount += groupPaths.length;
			const label = g === "__root__" ? t("group.root") : g;
			list.createDiv({ cls: "nr-group-title", text: `${label}（${groupPaths.length}）` });
			for (const p of groupPaths) this.renderFileRow(list, p);
		}
		if (visibleCount === 0) {
			list.createDiv({ cls: "nr-empty", text: t("view.emptyFiltered") });
		}
	}

	// ==================== 开发模式：任务流水线评审 ====================

	private async renderDev(root: HTMLElement, seq: number): Promise<void> {
		const docFolder = this.plugin.settings.devDocFolder || DEFAULT_DEV_DOC_FOLDER;
		const reqFolder = this.plugin.settings.devReqFolder;
		const delFolder = this.plugin.settings.devDeliverFolder;

		const files = this.app.vault
			.getMarkdownFiles()
			.filter(
				(f) =>
					!isTemplateLike(f.path) &&
					(isUnderNamedFolder(f.path, docFolder) ||
						isUnderNamedFolder(f.path, reqFolder) ||
						(!!delFolder && isUnderNamedFolder(f.path, delFolder))),
			);
		const docs: DevFileRef[] = [];
		const reqs: DevFileRef[] = [];
		const dels: DevFileRef[] = [];
		for (const f of files) {
			const content = await this.app.vault.cachedRead(f);
			if (isUnderNamedFolder(f.path, docFolder)) docs.push({ path: f.path, content });
			else if (isUnderNamedFolder(f.path, reqFolder)) reqs.push({ path: f.path, content });
			else dels.push({ path: f.path, content });
		}
		if (seq !== this.renderSeq) return;

		const tasks = collectDevTasks(docs, reqs, dels, docFolder)
			.map((tk) => ({
				...tk,
				targetFolder:
					tk.targetFolder ||
					(tk.reqPath
						? targetFolderOf(tk.reqPath, tk.unified ? docFolder : reqFolder)
						: tk.deliverPath
							? targetFolderOf(tk.deliverPath, delFolder || docFolder)
							: ""),
			}))
			.sort((a, b) => {
				const ka = taskState(a).kind === "final" ? 1 : 0;
				const kb = taskState(b).kind === "final" ? 1 : 0;
				return ka - kb || a.slug.localeCompare(b.slug, "zh-Hans-CN");
			});

		// ---- 统计 chips（按任务阶段） ----
		const statRow = root.createDiv({ cls: "nr-stats" });
		const counts = new Map<string, number>();
		for (const tk of tasks) {
			const label = taskState(tk).label || "—";
			counts.set(label, (counts.get(label) ?? 0) + 1);
		}
		for (const [label, n] of counts) {
			statRow.createSpan({ cls: "nr-chip", text: `${label} ${n}` });
		}
		const bugPending = tasks.reduce((n, tk) => n + (tk.bugPending ?? 0), 0);
		if (bugPending > 0) statRow.createSpan({ cls: "nr-chip nr-chip-bug", text: t("dev.bugPendingChip", { n: bugPending }) });

		this.renderActions(root);

		const list = root.createDiv({ cls: "nr-list" });
		const visible = this.onlyIssues ? tasks.filter((tk) => taskState(tk).kind !== "final") : tasks;
		if (visible.length === 0) {
			list.createDiv({ cls: "nr-empty", text: tasks.length === 0 ? t("dev.noTasks") : t("view.emptyFiltered") });
			return;
		}
		const groups = new Map<string, DevTask[]>();
		for (const tk of visible) {
			const g = tk.targetFolder || t("group.root");
			const arr = groups.get(g) ?? [];
			arr.push(tk);
			groups.set(g, arr);
		}
		for (const [g, items] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-Hans-CN"))) {
			list.createDiv({ cls: "nr-group-title", text: `${g}（${items.length}）` });
			for (const tk of items) this.renderTaskRow(list, tk);
		}
	}

	private renderTaskRow(container: HTMLElement, tk: DevTask): void {
		const key = `task:${tk.slug}`;
		const st = taskState(tk);
		const dotCls =
			st.kind === "final"
				? "nr-dot-pass"
				: st.kind === "ready"
					? "nr-dot-ready"
					: st.kind === "wait"
						? "nr-dot-warn"
						: "nr-dot-unchecked";
		const reviewPath = tk.deliverPath ?? tk.reqPath;
		const fr = reviewPath ? this.plugin.store.data.files[reviewPath] : undefined;
		const issueCount = (fr?.ruleIssues.length ?? 0) + (fr?.aiIssues.length ?? 0);

		const row = container.createDiv({ cls: "nr-file" });
		if (reviewPath === this.currentPath) row.addClass("nr-file-current");

		const head = row.createDiv({ cls: "nr-file-head" });
		head.createSpan({ cls: `nr-dot ${dotCls}`, title: `${t("dev.taskStatus")}：${st.label || "—"}` });
		const name = head.createSpan({ cls: "nr-file-name", text: tk.slug });
		if (reviewPath) name.addEventListener("click", () => void this.plugin.openAt(reviewPath));
		if (st.label) head.createSpan({ cls: "nr-badge", text: st.label });
		if (tk.reqPath) {
			const actionsEl = head.createDiv({ cls: "nr-file-actions" });
			// 「需求变更」有未落实条目 = 已对过代码（调整中→变更中 流转），按代码期给按钮
			this.renderDevAuthorButtons(actionsEl, tk.reqPath, tk.reqStatus ?? "", !!tk.deliverDate || !!tk.pendingChange);
		}
		if (reviewPath && this.plugin.proposals.has(reviewPath))
			head.createSpan({ cls: "nr-badge nr-badge-proposal", text: t("badge.proposal") });
		if (issueCount > 0) head.createSpan({ cls: "nr-badge nr-badge-count", text: `${issueCount}` });
		if (tk.bugTotal) {
			head.createSpan({
				cls: `nr-badge nr-badge-bug${tk.bugPending ? " nr-badge-bug-open" : ""}`,
				text: t("dev.bugBadge", { n: tk.bugTotal }),
				title: t("dev.bugBadgeTitle", { total: tk.bugTotal, pending: tk.bugPending ?? 0 }),
			});
		}
		const chev = head.createSpan({ cls: "nr-chevron", text: this.expanded.has(key) ? "▾" : "▸" });
		chev.addEventListener("click", () => {
			if (this.expanded.has(key)) this.expanded.delete(key);
			else this.expanded.add(key);
			void this.render();
		});

		if (!this.expanded.has(key)) return;

		const body = row.createDiv({ cls: "nr-file-body" });
		const line = (label: string, path: string | undefined, extra: string) => {
			const d = body.createDiv({ cls: "nr-task-line" });
			d.createSpan({ cls: "nr-verdict-label", text: `${label}：` });
			if (path) {
				const a = d.createSpan({ cls: "nr-file-name nr-task-link", text: path.split("/").pop() ?? path });
				a.addEventListener("click", () => void this.plugin.openAt(path));
			}
			if (extra) d.createSpan({ cls: "nr-badge", text: extra });
		};
		line(t("dev.doc"), tk.reqPath, tk.reqStatus ?? "");
		if (tk.codeTarget) line(t("dev.targetFolder"), undefined, tk.codeTarget);
		else if (tk.targetFolder) line(t("dev.targetFolder"), undefined, tk.targetFolder);
		if (!tk.unified) {
			line(t("dev.deliver"), tk.deliverPath, tk.deliverPath ? [tk.deliverStatus, tk.deliverDate].filter(Boolean).join(" · ") : t("dev.notDelivered"));
		} else if (tk.deliverDate) {
			line(t("dev.deliverDate"), undefined, tk.deliverDate);
		}
		if (tk.bugTotal) line(t("dev.bugs"), undefined, t("dev.bugCountLine", { total: tk.bugTotal, pending: tk.bugPending ?? 0 }));

		const target = tk.deliverPath ?? tk.reqPath;
		if (target) this.renderFileRow(body, target, { omitVerdict: true });
	}

	/**
	 * 开发文档作者按钮。
	 * 需求阶段：通过 + 调整（按新需求重新生成文档）。
	 * 对过代码的调整中：定稿（确认变更已合入文档，→变更中）+ 缺陷 + 需求变更。
	 * 其余对过代码以后：完结 + 缺陷 + 需求变更（落地代码）。
	 * 缺陷/变更走 DevEntryModal：不预填旧意见，避免把上一次的内容带进另一个弹窗。
	 */
	private renderDevAuthorButtons(container: HTMLElement, path: string, status: string, delivered: boolean): void {
		const actions = devAuthorActions(status, delivered);
		const note = () => this.plugin.store.data.files[path]?.userNote ?? "";
		const btn = (label: string, active: boolean, onClick: () => void, title?: string) => {
			const el = container.createEl("button", { cls: `nr-btn nr-btn-sm ${active ? "nr-btn-active" : ""}`, text: label });
			if (title) el.title = title;
			el.addEventListener("click", (e) => {
				e.stopPropagation();
				onClick();
			});
		};
		const settleOn = actions.approve === "settle";
		const passOn = settleOn
			? false
			: actions.approve === "done"
				? status.includes("完结") || status.includes("已完成")
				: status.includes("已通过");
		const approveLabel = settleOn ? t("verdict.settle") : actions.approve === "done" ? t("verdict.done") : t("verdict.pass");
		btn(approveLabel, passOn, () => void this.plugin.approveRequirement(path), settleOn ? t("dev.settleHint") : undefined);
		if (actions.adjust) {
			btn(t("verdict.adjust"), status.includes("调整") && !status.includes("变更"), () => {
				new AdjustModal(this.app, this.plugin, path, note(), "req").open();
			});
		}
		if (actions.bug) {
			btn(t("verdict.bug"), status.includes("整改中"), () => {
				new DevEntryModal(this.app, this.plugin, path, "bug").open();
			});
		}
		if (actions.change) {
			btn(t("verdict.change"), status.includes("变更中"), () => {
				new DevEntryModal(this.app, this.plugin, path, "change").open();
			});
		}
		if (this.plugin.store.peekUndo(path)) {
			btn(t("verdict.undo"), false, () => {
				new UndoModal(this.app, this.plugin, path).open();
			});
		}
	}

	// ==================== 共用部件 ====================

	private renderActions(root: HTMLElement): void {
		const actions = root.createDiv({ cls: "nr-actions" });
		const btn = (label: string, cb: () => void | Promise<void>, cls = "") => {
			actions.createEl("button", { cls: `nr-btn ${cls}`, text: label }).addEventListener("click", () => void cb());
		};
		btn(t("action.recheck"), () => this.plugin.runRuleCheck(), "nr-btn-primary");
		btn(t("action.ingest"), () => this.plugin.ingestBridge(true));
		btn(t("action.copyReview"), () => this.plugin.copyAiPrompt());
		btn(t("action.copyFix"), () => this.plugin.copyAiFixPrompt());
		if (this.plugin.settings.mode === "dev") {
			btn(t("action.copyReqAdjust"), () => this.plugin.copyReqAdjustPrompt());
			btn(t("action.copyReqStart"), () => this.plugin.copyReqStartPrompt(), "nr-btn-primary");
		}
		actions
			.createEl("button", { cls: `nr-btn ${this.onlyIssues ? "nr-btn-active" : ""}`, text: t("action.onlyIssues") })
			.addEventListener("click", () => {
				this.onlyIssues = !this.onlyIssues;
				void this.render();
			});
			actions
				.createEl("button", { cls: "nr-btn", text: t("action.settings") })
				.addEventListener("click", () => {
					const setting = (this.app as App & { setting?: { open(): void; openTabById(id: string): void } }).setting;
					if (setting) {
						setting.open();
						setting.openTabById("ai-work-review");
					}
				});
	}

	/** 打开修改稿对照弹窗：读原文件与修改稿，生成统一 diff */
	private async openProposalDiff(path: string, abs: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) {
			new Notice(t("notice.targetMissing", { path }));
			return;
		}
		let proposalContent: string;
		try {
			proposalContent = await this.app.vault.adapter.read(abs);
		} catch (e) {
			new Notice(t("notice.readFailed", { msg: (e as Error).message }));
			return;
		}
		const original = await this.app.vault.cachedRead(file);
		const rows = diffLines(original.split(/\r?\n/), proposalContent.split(/\r?\n/));
		new FixModal(this.app, this.plugin, path, proposalContent, rows).open();
	}

	/** 面板「通过」：开发任务走 approveRequirement，普通文件直接记通过 */
	private async applyVerdictPass(path: string): Promise<void> {
		if (this.plugin.isReqPath(path)) {
			await this.plugin.approveRequirement(path);
			return;
		}
		this.plugin.store.applyUserVerdict(path, "pass");
		await this.plugin.removeAdjustment(path);
		await this.plugin.saveAll();
		void this.render();
	}

	private renderFileRow(container: HTMLElement, path: string, opts?: { omitVerdict?: boolean }): void {
		const store = this.plugin.store;
		const fr = store.data.files[path];
		const { status, origin } = effectiveStatus(fr);
		const base = path.split("/").pop() ?? path;
		const issueCount = (fr?.ruleIssues.length ?? 0) + (fr?.aiIssues.length ?? 0);
		const proposal = this.plugin.proposals.get(path);

		const row = container.createDiv({ cls: "nr-file" });
		if (path === this.currentPath) row.addClass("nr-file-current");

		const head = row.createDiv({ cls: "nr-file-head" });
		const originText = origin === "none" ? "" : `（${t(`origin.${origin}`)}）`;
		const dot = head.createSpan({ cls: `nr-dot nr-dot-${status}` });
		dot.title = `${t(`status.${status}`)}${originText}`;
		const nameEl = head.createSpan({ cls: "nr-file-name", text: base });
		nameEl.addEventListener("click", () => void this.plugin.openAt(path));

		if (proposal) head.createSpan({ cls: "nr-badge nr-badge-proposal", text: t("badge.proposal") });
		if (fr?.userVerdict === "fail") head.createSpan({ cls: "nr-badge nr-badge-adj", text: t("badge.adjusting") });
		if (origin === "user" && fr?.userVerdict === "pass") head.createSpan({ cls: "nr-badge", text: t("badge.userPass") });
		if (fr?.aiVerdict) head.createSpan({ cls: "nr-badge nr-badge-ai", text: t("badge.ai", { status: t(`status.${fr.aiVerdict}`) }) });
		if (issueCount > 0) head.createSpan({ cls: "nr-badge nr-badge-count", text: `${issueCount}` });

		const chev = head.createSpan({
			cls: "nr-chevron",
			text: this.expanded.has(path) ? "▾" : "▸",
		});
		chev.addEventListener("click", (e) => {
			e.stopPropagation();
			if (this.expanded.has(path)) this.expanded.delete(path);
			else this.expanded.add(path);
			void this.render();
		});

		if (!this.expanded.has(path)) return;

		const body = row.createDiv({ cls: "nr-file-body" });

		// 修改稿横幅
		if (proposal) {
			const banner = body.createDiv({ cls: "nr-proposal-banner" });
			banner.createSpan({ text: t("banner.proposal") });
			const bbtn = banner.createEl("button", { cls: "nr-btn nr-btn-primary", text: t("banner.view") });
			bbtn.addEventListener("click", () => {
				void this.openProposalDiff(path, proposal.abs);
			});
		}

		// AI 总评
		if (fr?.aiSummary) {
			body.createDiv({ cls: "nr-ai-summary", text: `${t("summary.prefix")}${fr.aiSummary}` });
		}

		// 调整意见
		if (fr?.userVerdict === "fail" && fr?.userNote) {
			body.createDiv({ cls: "nr-user-note", text: `${t("note.prefix")}${fr.userNote}` });
		}

		// 人工裁决（开发任务的作者按钮在任务行上，这里不再重复成「通过/调整」）
		if (!opts?.omitVerdict) {
			const verdictRow = body.createDiv({ cls: "nr-verdict" });
			verdictRow.createSpan({ cls: "nr-verdict-label", text: t("verdict.label") });
			const vbtn = (label: string, cb: () => void, active: boolean) => {
				verdictRow.createEl("button", { cls: `nr-btn nr-btn-sm ${active ? "nr-btn-active" : ""}`, text: label }).addEventListener("click", cb);
			};
			vbtn(t("verdict.pass"), () => {
				void this.applyVerdictPass(path);
			}, fr?.userVerdict === "pass");
			vbtn(t("verdict.adjust"), () => {
				new AdjustModal(this.app, this.plugin, path, fr?.userNote ?? "", this.plugin.isReqPath(path) ? "req" : "file").open();
			}, fr?.userVerdict === "fail");
			if (fr?.userVerdict) {
				vbtn(t("verdict.clear"), () => {
					void this.plugin.clearUserVerdict(path);
				}, false);
			}
		}

		// 问题列表
		const issues: Array<{ issue: Issue; src: string }> = [
			...(fr?.ruleIssues ?? []).map((issue) => ({ issue, src: t("src.rule") })),
			...(fr?.aiIssues ?? []).map((issue) => ({ issue, src: t("src.ai") })),
		];
		if (issues.length === 0) {
			body.createDiv({ cls: "nr-noissue", text: status === "unchecked" ? t("issues.unchecked") : t("issues.clean") });
		} else {
			const ul = body.createDiv({ cls: "nr-issues" });
			for (const { issue, src } of issues) this.renderIssue(ul, path, issue, src);
		}
	}

	private renderIssue(container: HTMLElement, path: string, issue: Issue, src: string): void {
		const item = container.createDiv({ cls: `nr-issue nr-sev-${issue.severity}` });
		const top = item.createDiv({ cls: "nr-issue-head" });
		top.createSpan({ cls: `nr-sev-icon nr-sev-${issue.severity}`, text: issue.severity === "error" ? "✖" : issue.severity === "warn" ? "⚠" : "ℹ" });
		top.createSpan({ cls: "nr-dim", text: t(DIM_KEY[issue.dimension] ?? "dim.other") });
		top.createSpan({ cls: "nr-src", text: src });
		if (issue.line != null) top.createSpan({ cls: "nr-line", text: `L${issue.line}` });
		if (issue.section) top.createSpan({ cls: "nr-section", text: issue.section });
		const prob = item.createDiv({ cls: "nr-problem", text: issue.problem });
		prob.addEventListener("click", () => void this.plugin.openAt(path, issue.line));
		if (issue.suggestion) item.createDiv({ cls: "nr-suggestion", text: t("issue.suggestionPrefix", { text: issue.suggestion }) });
	}
}
