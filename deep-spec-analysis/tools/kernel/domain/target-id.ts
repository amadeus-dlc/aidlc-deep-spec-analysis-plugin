// 名前空間付き target id の決定論的サニタイズ。deep-spec-lib.ts からの逐語移動。
// （TargetId の Domain Primitive 化は後続 PR — この関数はその将来の家。）

// Namespaced target ids (unit:…, component:…, entity:…) must satisfy the
// findings schema's targetId pattern, but the raw names they are built from
// come out of free-form artifact text (a markdown table cell, a yaml scalar)
// and may carry spaces or other out-of-alphabet characters. Sanitize the
// token deterministically — the raw string always survives in the witness
// refs `value` — so a defective name can never invalidate the whole document.
export function safeTarget(prefix: string, raw: string): string {
  const token = raw.replace(/[^A-Za-z0-9_./-]/g, "-");
  return `${prefix}:${token === "" ? "unknown" : token}`;
}
