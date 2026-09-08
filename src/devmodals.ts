import { App, Modal, Notice } from "obsidian";
import { t } from "./i18n";
import type AiWorkReviewPlugin from "./main";

/**
 * 缺陷 / 需求变更 录入弹窗，与「调整」分开：
 * 每次提交都是按日期追加的新条目，不预填上一次的意见——
 * 否则填过需求变更再点缺陷，会把变更内容带进缺陷弹窗。
 * 缺陷只记 BUG；需求变更只在对过代码以后做代码落地。
 */
export class DevEntryModal extends Modal {
	plugin: AiWorkReviewPlugin;
	vaultPath: string;
	kind: "bug" | "change";

	constructor(app: App, plugin: AiWorkReviewPlugin, vaultPath: string, kind: "bug" | "change") {
		super(app);
		this.plugin = plugin;
		this.vaultPath = vaultPath;
		this.kind = kind;
	}

	onOpen(): void {
		const p = this.kind === "bug" ? "bug" : "change";
		this.titleEl.setText(t(`${p}.title`, { path: this.vaultPath }));
		const content = this.contentEl;
		content.addClass("nr-adjust-modal");
		content.createDiv({ cls: "nr-adjust-hint", text: t(this.kind === "bug" ? "dev.reqBugHint" : "dev.reqChangeHint") });
		const ta = content.createEl("textarea", { cls: "nr-adjust-textarea" });
		ta.value = "";
		ta.placeholder = t(this.kind === "bug" ? "dev.reqBugPlaceholder" : "dev.reqChangePlaceholder");
		const btnRow = content.createDiv({ cls: "nr-fix-buttons" });
		const ok = btnRow.createEl("button", { cls: "mod-cta", text: t(`${p}.submit`) });
		ok.addEventListener("click", () => {
			const note = ta.value.trim();
			if (!note) {
				new Notice(t("notice.adjustEmpty"));
				return;
			}
			this.close();
			const submit =
				this.kind === "bug" ? this.plugin.recordBug(this.vaultPath, note) : this.plugin.recordChange(this.vaultPath, note);
			void submit;
		});
		const cancel = btnRow.createEl("button", { text: t("adjust.cancel") });
		cancel.addEventListener("click", () => this.close());
		ta.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ok.click();
		});
		window.setTimeout(() => ta.focus(), 50);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** 撤回确认弹窗：展示将删除的最新意见（时间/类型/内容），确认后才动文档 */
export class UndoModal extends Modal {
	plugin: AiWorkReviewPlugin;
	vaultPath: string;

	constructor(app: App, plugin: AiWorkReviewPlugin, vaultPath: string) {
		super(app);
		this.plugin = plugin;
		this.vaultPath = vaultPath;
	}

	onOpen(): void {
		const entry = this.plugin.store.peekUndo(this.vaultPath);
		if (!entry) {
			this.close();
			return;
		}
		const kindKey = entry.kind === "change" ? "undo.kindChange" : entry.kind === "bug" ? "undo.kindBug" : "undo.kindReq";
		this.titleEl.setText(t("undo.title", { path: this.vaultPath }));
		const content = this.contentEl;
		content.addClass("nr-adjust-modal");
		content.createDiv({ cls: "nr-adjust-hint", text: t("undo.hint") });
		const preview = content.createDiv({ cls: "nr-user-note" });
		preview.setText(`${entry.stamp} · ${t(kindKey)}\n${entry.note}`);
		const btnRow = content.createDiv({ cls: "nr-fix-buttons" });
		const ok = btnRow.createEl("button", { cls: "mod-cta", text: t("undo.submit") });
		ok.addEventListener("click", () => {
			this.close();
			void this.plugin.undoLatestEntry(this.vaultPath);
		});
		const cancel = btnRow.createEl("button", { text: t("adjust.cancel") });
		cancel.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

