// requirements.md 中の FR/NFR id 抽出（frRefs 逆検証の語彙）。逐語移動。

export function requirementIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const m of text.matchAll(/\b(?:FR|NFR)-?[0-9]+(?:\.[0-9]+)*\b/g)) {
    ids.add(m[0]);
  }
  return ids;
}
