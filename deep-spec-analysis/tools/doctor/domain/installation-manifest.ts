import { ManifestEntry } from "./manifest-entry.ts";

const err = (rel: string): ManifestEntry => ManifestEntry.error(rel);

// compose が運ぶべきファイルの台帳（entry・doctor・スキーマ・knowledge・
// 各コンテキスト canary）。行順は doctor stdout の manifest 検査行の凍結順。
// intent-e2e の compose 検査リストと同期を保つこと（移行 PR9、#22）。
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
      // コンテキストごとの canary（DDD 移行 — facade が在ればツリーが運ばれている）
      err("tools/kernel/infrastructure/index.ts"),
      err("tools/kernel/domain/index.ts"),
      err("tools/kernel/usecase/index.ts"),
      err("tools/kernel/adapter/index.ts"),
      err("tools/refcheck/domain/index.ts"),
      err("tools/refcheck/usecase/index.ts"),
      err("tools/refcheck/adapter/index.ts"),
      err("tools/requirements/domain/index.ts"),
      err("tools/requirements/usecase/index.ts"),
      err("tools/requirements/adapter/index.ts"),
      err("tools/design/domain/index.ts"),
      err("tools/design/usecase/index.ts"),
      err("tools/design/adapter/index.ts"),
      err("tools/refinement/domain/index.ts"),
      // doctor 自身のツリー（移行 PR9 で層化——entry と 3 facade が canary）
      err("tools/deep-spec-analysis-doctor.ts"),
      err("tools/doctor/domain/index.ts"),
      err("tools/doctor/usecase/index.ts"),
      err("tools/doctor/adapter/index.ts"),
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
