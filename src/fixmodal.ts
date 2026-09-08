import { App, Modal, Notice, TFile } from "obsidian";
import { DiffRow, diffStats } from "./diff";
import { t } from "./i18n";
import type AiWorkReviewPlugin from "./main";

/** 修改稿对照弹窗：统一 diff 视图，确认后替换原文件 */
export class FixModal extends Modal {
	plugin: AiWorkReviewPlugin;
	vaultPath: string;
	proposalContent: string;
	rows: DiffRow[];
	private onlyChanges = true;

	constructor(app: App, plugin: AiWorkReviewPlugin, vaultPath: string, proposalContent: string, rows: DiffRow[]) {
		super(app);
		this.plugin = plugin;
		this.vaultPath = vaultPath;
		this.proposalContent = proposalContent;
		this.rows = rows;
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass("nr-fix-modal");
		this.titleEl.setText(t("fix.title", { path: this.vaultPath }));
		const { added, removed } = diffStats(this.rows);
		const content = this.contentEl;
		content.empty();
		content.addClass("nr-fix-content");

		const bar = content.createDiv({ cls: "nr-fix-bar" });
		bar.createSpan({ cls: "nr-fix-stats", text: t("fix.stats", { added, removed }) });
		const toggleWrap = bar.createSpan({ cls: "nr-fix-toggle" });
		const cb = toggleWrap.createEl("input", { type: "checkbox" });
		cb.checked = this.onlyChanges;
		toggleWrap.createSpan({ text: t("fix.onlyChanges") });
		cb.addEventListener("change", () => {
			this.onlyChanges = cb.checked;
			renderRows();
		});

		const diffBox = content.createDiv({ cls: "nr-diff" });
		const renderRows = () => {
			diffBox.empty();
			for (const r of this.rows) {
				if (this.onlyChanges && r.type === "same") continue;
				const line = diffBox.createDiv({ cls: `nr-diff-row nr-diff-${r.type}` });
				line.createSpan({
					cls: "nr-diff-lineno",
					text: `${r.left ?? ""} ${r.right ?? ""}`.trimEnd(),
				});
				line.createSpan({
					cls: "nr-diff-sign",
					text: r.type === "add" ? "+" : r.type === "del" ? "-" : " ",
				});
				line.createSpan({ cls: "nr-diff-text", text: r.text || " " });
			}
			if (!diffBox.childElementCount) {
				diffBox.createDiv({ cls: "nr-empty", text: t("fix.identical") });
			}
		};
		renderRows();

		const btnRow = content.createDiv({ cls: "nr-fix-buttons" });
		const apply = btnRow.createEl("button", { cls: "mod-cta", text: t("fix.apply") });
		apply.addEventListener("click", () => {
			const file = this.app.vault.getAbstractFileByPath(this.vaultPath);
			if (!(file instanceof TFile)) {
				new Notice(t("notice.targetMissing", { path: this.vaultPath }));
				this.close();
				return;
			}
			this.close();
			void this.plugin.applyProposal(this.vaultPath);
		});
		const cancel = btnRow.createEl("button", { text: t("fix.cancel") });
		cancel.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
