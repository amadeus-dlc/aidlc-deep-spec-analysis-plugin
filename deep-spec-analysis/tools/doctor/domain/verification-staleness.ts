import type { DigestAnchor } from "./digest-anchor.ts";

// 検証鮮度の純粋判断（移行 PR9、#22）——sourceDigest 照合＋mtime
// フォールバック。anchor がある限り内容ハッシュだけが真実で、mtime の嘘
//（git checkout・touch・未来時刻）に騙されない。anchor 以前のモデルは
// mtime ヒューリスティックで判じ、次の再検証で anchor が刻まれる。
export class VerificationStaleness {
  readonly #anchor: DigestAnchor | null;
  readonly #sourceNewerThanModel: boolean;

  private constructor(props: { anchor: DigestAnchor | null; sourceNewerThanModel: boolean }) {
    this.#anchor = props.anchor;
    this.#sourceNewerThanModel = props.sourceNewerThanModel;
  }

  static of(props: { anchor: DigestAnchor | null; sourceNewerThanModel: boolean }): VerificationStaleness {
    return new VerificationStaleness(props);
  }

  isStale(): boolean {
    return this.#anchor ? !this.#anchor.expected.equals(this.#anchor.actual) : this.#sourceNewerThanModel;
  }
}
