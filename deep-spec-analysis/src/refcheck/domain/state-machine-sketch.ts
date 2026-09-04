import { type MachineSpec } from "./machine-spec.ts";
import { type StateNames } from "./state-names.ts";
import type { LineNumber } from "./line-number.ts";
import { FindingKind, TargetIds, type ArtifactPath } from "@deep-spec/kernel-domain";
import type { DeclaredEntities } from "./declared-entities.ts";
import { FD_S1, FD_S2 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessRef } from "./witness-ref.ts";

// 状態機械の素描。自分の位置ラベル（凍結書式）と spec 分解を所有する。
export class StateMachineSketch {
  readonly #seed: {
  readonly spec: MachineSpec; // "Entity" or "Entity.attribute" from the heading
  readonly states: StateNames;
  readonly fenceLine: LineNumber;
  readonly unsupported: string | null; // 文言材料（理由のプローズ）
  };

  private constructor(seed: {
    readonly spec: MachineSpec; // "Entity" or "Entity.attribute" from the heading
    readonly states: StateNames;
    readonly fenceLine: LineNumber;
    readonly unsupported: string | null; // 文言材料（理由のプローズ）
  }) {
    this.#seed = seed;
  }

  static reconstitute(seed: {
    readonly spec: MachineSpec; // "Entity" or "Entity.attribute" from the heading
    readonly states: StateNames;
    readonly fenceLine: LineNumber;
    readonly unsupported: string | null; // 文言材料（理由のプローズ）
  }): StateMachineSketch {
    return new StateMachineSketch(seed);
  }

  spec(): MachineSpec {
    return this.#seed.spec;
  }

  states(): StateNames {
    return this.#seed.states;
  }

  unsupported(): string | null {
    return this.#seed.unsupported;
  }

  // 境界: witness と skip 文言に載る位置ラベル（凍結書式）。
  locationLabel(): string {
    return `State Machine: ${this.#seed.spec.asString()} (fence line ${this.#seed.fenceLine.asNumber()})`;
  }


  // FD-S1／S2 の不変条件（種別規律の裁定 13）: 図の状態は実体のライフサイクル
  // 属性の allowed values に含まれ（S1）、allowed values は図のどこかに現れる
  // （S2）。支持外の図・未宣言の実体・属性不明は skip／finding。文言は golden 凍結。
  check(report: ReferenceCheckReport, specArtifact: ArtifactPath, entitiesArtifact: ArtifactPath, entities: DeclaredEntities): void {
    const specArt = specArtifact.asString();
    const entitiesArt = entitiesArtifact.asString();
    const entity = this.spec().entityToken();
    const entName = entity.asString();
    const attrName = this.spec().attributeToken();
    const el = this.locationLabel();
    if (this.unsupported() !== null) {
      report.skip(FD_S1, "unrecognized-format", `${el}: ${this.unsupported()}`);
      report.skip(FD_S2, "unrecognized-format", `${el}: ${this.unsupported()}`);
      return;
    }
    const ent = entities.entities().byNormalizedName(entity.normalized());
    if (!ent) {
      report.finding(FD_S1, FindingKind.consistencyMismatch(), [TargetIds.safe("entity", entName)], [WitnessRef.at(specArt, el, entName)],
        `state machine names entity "${entName}" which is not declared in entities.md`);
      return;
    }
    const attr = attrName !== undefined ? ent.attrNamed(attrName) : ent.lifecycleAttr();
    if (!attr || !attr.hasAllowedValues()) {
      report.skip(FD_S1, "unrecognized-format",
        `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`);
      report.skip(FD_S2, "unrecognized-format",
        `${el}: no lifecycle attribute with allowed values could be determined for entity "${ent.name().asString()}"`);
      return;
    }
    // FD-S1/S2: 図と allowed の差分は属性宣言が自分で告げる。
    const attrId = TargetIds.safe("attr", `${ent.name().asString()}.${attr.name().asString()}`);
    const rogue = attr.rogueDiagramStates(this.states());
    if (rogue.length > 0) {
      report.finding(FD_S1, FindingKind.consistencyMismatch(), [attrId],
        rogue.map((v) => WitnessRef.at(specArt, el, v)),
        `diagram state(s) ${rogue.join(", ")} are not allowed values of ${ent.name().asString()}.${attr.name().asString()} in entities.md`);
    }
    const dangling = attr.allowedValuesAbsentFrom(this.states());
    if (dangling.length > 0) {
      report.finding(FD_S2, FindingKind.consistencyMismatch(), [attrId],
        dangling.map((v) => WitnessRef.at(entitiesArt, attr.element().asString(), v)),
        `allowed value(s) ${dangling.join(", ")} of ${ent.name().asString()}.${attr.name().asString()} appear in no diagram state`);
    }
  }
}
