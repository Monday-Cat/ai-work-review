import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_DRAFT_REGEX, StatusCheck } from "./rules";
import { DEFAULT_DEV_DELIVER_FOLDER, DEFAULT_DEV_DOC_FOLDER, DEFAULT_DEV_REQ_FOLDER, PROJECT_DOCS_DEV_FOLDER, PROJECT_DOCS_REQ_FOLDER, shouldUseProjectDocsLayout } from "./dev";
import { t, Lang } from "./i18n";
import type AiWorkReviewPlugin from "./main";

export interface AiWorkReviewSettings {
	/** 界面语言 */
	language: Lang;
	/** 面板模式：小说=逐文件审核；开发=按任务评审需求与交付 */
	mode: "novel" | "dev";
	/** 开发模式：统一开发文档目录（代码项目固定 docs/开发文档/<模块>/） */
	devDocFolder: string;
	/** 开发模式：旧需求目录（小说库或未合并的档案） */
	devReqFolder: string;
	/** 开发模式：旧交付目录；代码项目可留空 */
	devDeliverFolder: string;
	/** 逗号分隔的文件夹列表（vault 根下的一级目录） */
	scanFolders: string;
	/** 逗号分隔的根目录文件列表 */
	scanRootFiles: string;
	/** 每行一条：文件夹=模板文件路径 */
	templateMapText: string;
	/** 逗号分隔的索引文件（做索引↔目录核对） */
	indexFiles: string;
	/** 复制 AI 指令时附带的上下文载入要求 */
	aiContextHint: string;
	/** 每行一条：文件夹|字段名|完成值1,完成值2 */
	statusChecksText: string;
	draftMarkerRegex: string;
	/** vault 根下的 AI 桥接目录 */
	bridgeFolder: string;
	autoIngest: boolean;
	archiveAfterIngest: boolean;
}

export const DEFAULT_SETTINGS: AiWorkReviewSettings = {
	language: "auto",
	mode: "novel",
	devDocFolder: DEFAULT_DEV_DOC_FOLDER,
	devReqFolder: DEFAULT_DEV_REQ_FOLDER,
	devDeliverFolder: DEFAULT_DEV_DELIVER_FOLDER,
	scanFolders: "人物库,事件库,技能库,章节库,大道库,世界观",
	scanRootFiles: "大纲.md,世界观.md",
	templateMapText: [
		"人物库=人物库/人物模板.md",
		"事件库=事件库/事件模板.md",
		"技能库=技能库/技能模板.md",
		"章节库=章节库/章节模板.md",
		"大道库=大道库/_模板.md",
	].join("\n"),
	indexFiles: "世界观.md",
	aiContextHint: "先载入 世界观/00-核心铁律.md 与 世界观.md，再按索引载入与文件内容相关的细节文件",
	statusChecksText: "章节库|当前状态|定稿",
	draftMarkerRegex: DEFAULT_DRAFT_REGEX,
	bridgeFolder: ".ai-review",
	autoIngest: true,
	archiveAfterIngest: true,
};

/** 代码项目 vault：需求/交付落到项目 docs/ 下，避免污染仓库根目录 */
export function codeProjectDevSettings(): Pick<
	AiWorkReviewSettings,
	| "mode"
	| "devDocFolder"
	| "devReqFolder"
	| "devDeliverFolder"
	| "scanFolders"
	| "scanRootFiles"
	| "templateMapText"
	| "indexFiles"
	| "aiContextHint"
	| "statusChecksText"
> {
	return {
		mode: "dev",
		devDocFolder: PROJECT_DOCS_DEV_FOLDER,
		devReqFolder: DEFAULT_DEV_REQ_FOLDER,
		devDeliverFolder: DEFAULT_DEV_DELIVER_FOLDER,
		scanFolders: `${PROJECT_DOCS_DEV_FOLDER},${DEFAULT_DEV_REQ_FOLDER},${DEFAULT_DEV_DELIVER_FOLDER}`,
		scanRootFiles: "",
		templateMapText: "",
		indexFiles: "",
		aiContextHint: "先读项目 AGENTS.md、.cursor/skills/dev-review/SKILL.md 与目标模块代码。模板在技能内，不要往仓库写模板文件。",
		statusChecksText: `${DEFAULT_DEV_DOC_FOLDER}|状态|已完成`,
	};
}

