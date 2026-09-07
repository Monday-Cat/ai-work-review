/**
 * 规则检查器 / 报告解析 / diff 的验证脚本（node 直接运行，不依赖 Obsidian）。
 * 用当前 vault 的真实文件跑一遍规则检查，并在末尾输出「模拟审核结果」。
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkFile, extractTemplateSpec, isInScope, isTemplateLike, matchingFolderPrefix, checkIndexFile, DEFAULT_DRAFT_REGEX } from "../.test/rules.mjs";
import { parseAiReport } from "../.test/ingest.mjs";
import { diffLines, diffStats } from "../.test/diff.mjs";
import { matchTasks, collectDevTasks, extractFieldValue, taskState, stripDatePrefix, shouldUseProjectDocsLayout, isNovelDefaultDevFolders, isUnderNamedFolder, targetFolderOf, setFieldValue, upsertSupplementSection, upsertBugSection, upsertChangeSection, isBugFixReqStatus, isApprovedReqStatus, nextApproveStatus, canRecordRequirementChange } from "../.test/dev.mjs";

const pluginDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vaultRoot = process.env.AI_REVIEW_VAULT && resolve(process.env.AI_REVIEW_VAULT) || resolve(pluginDir, "..", "小说"); // 默认开发 vault

let failed = 0;
function assert(cond, msg) {
	if (cond) {
		console.log(`  ✓ ${msg}`);
	} else {
		failed++;
		console.error(`  ✗ ${msg}`);
	}
}

function walkMd(dir, out = []) {
	for (const name of readdirSync(dir)) {
		if (name.startsWith(".")) continue;
		const p = join(dir, name);
		const st = statSync(p);
		if (st.isDirectory()) walkMd(p, out);
		else if (name.endsWith(".md")) out.push(p);
	}
	return out;
}

const allMd = walkMd(vaultRoot);
const allPaths = allMd.map((p) => relative(vaultRoot, p).split("\\").join("/"));

const TEMPLATE_MAP = {
	人物库: "人物库/人物模板.md",
	事件库: "事件库/事件模板.md",
	技能库: "技能库/技能模板.md",
	章节库: "章节库/章节模板.md",
	大道库: "大道库/_模板.md",
};
const templates = {};
for (const tplPath of Object.values(TEMPLATE_MAP)) {
	templates[tplPath] = extractTemplateSpec(readFileSync(join(vaultRoot, tplPath), "utf8"));
}
const ctx = { templateMap: TEMPLATE_MAP, templates, draftMarkerRegex: DEFAULT_DRAFT_REGEX };

console.log("\n== 1. 模板解析 ==");
const tpl = templates["人物库/人物模板.md"];
assert(tpl.sections.length >= 8, `人物模板解析出 ${tpl.sections.length} 个章节（≥8）`);
assert(tpl.fields.some((f) => f.name === "姓名"), "人物模板含字段「姓名」");
const daoTpl = templates["大道库/_模板.md"];
assert(daoTpl.fields.some((f) => f.name === "道谱编号"), "大道模板识别引用块字段「道谱编号」");

console.log("\n== 2. 模板检查（合成样例）==");
{
	const badContent = [
		"# 测试人物",
		"## 核心身份",
		"- **姓名**：",
		"- **角色定位**：主角 / 女主 / 反派 / 导师 / 挚友 / 路人NPC",
	].join("\n");
	const res = checkFile("人物库/测试人物.md", badContent, allPaths, ctx);
	const kinds = res.issues.map((i) => i.problem);
	assert(kinds.some((k) => k.includes("缺少模板章节「外在设定」")), "检出缺失章节「外在设定」");
	assert(kinds.some((k) => k.includes("字段「姓名」疑似未填写")), "检出空字段「姓名」");
	assert(kinds.some((k) => k.includes("字段「角色定位」疑似未填写")), "检出与模板占位相同的字段「角色定位」");
	assert(res.status === "warn", `合成样例状态为 warn（实际 ${res.status}）`);
}

console.log("\n== 3. 草案标记扫描 ==");
{
	const maleLead = readFileSync(join(vaultRoot, "人物库/男主.md"), "utf8");
	const res = checkFile("人物库/男主.md", maleLead, allPaths, ctx);
	const draft = res.issues.find((i) => i.dimension === "draft");
	assert(!!draft && draft.locations.length >= 5, `男主.md 检出 ${draft?.locations.length ?? 0} 处草案/待定标记（≥5）`);
	const clean = checkFile("人物库/x.md", "# 干净文件\n- **姓名**：张三\n", allPaths, ctx);
	assert(!clean.issues.some((i) => i.dimension === "draft"), "干净文件无草案标记误报");
}

console.log("\n== 4. 索引一致性 ==");
{
	// 合成样例：确定性验证「缺收录」「死链」两个方向
	const syntheticPaths = ["世界观.md", "世界观/00-核心.md", "世界观/01-力量.md", "世界观/02-轮回.md"];
	const syntheticIdx = "| `世界观/00-核心.md` | x | y |\n| `世界观/01-力量.md` | x | y |\n| `世界观/09-幽灵.md` | x | y |\n";
	const synIssues = checkIndexFile("世界观.md", syntheticIdx, syntheticPaths);
	assert(synIssues.some((i) => i.severity === "error" && i.problem.includes("09-幽灵")), "合成：索引死链检出 error");
	assert(synIssues.some((i) => i.problem.includes("02-轮回")), "合成：缺收录文件被检出");

	// 真实索引：自洽性（检出的缺收录文件必须确实不在索引文本里），且无死链
	const idx = readFileSync(join(vaultRoot, "世界观.md"), "utf8");
	const issues = checkIndexFile("世界观.md", idx, allPaths);
	const selfConsistent = issues
		.filter((i) => i.dimension === "index" && i.severity === "warn")
		.every((i) => {
			const f = i.problem.split("：").pop();
			return f && !idx.includes(f);
		});
	assert(selfConsistent, "真实索引：检出的缺收录项确实不在索引文本中（自洽）");
	const ghost = issues.filter((i) => i.severity === "error");
	assert(ghost.length === 0, `索引无指向不存在文件的死链（${ghost.length} 条 error）`);
}

console.log("\n== 5. 引用完整性（全库扫描）==");
{
	let broken = 0;
	for (const p of allPaths) {
		if (!isInScope(p, ["人物库", "事件库", "技能库", "章节库", "大道库", "世界观"], ["大纲.md", "世界观.md"])) continue;
		const content = readFileSync(join(vaultRoot, p), "utf8");
		const res = checkFile(p, content, allPaths, ctx);
		for (const i of res.issues) {
			if (i.dimension === "reference") {
				broken++;
				console.log(`    · ${p} → ${i.problem}（L${i.line}）`);
			}
		}
	}
	console.log(`  共检出 ${broken} 条可疑引用（见上，如为误报可忽略或调整规则）`);
}

console.log("\n== 6. AI 报告解析 ==");
{
	const ok = parseAiReport(
		JSON.stringify({
			schema: "novel-review/report@1",
			file: "人物库/男主.md",
			verdict: "warn",
			summary: "总体一致",
			issues: [{ severity: "error", problem: "与铁律冲突", line: 12 }],
		}),
	);
	assert(!!ok.report && ok.report.issues[0].severity === "error", "合法报告解析成功");
	assert(!!parseAiReport(JSON.stringify({ verdict: "warn" })).error, "缺少 file 字段被拒绝");
	assert(!!parseAiReport(JSON.stringify({ file: "a.md", verdict: "bad" })).error, "非法 verdict 被拒绝");
	assert(!!parseAiReport("{oops").error, "坏 JSON 被拒绝");
}

console.log("\n== 7. diff ==");
{
	const rows = diffLines(["a", "b", "c"], ["a", "B", "c", "d"]);
	const st = diffStats(rows);
	assert(st.added === 2 && st.removed === 1, `diff 统计 +2/-1（实际 +${st.added}/-${st.removed}）`);
	assert(rows[0].type === "same" && rows[1].type === "del" && rows[2].type === "add", "diff 行类型正确");
}

console.log("\n== 8. 开发模式：任务配对 ==");
{
	assert(stripDatePrefix("2026-09-07-登录接口") === "登录接口", "日期前缀剥离正确");
	const reqs = [
		{ path: "开发需求/2026-09-07-登录接口.md", content: "- **状态**：已交付\n- **来源**：对话\n" },
		{ path: "开发需求/2026-09-08-导出功能.md", content: "- **状态**：待开发\n" },
	];
	const dels = [
		{ path: "开发交付/2026-09-07-登录接口.md", content: "- **状态**：待审核\n- **交付日期**：2026-09-07\n" },
	];
	const tasks = matchTasks(reqs, dels);
	assert(tasks.length === 2, `任务数 ${tasks.length}（需求 2 + 交付 1 合并为 2 个任务）`);
	const t1 = tasks.find((x) => x.slug === "登录接口");
	assert(!!t1 && t1.reqPath && t1.deliverPath, "登录接口：需求与交付正确配对");
	assert(t1?.deliverStatus === "待审核" && t1?.deliverDate === "2026-09-07", "交付单字段解析正确");
	const s1 = taskState(t1);
	assert(s1.kind === "wait" && s1.label === "待审核", `登录接口任务状态=wait/待审核（实际 ${s1.kind}/${s1.label}）`);
	const t2 = tasks.find((x) => x.slug === "导出功能");
	const s2 = taskState(t2);
	assert(s2.kind === "wait" && s2.label === "待开发", `未交付任务回落到需求状态（实际 ${s2.kind}/${s2.label}）`);
	assert(extractFieldValue("- **交付日期**：2026-09-07\n", "交付日期") === "2026-09-07", "字段值提取正确");
	const nested = matchTasks(
		[{ path: "lib/features/finance/开发需求/2026-09-07-充值.md", content: "- **状态**：待审核\n" }],
		[],
	);
	assert(nested.length === 1 && nested[0].slug === "充值" && nested[0].reqPath?.includes("finance/开发需求"), "功能目录下的需求也能配对");
	assert(taskState({ slug: "a", reqStatus: "调整" }).kind === "wait", "需求调整=wait");
	assert(taskState({ slug: "a", reqStatus: "已通过" }).kind === "ready", "需求已通过=ready 待开工");
	assert(isUnderNamedFolder("lib/features/finance/开发需求/a.md", "docs/开发需求") === true, "按目录名识别嵌套需求");
	assert(targetFolderOf("lib/features/finance/开发需求/a.md", "开发需求") === "lib/features/finance", "目标目录=功能文件夹");
	assert(setFieldValue("- **状态**：待审核\n", "状态", "已通过").includes("已通过"), "状态字段可写回");
	assert(upsertSupplementSection("# t\n", "加倒计时", "2026-09-07").includes("## 补充需求"), "调整意见写入补充需求节");
	assert(upsertBugSection("# t\n", "倒计时未返回", "2026-09-07").includes("## 缺陷记录"), "完成后的缺陷写入原文档缺陷记录");
	assert(isBugFixReqStatus("已完成") && isBugFixReqStatus("整改中"), "已完成/整改中视为缺陷整改");
	assert(!isBugFixReqStatus("待审核") && !isBugFixReqStatus("已通过"), "需求阶段不是缺陷整改");
	assert(shouldUseProjectDocsLayout(["pubspec.yaml", "lib", "docs"]) === true, "Flutter 仓库使用项目开发目录");
	assert(shouldUseProjectDocsLayout(["人物库", "章节库", "package.json"]) === false, "小说库即使有 package.json 也不改路径");
	assert(isNovelDefaultDevFolders("开发需求", "开发交付") === true, "识别小说库默认目录名");
	assert(isNovelDefaultDevFolders("docs/开发需求", "docs/开发交付") === false, "项目 docs 目录不算小说默认");
}

console.log("\n== 8b. 嵌套目录审核范围 ==");
{
	assert(matchingFolderPrefix("lib/features/finance/开发需求/a.md", ["docs/开发需求", "docs/开发交付"]) === "docs/开发需求", "按目录名匹配功能下的开发需求");
	assert(isInScope("lib/features/finance/开发需求/2026-09-07-充值.md", ["开发需求", "开发交付"], []) === true, "嵌套需求文件属于审核范围");
	assert(isInScope("docs/开发需求/需求模板.md", ["docs/开发需求"], []) === false, "模板文件仍跳过");
	assert(isInScope("lib/main.dart.md", ["docs/开发需求"], []) === false, "代码目录不在审核范围");
	assert(isTemplateLike("docs/开发文档/finance/_模块.md") === true, "模块卡不算审核对象");
	assert(isInScope("docs/开发文档/finance/_模块.md", ["开发文档"], []) === false, "模块卡不在审核范围");
	assert(isInScope("docs/开发文档/finance/2026-09-07-充值.md", ["开发文档", "开发需求"], []) === true, "统一开发文档属于审核范围");
	assert(matchingFolderPrefix("docs/开发文档/finance/a.md", ["开发文档"]) === "开发文档", "按目录名匹配开发文档");
	assert(targetFolderOf("docs/开发文档/finance/a.md", "开发文档") === "docs/开发文档/finance", "docs 下按模块分子文件夹");
	assert(isInScope("docs/开发文档/finance/2026-09-07-充值.md", ["docs/开发文档"], []) === true, "docs/开发文档 前缀也在范围内");
}

console.log("\n== 8c. 统一开发文档 ==");
{
	const docs = [
		{
			path: "docs/开发文档/finance/2026-09-07-充值.md",
			content: "- **状态**：待审核\n- **目标目录**：lib/features/finance\n",
		},
		{
			path: "docs/开发文档/finance/_模块.md",
			content: "# 模块：finance\n",
		},
	];
	const legacy = collectDevTasks(
		docs,
		[{ path: "lib/features/auth/开发需求/2026-09-01-登录.md", content: "- **状态**：已通过\n" }],
		[{ path: "lib/features/auth/开发交付/2026-09-01-登录.md", content: "- **状态**：已交付\n- **交付日期**：2026-09-01\n" }],
		"开发文档",
	);
	assert(legacy.length === 2, `统一+旧档任务数 ${legacy.length}`);
	const pay = legacy.find((x) => x.slug === "充值");
	assert(!!pay && pay.unified === true && pay.reqPath?.includes("docs/开发文档/finance"), "充值走统一开发文档");
	assert(pay?.targetFolder === "docs/开发文档/finance", "面板按 docs 模块文件夹分组");
	assert(pay?.codeTarget === "lib/features/finance", "目标目录仍指向代码");
	assert(taskState(pay).kind === "wait" && taskState(pay).label === "待审核", "统一文档待审核=wait");
	assert(taskState({ slug: "a", reqStatus: "已交付" }).kind === "wait", "统一文档已交付=wait 等审交付");
	assert(taskState({ slug: "a", reqStatus: "已完成" }).kind === "final", "统一文档已完成=final");
	assert(taskState({ slug: "a", reqStatus: "完结" }).kind === "final", "统一文档完结=final");
	assert(taskState({ slug: "a", reqStatus: "开发中" }).kind === "active", "统一文档开发中=active");
	assert(taskState({ slug: "a", reqStatus: "变更中" }).kind === "wait", "需求变更中=wait");
	assert(taskState({ slug: "a", reqStatus: "整改中" }).kind === "active", "添加BUG 整改中=active 不走终态");
	assert(nextApproveStatus("待审核") === "已通过", "待审核点通过=已通过");
	assert(nextApproveStatus("开发中") === "完结", "开发中点完结=完结");
	assert(nextApproveStatus("已交付") === "完结", "已交付点完结=完结");
	assert(nextApproveStatus("变更中") === "完结", "变更中点完结=完结");
	assert(nextApproveStatus("已通过") === "已通过", "已通过再点通过仍是已通过");
	assert(isApprovedReqStatus("已通过") && !isApprovedReqStatus("完结") && !isApprovedReqStatus("开发中"), "开工只认已通过");
	assert(!canRecordRequirementChange("待审核") && !canRecordRequirementChange("调整"), "需求阶段不用需求变更");
	assert(canRecordRequirementChange("已通过") && canRecordRequirementChange("开发中") && canRecordRequirementChange("完结"), "开工后可用需求变更");
	assert(upsertChangeSection("# t\n", "快捷档位只要三档", "2026-09-07").includes("## 需求变更"), "需求变更写入原文档");
	assert(!legacy.some((x) => x.slug === "_模块" || x.slug === "模块"), "模块卡不进入任务列表");
	const login = legacy.find((x) => x.slug === "登录");
	assert(!!login && !login.unified && login.deliverPath?.includes("开发交付"), "未合并的旧需求/交付仍配对");
}

console.log("\n== 9. 模拟审核结果（真实 vault 全量规则检查）==");
const scanFolders = ["人物库", "事件库", "技能库", "章节库", "大道库", "世界观"];
const scanRoot = ["大纲.md", "世界观.md"];
const counts = { pass: 0, warn: 0, fail: 0 };
const perFile = [];
for (const p of allPaths) {
	if (!isInScope(p, scanFolders, scanRoot)) continue;
	const content = readFileSync(join(vaultRoot, p), "utf8");
	const res = checkFile(p, content, allPaths, ctx, p === "世界观.md");
	counts[res.status] = (counts[res.status] ?? 0) + 1;
	perFile.push(res);
}
perFile.sort((a, b) => ({ fail: 0, warn: 1, pass: 2 })[a.status] - ({ fail: 0, warn: 1, pass: 2 })[b.status] || a.path.localeCompare(b.path, "zh-Hans-CN"));
for (const r of perFile) {
	const icon = r.status === "pass" ? "✅" : r.status === "warn" ? "⚠️" : "❌";
	console.log(`  ${icon} ${r.path}（${r.issues.length} 个问题）`);
}
console.log(`\n  汇总：通过 ${counts.pass} / 需整改 ${counts.warn} / 未通过 ${counts.fail ?? 0}`);
assert(perFile.length > 30, `共审核 ${perFile.length} 个文件（>30）`);

console.log(failed === 0 ? "\n全部断言通过 ✅" : `\n${failed} 条断言失败 ❌`);
process.exit(failed === 0 ? 0 : 1);
