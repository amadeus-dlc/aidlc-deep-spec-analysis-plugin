import {
  ArtifactPath,
  type NonEmptyFirstClassCollection,
  NonEmptyFirstClassCollectionBase,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  err as failure,
  ok,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { InstalledStatus } from "./installed-status.ts";
import { InstalledStatuses } from "./installed-statuses.ts";
import { ManifestEntries } from "./manifest-entries.ts";
import { ManifestEntry } from "./manifest-entry.ts";

const err = (rel: string): ManifestEntry => ManifestEntry.error(ArtifactPath.of(rel));

// compose が運ぶべきファイルの台帳（entry バンドル・スキーマ・sensors・
// knowledge）。出荷形は tools/<entry>.ts 10 本＋tools/data/ 4 本ちょうどなので、
// 層ツリーの canary 行は持たない（src/ はソースであって配布物ではない）。
// 行順は doctor stdout の manifest 検査行の凍結順。intent-e2e の compose 検査
// リストと同期を保つこと（移行 PR9、#22）。
export class InstallationManifest
  extends NonEmptyFirstClassCollectionBase<ManifestEntry, ManifestEntries>
  implements NonEmptyFirstClassCollection<ManifestEntry>
{
  readonly #entries: readonly ManifestEntry[];

  private constructor(head: ManifestEntry, tail: readonly ManifestEntry[]) {
    super();
    const ownedTail = boundedCollectionSnapshot(tail, 65_535, "too-many-installation-manifest-entries");
    this.#entries = Object.freeze([head, ...ownedTail]);
  }

  static of(head: ManifestEntry, tail: readonly ManifestEntry[]): InstallationManifest {
    return new InstallationManifest(head, tail);
  }

  static parse(head: ManifestEntry, tail: readonly ManifestEntry[]): Result<InstallationManifest, ParseError> {
    return parseConstruction(() => new InstallationManifest(head, tail));
  }

  override map(transform: (element: ManifestEntry) => ManifestEntry): InstallationManifest {
    return this.mapTo(transform, ([head, ...tail]) => InstallationManifest.of(head, tail));
  }

  override combine(other: InstallationManifest): InstallationManifest {
    return this.combineTo(other, ([head, ...tail]) => InstallationManifest.of(head, tail));
  }

  protected override rebuild(values: readonly ManifestEntry[]): ManifestEntries {
    return ManifestEntries.of(values);
  }

  static standard(): InstallationManifest {
    return InstallationManifest.of(err("sensors/aidlc-deep-spec-ir-valid.md"), [
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

  // 台帳の全行を実在判定にかけ、凍結順のまま設置状態の列にまとめる。
  // 判定は port が担うので callback で受け、最初の取得失敗をそのまま伝える。
  checkedBy<E>(isInstalled: (entry: ManifestEntry) => Result<boolean, E>): Result<InstalledStatuses, E> {
    let statuses = InstalledStatuses.empty();
    for (const entry of this.#entries) {
      const present = isInstalled(entry);
      if (!present.ok) return failure(present.error);
      statuses = statuses.add(InstalledStatus.of(entry, present.value));
    }
    return ok(statuses);
  }

  override *[Symbol.iterator](): Iterator<ManifestEntry> {
    yield* this.#entries;
  }
}