export function needsCodeProjectLayout(s: AiWorkReviewSettings, topEntries: string[]): boolean {
	if (!shouldUseProjectDocsLayout(topEntries)) return false;
	if (s.scanFolders.includes("人物库")) return true;
	if (s.devReqFolder === PROJECT_DOCS_REQ_FOLDER) return true;
	if (s.devReqFolder === DEFAULT_DEV_REQ_FOLDER && s.scanFolders.includes(DEFAULT_DEV_REQ_FOLDER) && !s.scanFolders.includes(DEFAULT_DEV_DOC_FOLDER)) {
		return true;
	}
	if (!s.scanFolders.includes(PROJECT_DOCS_DEV_FOLDER) && (s.devDocFolder === DEFAULT_DEV_DOC_FOLDER || !s.devDocFolder)) {
		return true;
	}
	return false;
}

export function parseList(text: string): string[] {
	return text
		.split(/[,，]/)
		.map((s) => s.trim())
		.filter(Boolean);
}

export function parseTemplateMap(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.split(/\r?\n/)) {
		const s = line.trim();
		if (!s || s.startsWith("#")) continue;
		const idx = s.indexOf("=");
		if (idx <= 0) continue;
		const folder = s.slice(0, idx).trim();
		const tpl = s.slice(idx + 1).trim();
		if (folder && tpl) out[folder] = tpl;
	}
	return out;
}

export function parseStatusChecks(text: string): StatusCheck[] {
	const out: StatusCheck[] = [];
	for (const line of text.split(/\r?\n/)) {
		const s = line.trim();
		if (!s || s.startsWith("#")) continue;
		const parts = s.split("|").map((x) => x.trim());
		if (parts.length < 2 || !parts[0] || !parts[1]) continue;
		out.push({
			folder: parts[0],
			field: parts[1],
			finals: parts[2] ? parseList(parts[2]) : [],
		});
	}
	return out;
}

export class AiWorkReviewSettingTab extends PluginSettingTab {
	plugin: AiWorkReviewPlugin;

