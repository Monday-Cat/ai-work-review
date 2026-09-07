import { App, Modal, Notice } from "obsidian";
import { t } from "./i18n";
import type AiWorkReviewPlugin from "./main";

/** 调整意见弹窗：作者写明不足点与修改要求，AI 据此生成修改稿 */
export class AdjustModal extends Modal {
	plugin: AiWorkReviewPlugin;
	vaultPath: string;
	existingNote: string;
	kind: "req" | "bug" | "change" | "file";

	constructor(app: App, plugin: AiWorkReviewPlugin, vaultPath: string, existingNote: string, kind: "req" | "bug" | "change" | "file" = "file") {
		super(app);
		this.plugin = plugin;
		this.vaultPath = vaultPath;
		this.existingNote = existingNote;
		this.kind = kind;
	}

	onOpen(): void {
		this.titleEl.setText(t("adjust.title", { path: this.vaultPath }));
		const content = this.contentEl;
		content.addClass("nr-adjust-modal");
		content.createDiv({
			cls: "nr-adjust-hint",
			text: this.kind === "bug" ? t("dev.reqBugHint") : this.kind === "change" ? t("dev.reqChangeHint") : this.kind === "req" ? t("dev.reqAdjustHint") : t("adjust.hint"),
		});
		const ta = content.createEl("textarea", { cls: "nr-adjust-textarea" });
		ta.value = this.existingNote;
		ta.placeholder = this.kind === "bug" ? t("dev.reqBugPlaceholder") : this.kind === "change" ? t("dev.reqChangePlaceholder") : this.kind === "req" ? t("dev.reqAdjustPlaceholder") : t("adjust.placeholder");
		const btnRow = content.createDiv({ cls: "nr-fix-buttons" });
		const ok = btnRow.createEl("button", { cls: "mod-cta", text: t("adjust.submit") });
		ok.addEventListener("click", () => {
			const note = ta.value.trim();
			if (!note) {
				new Notice(t("notice.adjustEmpty"));
				return;
			}
			this.close();
			void this.plugin.applyUserAdjustment(this.vaultPath, note, this.kind);
		});
		const cancel = btnRow.createEl("button", { text: t("adjust.cancel") });
		cancel.addEventListener("click", () => this.close());
		ta.addEventListener("keydown", (e) => {
			if ((e as KeyboardEvent).key === "Enter" && ((e as KeyboardEvent).metaKey || (e as KeyboardEvent).ctrlKey)) {
				ok.click();
			}
		});
		setTimeout(() => ta.focus(), 50);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
