import { ManifestEntry } from "./manifest-entry.ts";

const err = (rel: string): ManifestEntry => ManifestEntry.error(rel);

// compose が運ぶべきファイルの台帳（entry バンドル・スキーマ・sensors・
// knowledge）。出荷形は tools/<entry>.ts 10 本＋tools/data/ 4 本ちょうどなので、
// 層ツリーの canary 行は持たない（src/ はソースであって配布物ではない）。
// 行順は doctor stdout の manifest 検査行の凍結順。intent-e2e の compose 検査
// リストと同期を保つこと（移行 PR9、#22）。
export class InstallationManifest {
  readonly #entries: readonly ManifestEntry[];

  private constructor(entries: readonly ManifestEntry[]) {
    this.#entries = entries;
  }

  static standard(): InstallationManifest {
    return new InstallationManifest([
      err("sensors/aidlc-deep-spec-ir-valid.md"),
      err("sensors/aidlc-deep-spec-verify-smt.md"),
      err("sensors/aidlc-deep-spec-verify-quint.md"),
      err("tools/aidlc-sensor-deep-spec-ir-valid.ts"),
      err("tools/aidlc-sensor-deep-spec-verify-smt.ts"),
      err("tools/aidlc-sensor-deep-spec-verify-quint.ts"),
      err("tools/data/deep-spec-ir-schema.json"),
      err("tools/data/deep-spec-findings-schema.json"),
      err("knowledge/aidlc-product-agent/deep-spec-ir-authoring.md"),
      err("sensors/aidlc-deep-spec-refcheck-domain.md"),
      err("sensors/aidlc-deep-spec-refcheck-contract.md"),
      err("sensors/aidlc-deep-spec-refcheck-functional.md"),
      err("tools/aidlc-sensor-deep-spec-refcheck-domain.ts"),
      err("tools/aidlc-sensor-deep-spec-refcheck-contract.ts"),
      err("tools/aidlc-sensor-deep-spec-refcheck-functional.ts"),
      err("tools/deep-spec-analysis-doctor.ts"),
      err("sensors/aidlc-deep-spec-design-ir-valid.md"),
      err("sensors/aidlc-deep-spec-design-verify-smt.md"),
      err("sensors/aidlc-deep-spec-design-verify-quint.md"),
      err("tools/aidlc-sensor-deep-spec-design-ir-valid.ts"),
      err("tools/aidlc-sensor-deep-spec-design-verify-smt.ts"),
      err("tools/aidlc-sensor-deep-spec-design-verify-quint.ts"),
      err("tools/data/deep-spec-design-ir-schema.json"),
      err("knowledge/aidlc-architect-agent/deep-spec-design-ir-authoring.md"),
      err("tools/data/deep-spec-refinement-map-schema.json"),
      err("knowledge/aidlc-architect-agent/deep-spec-refinement-map-authoring.md"),
    ]);
  }

  *[Symbol.iterator](): Iterator<ManifestEntry> {
    yield* this.#entries;
  }
}
