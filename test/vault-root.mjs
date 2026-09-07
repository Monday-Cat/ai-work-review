/**
 * 解析开发 vault（测试与脚本共用）。
 * 优先级：环境变量 AI_REVIEW_VAULT → 仓库根 vaults.local.json 首项 → null。
 * vaults.local.json 不入库（.gitignore），每台机器各自维护，格式如 ["/path/to/vault", ...]。
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function resolveVaultRoot() {
	if (process.env.AI_REVIEW_VAULT) return resolve(process.env.AI_REVIEW_VAULT);
	const cfg = join(repoRoot, "vaults.local.json");
	if (existsSync(cfg)) {
		const list = JSON.parse(readFileSync(cfg, "utf8"));
		if (Array.isArray(list) && list.length > 0) return resolve(String(list[0]));
	}
	return null;
}

export function vaultRootOrExit() {
	const root = resolveVaultRoot();
	if (!root) {
		console.error("未找到开发 vault：请设置环境变量 AI_REVIEW_VAULT，或在仓库根创建 vaults.local.json（如 [\"/path/to/vault\"]）。");
		process.exit(1);
	}
	return root;
}
