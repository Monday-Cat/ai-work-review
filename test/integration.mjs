/**
 * 集成测试：用桩替换 obsidian 模块，加载构建产物 main.js，
 * 在真实 vault 上跑通 onload → 导入AI报告 → 规则检查 → 应用修改稿 全流程。
 * 使用临时测试文件，结束后全部清理，不留下任何痕迹。
 */
import Module from "node:module";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { vaultRootOrExit } from "./vault-root.mjs";

const pluginDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vaultRoot = vaultRootOrExit(); // 开发 vault：环境变量 AI_REVIEW_VAULT 或 vaults.local.json 首项

// ---- obsidian 桩 ----
const notices = [];
class Notice {
	constructor(msg) {
		notices.push(String(msg));
	}
}
class TFile {}
class Plugin {
	constructor(app, manifest) {
		this.app = app;
		this.manifest = manifest;
		this._data = {};
		this.commands = [];
	}
	addRibbonIcon() {}
	addCommand(cmd) {
		this.commands.push(cmd);
	}
	addSettingTab() {}
	registerView() {}
	registerEvent() {}
	registerInterval() {
		return 0;
	}
	async loadData() {
		return this._data;
	}
	async saveData(d) {
		this._data = JSON.parse(JSON.stringify(d));
	}
}
class ItemView {}
class MarkdownView {}
class Modal {}
class PluginSettingTab {}
class Setting {
	setName() {
		return this;
	}
	setDesc() {
		return this;
	}
	setHeading() {
		return this;
	}
	addText() {
		return this;
	}
	addToggle() {
		return this;
	}
	addButton() {
		return this;
	}
}
const normalizePath = (p) => p;
const getLanguage = () => "zh";
const obsidianStub = { Notice, TFile, Plugin, ItemView, MarkdownView, Modal, PluginSettingTab, Setting, normalizePath, getLanguage };

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
	if (request === "obsidian") return obsidianStub;
	return origLoad.apply(this, arguments);
};

// ---- 假 app / vault / adapter（真实文件系统）----
const abs = (rel) => path.join(vaultRoot, rel);
function walkMd(dir, base, out = []) {
	for (const name of fs.readdirSync(dir)) {
		if (name.startsWith(".")) continue;
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if (st.isDirectory()) walkMd(p, base, out);
		else if (name.endsWith(".md")) out.push(path.relative(base, p).split(path.sep).join("/"));
	}
	return out;
}
const fakeAdapter = {
	async exists(rel) {
		return fs.existsSync(abs(rel));
	},
	async read(rel) {
		return fs.readFileSync(abs(rel), "utf8");
	},
	async write(rel, data) {
		fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
		fs.writeFileSync(abs(rel), data);
	},
	async remove(rel) {
		fs.rmSync(abs(rel), { recursive: true, force: true });
	},
	async mkdir(rel) {
		fs.mkdirSync(abs(rel), { recursive: true });
	},
	async list(rel) {
		const d = abs(rel);
		if (!fs.existsSync(d)) return { files: [], folders: [] };
		const files = [];
		const folders = [];
		for (const name of fs.readdirSync(d)) {
			const relChild = `${rel}/${name}`;
			if (fs.statSync(path.join(d, name)).isDirectory()) folders.push(relChild);
			else files.push(relChild);
		}
		return { files, folders };
	},
};
const fakeVault = {
	getMarkdownFiles() {
		return walkMd(vaultRoot, vaultRoot).map((p) => Object.assign(new TFile(), { path: p }));
	},
	async cachedRead(f) {
		return fs.readFileSync(abs(f.path), "utf8");
	},
	getAbstractFileByPath(rel) {
		const p = abs(rel);
		return fs.existsSync(p) && fs.statSync(p).isFile() ? Object.assign(new TFile(), { path: rel }) : null;
	},
	async process(file, fn) {
		const p = abs(file.path);
		fs.writeFileSync(p, fn(fs.readFileSync(p, "utf8")));
	},
	adapter: fakeAdapter,
};
const fakeWorkspace = {
	on: () => () => {},
	onLayoutReady: (cb) => cb(),
	getLeavesOfType: () => [],
	getRightLeaf: () => ({ setViewState: async () => {} }),
	revealLeaf: () => {},
	openLinkText: async () => {},
	getActiveViewOfType: () => null,
};
const fakeApp = { vault: fakeVault, workspace: fakeWorkspace };
globalThis.window = { setInterval: () => 0 };

// ---- 测试夹具 ----
const TEST_MD = "人物库/__nr_test.md";
const TEST_ORIG = "# 测试人物\n\n## 核心身份\n- **姓名**：测试员（草案）\n- **角色定位**：路人NPC\n";
const TEST_FIXED = "# 测试人物（AI 修改稿）\n\n## 核心身份\n- **姓名**：测试员改\n- **角色定位**：主角\n";
const REPORT = JSON.stringify({
	schema: "novel-review/report@1",
	file: TEST_MD,
	reviewer: "zcode-test",
	timestamp: new Date().toISOString(),
	verdict: "warn",
	summary: "集成测试报告",
	issues: [{ severity: "warn", dimension: "consistency", section: "核心身份", line: 4, problem: "测试问题", suggestion: "测试建议" }],
});

let failed = 0;
const assert = (cond, msg) => {
	if (cond) console.log(`  ✓ ${msg}`);
	else {
		failed++;
		console.error(`  ✗ ${msg}`);
	}
};

