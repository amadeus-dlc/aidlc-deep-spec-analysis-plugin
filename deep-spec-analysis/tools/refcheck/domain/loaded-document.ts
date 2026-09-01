import type { InputAnchor } from "./input-anchor.ts";

// 読み込まれ解析済みの 1 文書：inputs[] 記録用の (artifact, sha256) と解析結果。
export interface LoadedDocument<Outcome> {
  readonly input: InputAnchor;
  readonly outcome: Outcome;
}
