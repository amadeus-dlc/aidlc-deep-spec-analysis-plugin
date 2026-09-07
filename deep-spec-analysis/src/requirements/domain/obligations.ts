import {
  type FirstClassCollection,
  FirstClassCollectionBase,
  type KeySet,
  TargetIdentifiers,
  type VerificationMethod,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  ok,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { Obligation } from "./obligation.ts";
import type { ObligationIdentifier } from "./obligation-identifier.ts";
import type { QuintRuns } from "./quint-runs.ts";
import { VerificationFindings } from "./verification-findings.ts";
import type { VerificationSkips } from "./verification-skips.ts";

export class Obligations
  extends FirstClassCollectionBase<Obligation, Obligations>
  implements FirstClassCollection<Obligation>
{
  readonly #values: readonly Obligation[];

  private constructor(values: readonly Obligation[]) {
    super();
    this.#values = boundedCollectionSnapshot(values, 65_536, "too-many-obligations");
  }

  protected override rebuild(values: readonly Obligation[]): Obligations {
    return new Obligations(values);
  }

  override map(transform: (element: Obligation) => Obligation): Obligations {
    return this.mapTo(transform, Obligations.of);
  }

  override combine(other: Obligations): Obligations {
    return this.combineTo(other, Obligations.of);
  }

  static parse(values: readonly Obligation[]): Result<Obligations, ParseError> {
    return parseConstruction(() => new Obligations(values));
  }

  static of(values: readonly Obligation[]): Obligations {
    return new Obligations(values);
  }

  add(value: Obligation): Obligations {
    return new Obligations([...this.#values, value]);
  }

  override *[Symbol.iterator](): Iterator<Obligation> {
    yield* this.#values;
  }

  // 未 skip の義務を宣言順に時相検査へかける。skip はこの走査の中で積み上がり、
  // 後続の義務の「もう skip 済みか」の判定に効く——返す skip は受け取った skip を
  // 含む。最初の失敗で打ち切る。
  interpretQuintTemporal(
    method: VerificationMethod,
    runs: QuintRuns,
    skipped: VerificationSkips,
  ): Result<{ findings: VerificationFindings; skipped: VerificationSkips }, ParseError> {
    let findings = VerificationFindings.of([]);
    let accumulated = skipped;
    for (const obligation of this.#values) {
      const target = obligation.id().asTargetId();
      if (accumulated.exists((skip) => skip.isFor(target))) continue;
      const temporal = obligation.interpretQuintTemporal(method, runs.temporalOf(obligation.id()));
      if (!temporal.ok) return temporal;
      findings = findings.combine(temporal.value.findings);
      accumulated = accumulated.combine(temporal.value.skipped);
    }
    return ok({ findings, skipped: accumulated });
  }

  compiledInvariantTargets(compiled: KeySet<ObligationIdentifier>): TargetIdentifiers {
    return TargetIdentifiers.of(
      this.#values
        .filter((obligation) => obligation.isInvariantLike() && compiled.has(obligation.id()))
        .map((obligation) => obligation.id().asTargetId()),
    );
  }

  byId(id: string): Obligation | undefined {
    return this.#values.find((o) => o.id().asString() === id);
  }

  ids(): readonly string[] {
    return this.#values.map((o) => o.id().asString());
  }

  toArray(): readonly Obligation[] {
    return this.#values;
  }
}
