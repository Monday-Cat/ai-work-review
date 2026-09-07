#!/usr/bin/env node
/**
 * 把构建产物安装到指定 vault：
 *   node scripts/install-to-vault.mjs <vault 目录> [更多 vault...]
 * 不带参数时默认安装到 ../小说（本仓库的开发 vault）。
 */
import { cpSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targets = process.argv.slice(2);
if (targets.length === 0) targets.push(path.join(repoRoot, "..", "小说"));

for (const vault of targets) {
	const dest = path.join(path.resolve(vault), ".obsidian", "plugins", "ai-work-review");
	mkdirSync(dest, { recursive: true });
	for (const f of ["main.js", "manifest.json", "styles.css"]) {
		cpSync(path.join(repoRoot, f), path.join(dest, f));
	}
	console.log(`✓ 已安装到 ${dest}`);
}