	constructor(app: App, plugin: AiWorkReviewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;
		const save = () => this.plugin.saveAll();

		new Setting(containerEl).setName(t("settings.general.heading")).setHeading();
		new Setting(containerEl)
			.setName(t("settings.language.name"))
			.setDesc(t("settings.language.desc"))
			.addDropdown((d) =>
				d
					.addOptions({ auto: "Auto", zh: "中文", en: "English" })
					.setValue(s.language)
					.onChange(async (v) => {
						s.language = v as Lang;
						this.plugin.applyLang();
						await save();
						this.display();
					}),
			);
		new Setting(containerEl)
			.setName(t("settings.mode.name"))
			.setDesc(t("settings.mode.desc"))
			.addDropdown((d) =>
				d
					.addOptions({ novel: t("mode.novel"), dev: t("mode.dev") })
					.setValue(s.mode)
					.onChange(async (v) => {
						s.mode = v as "novel" | "dev";
						await save();
						this.plugin.refreshView();
					}),
			);
		new Setting(containerEl)
			.setName(t("settings.devDocFolder.name"))
			.setDesc(t("settings.devDocFolder.desc"))
			.addText((tx) =>
				tx.setValue(s.devDocFolder ?? DEFAULT_DEV_DOC_FOLDER).onChange(async (v) => {
					s.devDocFolder = v.trim() || DEFAULT_DEV_DOC_FOLDER;
					await save();
				}),
			);
		new Setting(containerEl)
			.setName(t("settings.devReqFolder.name"))
			.setDesc(t("settings.devReqFolder.desc"))
			.addText((tx) =>
				tx.setValue(s.devReqFolder).onChange(async (v) => {
					s.devReqFolder = v.trim() || DEFAULT_DEV_REQ_FOLDER;
					await save();
				}),
			);
		new Setting(containerEl)
			.setName(t("settings.devDeliverFolder.name"))
			.setDesc(t("settings.devDeliverFolder.desc"))
			.addText((tx) =>
				tx.setValue(s.devDeliverFolder).onChange(async (v) => {
					s.devDeliverFolder = v.trim();
					await save();
				}),
			);

		new Setting(containerEl).setName(t("settings.scope.heading")).setHeading();
		new Setting(containerEl)
			.setName(t("settings.scanFolders.name"))
			.setDesc(t("settings.scanFolders.desc"))
			.addText((tx) =>
				tx.setValue(s.scanFolders).onChange(async (v) => {
					s.scanFolders = v;
					await save();
				}),
			);
		new Setting(containerEl)
			.setName(t("settings.scanRootFiles.name"))
			.setDesc(t("settings.scanRootFiles.desc"))
			.addText((tx) =>
				tx.setValue(s.scanRootFiles).onChange(async (v) => {
					s.scanRootFiles = v;
					await save();
				}),
			);

		new Setting(containerEl).setName(t("settings.templates.heading")).setHeading();
		new Setting(containerEl)
			.setName(t("settings.templateMap.name"))
			.setDesc(t("settings.templateMap.desc"))
			.addTextArea((tx) =>
				tx.setValue(s.templateMapText).onChange(async (v) => {
					s.templateMapText = v;
					await save();
				}),
			);
		new Setting(containerEl)
			.setName(t("settings.indexFiles.name"))
			.setDesc(t("settings.indexFiles.desc"))
			.addText((tx) =>
				tx.setValue(s.indexFiles).onChange(async (v) => {
					s.indexFiles = v;
					await save();
				}),
			);
		new Setting(containerEl)
			.setName(t("settings.aiContextHint.name"))
			.setDesc(t("settings.aiContextHint.desc"))
			.addTextArea((tx) =>
				tx.setValue(s.aiContextHint).onChange(async (v) => {
					s.aiContextHint = v;
					await save();
				}),
			);
		new Setting(containerEl)
			.setName(t("settings.statusChecks.name"))
			.setDesc(t("settings.statusChecks.desc"))
			.addTextArea((tx) =>
				tx.setValue(s.statusChecksText).onChange(async (v) => {
					s.statusChecksText = v;
					await save();
				}),
			);

		new Setting(containerEl).setName(t("settings.rules.heading")).setHeading();
		new Setting(containerEl)
			.setName(t("settings.draftRegex.name"))
			.setDesc(t("settings.draftRegex.desc"))
			.addText((tx) =>
				tx.setValue(s.draftMarkerRegex).onChange(async (v) => {
					s.draftMarkerRegex = v || DEFAULT_DRAFT_REGEX;
					await save();
				}),
			);

		new Setting(containerEl).setName(t("settings.bridge.heading")).setHeading();
		new Setting(containerEl)
			.setName(t("settings.bridgeFolder.name"))
			.setDesc(t("settings.bridgeFolder.desc"))
			.addText((tx) =>
				tx.setValue(s.bridgeFolder).onChange(async (v) => {
					s.bridgeFolder = v.trim() || ".ai-review";
					await save();
				}),
			);
		new Setting(containerEl)
			.setName(t("settings.autoIngest.name"))
			.setDesc(t("settings.autoIngest.desc"))
			.addToggle((tg) =>
				tg.setValue(s.autoIngest).onChange(async (v) => {
					s.autoIngest = v;
					await save();
				}),
			);
		new Setting(containerEl)
			.setName(t("settings.archive.name"))
			.setDesc(t("settings.archive.desc"))
			.addToggle((tg) =>
				tg.setValue(s.archiveAfterIngest).onChange(async (v) => {
					s.archiveAfterIngest = v;
					await save();
				}),
			);

		new Setting(containerEl).setName(t("settings.maint.heading")).setHeading();
		new Setting(containerEl)
			.setName(t("settings.clearData.name"))
			.setDesc(t("settings.clearData.desc"))
			.addButton((b) =>
				b.setButtonText(t("settings.clearData.button")).setDestructive().onClick(async () => {
					await this.plugin.clearStore();
					new Notice(t("notice.cleared"));
				}),
			);
	}
}
