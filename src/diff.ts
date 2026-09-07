/** 无依赖行级 LCS diff，小说文件规模（<2000 行）下性能足够。 */

export type DiffRowType = "same" | "add" | "del";

export interface DiffRow {
	type: DiffRowType;
	/** 原文行号（1-based，仅 same/del） */
	left?: number;
	/** 修改稿行号（1-based，仅 same/add） */
	right?: number;
	text: string;
}

export function diffLines(a: string[], b: string[]): DiffRow[] {
	const n = a.length;
	const m = b.length;
	// LCS 动态规划表（int32 一维数组压缩）
	const width = m + 1;
	const dp = new Int32Array((n + 1) * width);
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			dp[i * width + j] =
				a[i] === b[j] ? dp[(i + 1) * width + j + 1] + 1 : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
		}
	}
	const rows: DiffRow[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) {
			rows.push({ type: "same", left: i + 1, right: j + 1, text: a[i] });
			i++;
			j++;
		} else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
			rows.push({ type: "del", left: i + 1, text: a[i] });
			i++;
		} else {
			rows.push({ type: "add", right: j + 1, text: b[j] });
			j++;
		}
	}
	while (i < n) {
		rows.push({ type: "del", left: i + 1, text: a[i] });
		i++;
	}
	while (j < m) {
		rows.push({ type: "add", right: j + 1, text: b[j] });
		j++;
	}
	return rows;
}

export function diffStats(rows: DiffRow[]): { added: number; removed: number } {
	let added = 0;
	let removed = 0;
	for (const r of rows) {
		if (r.type === "add") added++;
		else if (r.type === "del") removed++;
	}
	return { added, removed };
}