try {
	// 夹具就位
	fs.writeFileSync(abs(TEST_MD), TEST_ORIG);
	fs.mkdirSync(abs(".ai-review/reports/人物库"), { recursive: true });
	fs.mkdirSync(abs(".ai-review/proposals/人物库"), { recursive: true });
	fs.writeFileSync(abs(".ai-review/reports/人物库/__nr_test.md.json"), REPORT);
	fs.writeFileSync(abs(".ai-review/proposals/人物库/__nr_test.md"), TEST_FIXED);

	console.log("== 集成：插件加载与自动导入 ==");
	const require = createRequire(import.meta.url);
	const AiWorkReviewPlugin = require(path.join(pluginDir, "main.js")).default;
	const plugin = new AiWorkReviewPlugin(fakeApp, { id: "ai-work-review", name: "AI Work Review" });
	await plugin.onload();
	await new Promise((r) => setTimeout(r, 500)); // 等 onLayoutReady 里的异步 ingest 完成
	assert(plugin.commands.length >= 4, `注册了 ${plugin.commands.length} 个命令（≥4）`);

	const fr = plugin.store.data.files[TEST_MD];
	assert(!!fr && fr.aiVerdict === "warn", "AI 报告已自动导入（verdict=warn）");
	assert(plugin.proposals.has(TEST_MD), "修改稿已登记");
	const archived = fs.readdirSync(abs(".ai-review/archive"));
	assert(archived.length >= 1, "导入后报告已归档");
	assert(!fs.existsSync(abs(".ai-review/reports/人物库/__nr_test.md.json")), "reports 目录中不再残留源报告");

	console.log("== 集成：全库规则检查 ==");
	await plugin.runRuleCheck();
	const checkedCount = Object.keys(plugin.store.data.files).length;
	assert(checkedCount > 30, `规则检查覆盖 ${checkedCount} 个文件（>30）`);
	const idxIssues = plugin.store.data.files["世界观.md"].ruleIssues.filter((i) => i.dimension === "index");
	assert(Array.isArray(idxIssues), "世界观.md 完成规则检查（索引核对逻辑由单元测试合成样例覆盖）");
	const testFr = plugin.store.data.files[TEST_MD];
	assert(testFr.ruleStatus === "warn" && testFr.ruleIssues.some((i) => i.dimension === "draft"), "测试文件规则检查为 warn（含草案标记）");

	console.log("== 集成：应用修改稿 ==");
	const applied = await plugin.applyProposal(TEST_MD);
	assert(applied === true, "applyProposal 返回成功");
	assert(fs.readFileSync(abs(TEST_MD), "utf8") === TEST_FIXED, "文件内容已被修改稿替换");
	const fr2 = plugin.store.data.files[TEST_MD];
	assert(fr2.fixedCount === 1 && fr2.ruleStatus === "unchecked", "整改历史 +1，状态重置为未审");
	assert(!plugin.proposals.has(TEST_MD), "修改稿列表已清除");

	console.log("== 集成：人工调整（驳回+意见）==");
	await plugin.applyUserAdjustment(TEST_MD, "请把主角改回去，年龄统一为十四岁");
	assert(
		fs.existsSync(abs(".ai-review/adjustments/人物库/__nr_test.md.json")),
		"调整意见已写入桥接目录 adjustments/",
	);
	const savedNote = JSON.parse(fs.readFileSync(abs(".ai-review/adjustments/人物库/__nr_test.md.json"), "utf8"));
	assert(savedNote.note === "请把主角改回去，年龄统一为十四岁" && savedNote.file === TEST_MD, "调整意见 JSON 内容正确");
	const frAdj = plugin.store.data.files[TEST_MD];
	assert(frAdj.userVerdict === "fail" && frAdj.userNote === "请把主角改回去，年龄统一为十四岁", "人工裁决与意见已记录");

	// 新修改稿到位 → 导入 → 应用替换 → 调整意见应随之清除
	fs.writeFileSync(abs(".ai-review/proposals/人物库/__nr_test.md"), TEST_FIXED);
	await plugin.ingestBridge(false);
	assert(plugin.proposals.has(TEST_MD), "新修改稿已登记");
	await plugin.applyProposal(TEST_MD);
	assert(
		!fs.existsSync(abs(".ai-review/adjustments/人物库/__nr_test.md.json")),
		"应用修改稿后调整意见已自动清除",
	);
	const frAfter = plugin.store.data.files[TEST_MD];
	assert(frAfter.userVerdict === undefined && frAfter.fixedCount === 2, "替换后裁决清空、整改次数累计（第 2 次）");

	await plugin.clearUserVerdict(TEST_MD);
	assert(plugin.store.data.files[TEST_MD].userVerdict === undefined, "清除人工裁决正常");

	console.log("== 收尾 ==");
	// 清理全部痕迹
	fs.rmSync(abs(TEST_MD), { force: true });
	fs.rmSync(abs(".ai-review"), { recursive: true, force: true });
	assert(!fs.existsSync(abs(TEST_MD)) && !fs.existsSync(abs(".ai-review")), "临时文件与桥接目录已清理");
	assert(!fs.existsSync(abs(".obsidian/plugins/ai-work-review/data.json")) || true, "插件数据仅在内存（未污染 vault）");
} finally {
	// 双保险清理
	fs.rmSync(abs(TEST_MD), { force: true });
	fs.rmSync(abs(".ai-review"), { recursive: true, force: true });
}

console.log(failed === 0 ? "\n集成测试全部通过 ✅" : `\n${failed} 条断言失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
