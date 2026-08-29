// markdown テーブル解析。deep-spec-lib.ts からの逐語移動。

export interface MdTable {
  header: string[];
  rows: { cells: string[]; line: number }[];
  line: number;
}

export function parseMarkdownTables(md: string): MdTable[] {
  const tables: MdTable[] = [];
  const lines = md.split("\n");
  let i = 0;
  const splitRow = (row: string): string[] =>
    row
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split("|")
      .map((c) => c.trim());
  while (i < lines.length) {
    const isRow = (n: number): boolean => /^\s*\|.*\|\s*$/.test(lines[n] ?? "");
    if (isRow(i) && isRow(i + 1) && /^[\s|:-]+$/.test(lines[i + 1] ?? "")) {
      const table: MdTable = { header: splitRow(lines[i] ?? ""), rows: [], line: i + 1 };
      let j = i + 2;
      while (j < lines.length && isRow(j)) {
        table.rows.push({ cells: splitRow(lines[j] ?? ""), line: j + 1 });
        j++;
      }
      tables.push(table);
      i = j;
      continue;
    }
    i++;
  }
  return tables;
}
