#!/usr/bin/env node
/**
 * 把构建产物安装到指定 vault：
 *   node scripts/install-to-vault.mjs <vault 目录> [更多 vault...]
 * 不带参数时安装到仓库根 vaults.local.json 里列出的全部 vault（该文件不入库，见 README）。
 */
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = process.argv.slice(2);

if (targets.length === 0) {
	const cfg = path.join(repoRoot, "vaults.local.json");
	if (existsSync(cfg)) {
		const list = JSON.parse(readFileSync(cfg, "utf8"));
		if (Array.isArray(list)) targets.push(...list.map(String));
	}
}

if (targets.length === 0) {
	console.log("未指定安装目标：运行 node scripts/install-to-vault.mjs <vault...>，或在仓库根创建 vaults.local.json（如 [\"/path/to/vault\"]）。本次不安装。");
	process.exit(0);
}

for (const vault of targets) {
	const dest = path.join(path.resolve(vault), ".obsidian", "plugins", "ai-work-review");
	mkdirSync(dest, { recursive: true });
	for (const f of ["main.js", "manifest.json", "styles.css"]) {
		cpSync(path.join(repoRoot, f), path.join(dest, f));
	}
	console.log(`✓ 已安装到 ${dest}`);
}
