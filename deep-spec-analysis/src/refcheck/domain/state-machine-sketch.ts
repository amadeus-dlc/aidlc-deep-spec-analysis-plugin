import {
  type ArtifactPath,
  type ErrorMessage,
  FindingKind,
  FindingTargets,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import { combinedHash, hashOfNullable, hashOfString } from "@deep-spec-analysis/kernel-infrastructure";
import type { DeclaredEntities } from "./declared-entities.ts";
import type { EntityDeclaration } from "./entity-declaration.ts";
import { FD_S1, FD_S2 } from "./functional-check-families.ts";
import type { LineNumber } from "./line-number.ts";
import type { MachineSpecification } from "./machine-specification.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { StateNames } from "./state-names.ts";
import { WitnessReference } from "./witness-reference.ts";

// 状態機械の素描。自分の位置ラベル（凍結書式）と spec 分解を所有する。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type StateMachineSketchParam = {
  readonly spec: MachineSpecification; // "Entity" or "Entity.attribute" from the heading
  readonly states: StateNames;
  readonly fenceLine: LineNumber;
  readonly unsupported: string | null; // 文言材料（理由のプローズ）
};

type StateMachineSketchState =
  | { readonly kind: "declared"; readonly declaration: StateMachineSketchParam }
  | { readonly kind: "unrecognized"; readonly line: LineNumber; readonly reason: ErrorMessage };

export class StateMachineSketch {
  readonly #state: StateMachineSketchState;

  private constructor(state: StateMachineSketchState) {
    this.#state =
      state.kind === "declared" ? { kind: "declared", declaration: { ...state.declaration } } : { ...state };
  }

  static of(seed: StateMachineSketchParam): StateMachineSketch {
    return new StateMachineSketch({ kind: "declared", declaration: seed });
  }

  static unrecognized(line: LineNumber, reason: ErrorMessage): StateMachineSketch {
    return new StateMachineSketch({ kind: "unrecognized", line, reason });
  }

  coversLifecycleOf(entity: EntityDeclaration): boolean {
    if (this.#state.kind === "unrecognized") return false;
    const specification = this.#state.declaration.spec;
    return entity.lifecycleIsNamedBy(specification.entityToken(), specification.attributeToken());
  }

  // 境界: witness と skip 文言に載る位置ラベル（凍結書式）。
  locationLabel(): string {
    const state = this.#state;
    return state.kind === "unrecognized"
      ? `State Machine heading (line ${state.line.asNumber()})`
      : `State Machine: ${state.declaration.spec.asString()} (fence line ${state.declaration.fenceLine.asNumber()})`;
  }

  equals(other: StateMachineSketch): boolean {
    if (this.#state.kind !== other.#state.kind) return false;
    if (this.#state.kind === "unrecognized" && other.#state.kind === "unrecognized")
      return this.#state.line.equals(other.#state.line) && this.#state.reason.equals(other.#state.reason);
    if (this.#state.kind !== "declared" || other.#state.kind !== "declared") return false;
    const left = this.#state.declaration;
    const right = other.#state.declaration;
    return (
      left.spec.equals(right.spec) &&
      left.states.equals(right.states) &&
      left.fenceLine.equals(right.fenceLine) &&
      left.unsupported === right.unsupported
    );
  }

  hashCode(): number {
    const state = this.#state;
    if (state.kind === "unrecognized")
      return combinedHash([hashOfString(state.kind), state.line.hashCode(), state.reason.hashCode()]);
    const declaration = state.declaration;
    return combinedHash([
      hashOfString(state.kind),
      declaration.spec.hashCode(),
      declaration.states.hashCode(),
      declaration.fenceLine.hashCode(),
      hashOfNullable(declaration.unsupported, hashOfString),
    ]);
  }

  // FD-S1／S2 の不変条件（種別規律の裁定 13）: 図の状態は実体のライフサイクル
  // 属性の allowed values に含まれ（S1）、allowed values は図のどこかに現れる
  // （S2）。支持外の図・未宣言の実体・属性不明は skip／finding。文言は golden 凍結。
  check(
    report: ReferenceCheckReport,
    specArtifact: ArtifactPath,
    entitiesArtifact: ArtifactPath,
    entities: DeclaredEntities,
  ): void {
    if (this.#state.kind === "unrecognized") {
      for (const family of [FD_S1, FD_S2])
        report.skip(family, "unrecognized-format", `${this.locationLabel()}: ${this.#state.reason.asString()}`);
      return;
    }
    const declaration = this.#state.declaration;
    const specArt = specArtifact.asString();
    const entity = declaration.spec.entityToken();
    const entName = entity.asString();
    const attrName = declaration.spec.attributeToken();
    const el = this.locationLabel();
    if (declaration.unsupported !== null) {
      report.skip(FD_S1, "unrecognized-format", `${el}: ${declaration.unsupported}`);
      report.skip(FD_S2, "unrecognized-format", `${el}: ${declaration.unsupported}`);
      return;
    }
    const ent = entities.entities().byNormalizedName(entity.normalized());
    if (!ent) {
      report.finding(
        FD_S1,
        FindingKind.consistencyMismatch(),
        FindingTargets.of(TargetIdentifier.of(TargetIdentifiers.safe("entity", entName)), []),
        [WitnessReference.at(specArt, el, entName)],
        `state machine names entity "${entName}" which is not declared in entities.md`,
      );
      return;
    }
    const attr = ent.lifecycleAttribute(attrName);
    if (!attr?.hasAllowedValues()) {
      report.skip(
        FD_S1,
        "unrecognized-format",
        `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`,
      );
      report.skip(
        FD_S2,
        "unrecognized-format",
        `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`,
      );
      return;
    }
    attr.checkDiagramStates(declaration.states, report, ent.name(), specArtifact, entitiesArtifact, el);
  }
}
