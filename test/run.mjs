/**
 * 规则检查器 / 报告解析 / diff 的验证脚本（node 直接运行，不依赖 Obsidian）。
 * 用当前 vault 的真实文件跑一遍规则检查，并在末尾输出「模拟审核结果」。
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { checkFile, extractTemplateSpec, isInScope, isTemplateLike, matchingFolderPrefix, checkIndexFile, DEFAULT_DRAFT_REGEX } from "../.test/rules.mjs";
import { parseAiReport } from "../.test/ingest.mjs";
import { diffLines, diffStats } from "../.test/diff.mjs";
import { matchTasks, collectDevTasks, extractFieldValue, taskState, stripDatePrefix, shouldUseProjectDocsLayout, isNovelDefaultDevFolders, isUnderNamedFolder, targetFolderOf, setFieldValue, upsertSupplementSection, upsertBugSection, upsertChangeSection, hasPendingChange, countBugEntries, removeLatestSectionEntry, nowStamp, todayStamp, isBugFixReqStatus, isApprovedReqStatus, nextApproveStatus, canRecordRequirementChange, canRecordBug, devAuthorActions } from "../.test/dev.mjs";
import { vaultRootOrExit } from "./vault-root.mjs";

const vaultRoot = vaultRootOrExit(); // 开发 vault：环境变量 AI_REVIEW_VAULT 或 vaults.local.json 首项

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
	// 字段留空是交付前的常态：正则必须行内匹配，否则跨行吞掉下一行（曾导致面板把待审核文档误判为已交付）
	const emptyTpl = "## 基本信息\n- **状态**：待审核\n- **模块**：\n- **目标目录**：lib/features/finance\n- **提出日期**：\n- **交付日期**：\n\n## 需求描述\nX\n";
	assert(extractFieldValue(emptyTpl, "交付日期") === "", "留空字段返回空串，不吞下一行");
	assert(extractFieldValue(emptyTpl, "提出日期") === "", "留空字段不吞后面的同节字段");
	assert(extractFieldValue(emptyTpl, "模块") === "" && extractFieldValue(emptyTpl, "目标目录") === "lib/features/finance", "留空字段后紧邻字段仍可正确取值");
	assert(extractFieldValue("- **交付日期**：\r\n\r\n## 需求描述", "交付日期") === "", "CRLF 留空字段同样不跨行");
	assert(extractFieldValue("- **状态**: 待审核\n", "状态") === "待审核", "半角冒号仍可取值");
	assert(extractFieldValue("  - **状态**：开发中\n", "状态") === "开发中", "缩进子项仍可取值");
	assert(extractFieldValue("- **说明**：改 *三处* 文案\n", "说明") === "改 三处 文案", "值内的强调标记仍被剥离");
	assert(extractFieldValue("- **交付**：x\n- **交付日期**：2026-09-07\n", "交付日期") === "2026-09-07", "字段名互为前缀时不误匹配");
	assert(extractFieldValue("- **状态**：待审核\n\n## 缺陷记录\n- **状态**：整改中\n", "状态") === "待审核", "同名字段取首个");
	const wroteEmpty = setFieldValue(emptyTpl, "模块", "finance");
	assert(wroteEmpty.includes("- **模块**：finance"), "留空字段可写回新值");
	assert(wroteEmpty.includes("- **目标目录**：lib/features/finance"), "写回留空字段不吞下一行");
	const wroteTail = setFieldValue(emptyTpl, "交付日期", "2026-09-10");
	assert(wroteTail.includes("- **交付日期**：2026-09-10") && wroteTail.includes("## 需求描述"), "写回末位留空字段不吞空行与章节标题");
	assert(setFieldValue(emptyTpl, "状态", "已通过").includes("- **状态**：已通过"), "已有值字段写回不变");
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

console.log("\n== 8d. 缺陷统计（防复发回归清单） ==");
{
	assert(JSON.stringify(countBugEntries("# t\n")) === '{"total":0,"pending":0}', "没有缺陷记录节=0/0");
	assert(JSON.stringify(countBugEntries("# t\n\n## 缺陷记录\n")) === '{"total":0,"pending":0}', "空的缺陷记录节=0/0");
	const fresh = upsertBugSection("# t\n", "倒计时未返回", "2026-09-07");
	assert(JSON.stringify(countBugEntries(fresh)) === '{"total":1,"pending":1}', "刚记的缺陷（整改未填）=1 条未整改");
	const fixed = fresh.replace("- **整改**：", "- **整改**：回到金额页\n- **根因**：倒计时回调里没做导航");
	assert(JSON.stringify(countBugEntries(fixed)) === '{"total":1,"pending":0}', "整改填了内容=已修复");
	const two = upsertBugSection(fixed, "金额显示旧值", "2026-09-08");
	assert(JSON.stringify(countBugEntries(two)) === '{"total":2,"pending":1}', "追加第二条后=2 条、1 未整改");
	const endScoped = "# t\n\n## 缺陷记录\n\n### 2026-09-07\n- a\n- **整改**：x\n\n## 审核意见\n- 无\n";
	assert(JSON.stringify(countBugEntries(endScoped)) === '{"total":1,"pending":0}', "统计不越过下一节");
	const tasks = collectDevTasks(
		[{ path: "docs/开发文档/finance/2026-09-07-充值.md", content: "- **状态**：整改中\n" + two }],
		[],
		[],
		"开发文档",
	);
	assert(tasks[0].bugTotal === 2 && tasks[0].bugPending === 1, "统一文档任务带缺陷统计（2 条/1 未整改）");
	// 「整改」「落实」留空但条目下方还有文字时，曾因 \s 跨行被误判为已完成（→ 面板漏掉缺陷、变更被当成已落地）
	const trailingNote = "# t\n\n## 缺陷记录\n\n### 2026-09-07 15:00\n- 文案漏了一处\n- **整改**：\n- 备注：作者补了说明但还没修\n";
	assert(JSON.stringify(countBugEntries(trailingNote)) === '{"total":1,"pending":1}', "整改留空且下方有文字=仍未整改");
	const trailingFixed = trailingNote.replace("- **整改**：", "- **整改**：回到金额页");
	assert(JSON.stringify(countBugEntries(trailingFixed)) === '{"total":1,"pending":0}', "整改填了内容=已修复（下方有文字不受影响）");
	const pendingNote = "# t\n\n## 需求变更\n\n### 2026-09-07 15:00\n- 改文案\n- **落实**：\n- 备注：还没落地\n";
	assert(hasPendingChange(pendingNote) === true, "落实留空且下方有文字=变更未落地");
	assert(hasPendingChange(pendingNote.replace("- **落实**：", "- **落实**：改完了")) === false, "落实填了内容=变更已落地");
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
	assert(taskState({ slug: "a", reqStatus: "调整中" }).kind === "wait", "调整中=wait 等改文档");
	assert(taskState({ slug: "a", reqStatus: "整改中" }).kind === "active", "添加BUG 整改中=active 不走终态");
	assert(nextApproveStatus("待审核") === "已通过", "待审核点通过=已通过");
	assert(nextApproveStatus("开发中") === "完结", "开发中点完结=完结");
	assert(nextApproveStatus("已交付") === "完结", "已交付点完结=完结");
	assert(nextApproveStatus("变更中") === "完结", "变更中点完结=完结");
assert(nextApproveStatus("调整中", true) === "变更中", "对过代码的调整中点定稿=变更中（hasPendingChange 也算代码期）");
assert(nextApproveStatus("已通过") === "已通过", "已通过再点通过仍是已通过");
assert(nextApproveStatus("调整", true) === "变更中", "交付后状态被改成调整：定稿进入变更中，不直接完结");
	assert(isApprovedReqStatus("已通过") && !isApprovedReqStatus("完结") && !isApprovedReqStatus("开发中"), "开工只认已通过");
	assert(!canRecordRequirementChange("待审核") && !canRecordRequirementChange("调整") && !canRecordRequirementChange("已通过"), "需求阶段（含已通过）不用需求变更，改需求走调整");
	assert(canRecordRequirementChange("开发中") && canRecordRequirementChange("已交付") && canRecordRequirementChange("完结") && canRecordRequirementChange("变更中"), "对过代码以后才可需求变更（代码落地）");
	{
	const pending = devAuthorActions("待审核");
	assert(pending.approve === "pass" && pending.adjust && !pending.bug && !pending.change, "待审核：通过+调整，无缺陷无变更");
	const settling = devAuthorActions("调整中", true);
	assert(settling.approve === "settle" && settling.bug && settling.change && !settling.adjust, "对过代码的调整中：定稿+缺陷+需求变更，不能直接完结");
	const reqAdjusting = devAuthorActions("调整中");
	assert(reqAdjusting.approve === "pass" && reqAdjusting.adjust && !reqAdjusting.bug && !reqAdjusting.change, "需求阶段调整中：通过+调整");
	const approved = devAuthorActions("已通过");
		assert(approved.approve === "pass" && approved.adjust && !approved.bug && !approved.change, "已通过：通过+调整（改需求走调整重新生成文档）");
		const delivered = devAuthorActions("已交付");
		assert(delivered.approve === "done" && delivered.bug && delivered.change && !delivered.adjust, "已交付：完结+缺陷+需求变更（调整只在需求阶段）");
		const closed = devAuthorActions("完结");
		assert(closed.approve === "done" && closed.bug && closed.change && !closed.adjust, "完结后仍可写缺陷和需求变更（落地）");
		const developing = devAuthorActions("开发中");
		assert(developing.approve === "done" && developing.bug && developing.change && !developing.adjust, "开发中可写缺陷和需求变更");
		assert(canRecordBug("已交付") && canRecordBug("完结") && !canRecordBug("待审核") && !canRecordBug("已通过"), "缺陷按钮只在开工之后");
		assert(canRecordBug("调整", true) && !canRecordBug("调整"), "交付后即使状态变成调整仍可写缺陷");
	}
	assert(upsertChangeSection("# t\n", "快捷档位只要三档", "2026-09-07").includes("## 需求变更"), "需求变更写入原文档");
	{
		const fresh = upsertChangeSection("# t\n", "快捷档位只要三档", "2026-09-07");
		assert(hasPendingChange(fresh), "刚记的变更（落实未填）= 未落地");
		const landed = fresh.replace("- **落实**：", "- **落实**：已改金额页，只留三档");
		assert(!hasPendingChange(landed), "落实填了内容 = 已落地");
		assert(!hasPendingChange("# t\n\n## 需求变更\n\n## 缺陷记录\n"), "空的需求变更节不算未落地");
		assert(!hasPendingChange("# t\n"), "没有需求变更节不算未落地");
		const twoPending = upsertChangeSection(fresh, "再加一档 2000", "2026-09-08 09:30");
		assert(hasPendingChange(twoPending), "追加第二条变更（未落实）仍是调整中");
	}
	{
		assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(nowStamp(new Date(2026, 8, 8, 9, 5))), "条目时间戳精确到分钟");
		assert(nowStamp(new Date(2026, 8, 8, 9, 5)) === "2026-09-08 09:05", "分钟补零");
		// upsert 插在节标题后第一条 → 节内顺序：最新在前
		const base = "# 开发文档\n\n## 需求变更\n\n### 2026-09-08 09:30\n- 新变更\n- **落实**：\n\n### 2026-09-07 10:00\n- 旧变更\n- **落实**：\n\n## 缺陷记录\n";
		const r1 = removeLatestSectionEntry(base, "## 需求变更");
		assert(r1.removed.includes("2026-09-08 09:30") && r1.removed.includes("新变更"), "撤回删除的是最新一条（节标题后第一条）");
		assert(r1.content.includes("2026-09-07 10:00") && !r1.content.includes("新变更"), "旧条目保留、新条目移除");
		assert(r1.content.includes("## 缺陷记录"), "后续节不受影响");
		const r2 = removeLatestSectionEntry(r1.content, "## 需求变更");
		assert(r2.removed.includes("2026-09-07 10:00"), "连续撤回能删到更早一条");
		const r3 = removeLatestSectionEntry(r2.content, "## 需求变更");
		assert(!r3.removed, "节里没条目时不改动");
		const supp = "# t\n\n## 补充需求\n- （2026-09-08 10:00）新要求\n- （2026-09-07 09:00）旧要求\n";
		const r4 = removeLatestSectionEntry(supp, "## 补充需求");
		assert(r4.removed.includes("2026-09-08 10:00") && r4.content.includes("旧要求"), "补充需求撤回删最新一条");
	}
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
