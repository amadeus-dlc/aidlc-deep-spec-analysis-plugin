// markdown フェンス走査 — 1-based 開始行付き。deep-spec-lib.ts からの逐語移動。

export interface Fence {
  info: string;
  body: string;
  line: number; // 1-based line of the opening fence
}

export function extractFences(md: string, lang: string): Fence[] {
  const fences: Fence[] = [];
  const lines = md.split("\n");
  let open = false;
  let info = "";
  let openLine = 0;
  let buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = (lines[i] ?? "").match(/^\s*```(.*)$/);
    if (m && !open) {
      open = true;
      info = (m[1] ?? "").trim().toLowerCase();
      openLine = i + 1;
      buf = [];
      continue;
    }
    if (m && open) {
      if (info === lang || info.startsWith(`${lang} `)) {
        fences.push({ info, body: buf.join("\n"), line: openLine });
      }
      open = false;
      continue;
    }
    if (open) buf.push(lines[i] ?? "");
  }
  return fences;
}
