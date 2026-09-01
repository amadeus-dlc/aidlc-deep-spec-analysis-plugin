import type { DigestAnchor } from "./digest-anchor.ts";

// 検証鮮度の純粋判断（移行 PR9、#22）——sourceDigest 照合のみ。内容ハッシュ
// だけが真実で、mtime の嘘（git checkout・touch・未来時刻）に騙されない。
// anchor は現行契約の必須宣言（ir-valid が強制）なので、持たないモデルは
// 無条件に stale——再検証が digest を刻む（anchor 以前の旧モデルを mtime
// ヒューリスティックで救う後方互換はオーナー裁定 2026-09-01 で削除）。
export class VerificationStaleness {
  readonly #anchor: DigestAnchor | null;

  private constructor(props: { anchor: DigestAnchor | null }) {
    this.#anchor = props.anchor;
  }

  static of(props: { anchor: DigestAnchor | null }): VerificationStaleness {
    return new VerificationStaleness(props);
  }

  isStale(): boolean {
    return this.#anchor === null ? true : !this.#anchor.expected.equals(this.#anchor.actual);
  }
}
