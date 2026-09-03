import { EntityDecls } from "./entity-decls.ts";
import { RelDecls } from "./rel-decls.ts";
import { ShapeErrors } from "./shape-errors.ts";
import { TargetIds, type ArtifactPath } from "@deep-spec/kernel-domain";
import { FD_E1, FD_E2, FD_E3, FD_E4, FD_E5, FD_E6 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessRef } from "./witness-ref.ts";

// entities.md の宣言集合。参照解決・applies-to 解決・ライフサイクル対象の
// 選定はエンティティコレクションに委ね、最上位と各エンティティ配下の関係の
// 合成順（凍結）を所有する。
export class DeclaredEntities {
  readonly #seed: {
  readonly entities: EntityDecls;
  readonly rels: RelDecls; // top-level relationships
  readonly shapeErrors: ShapeErrors;
  };

  private constructor(seed: {
    readonly entities: EntityDecls;
    readonly rels: RelDecls; // top-level relationships
    readonly shapeErrors: ShapeErrors;
  }) {
    this.#seed = seed;
  }

  static reconstitute(seed: {
    readonly entities: EntityDecls;
    readonly rels: RelDecls; // top-level relationships
    readonly shapeErrors: ShapeErrors;
  }): DeclaredEntities {
    return new DeclaredEntities(seed);
  }

  entities(): EntityDecls {
    return this.#seed.entities;
  }

  shapeErrors(): ShapeErrors {
    return this.#seed.shapeErrors;
  }

  // 最上位＋各エンティティ配下の全関係宣言（旧 allRels の合成順）。
  allRels(): RelDecls {
    let all = this.#seed.rels;
    for (const e of this.#seed.entities) all = all.concat(e.rels());
    return all;
  }


  // FD-E1..FD-E6 の不変条件（種別規律の裁定 13）: 形の誤りと重複（E1）、型区分
  // の整合（E2）、範囲と既定値（E3）、関係の端点（E4）と多重度（E5）、参照の
  // 解決（E6）。判定は属性宣言・関係宣言・コレクションの知識、文言と発生順は
  // golden 凍結。
  check(report: ReferenceCheckReport, artifact: ArtifactPath): void {
    const art = artifact.asString();
    for (const e of this.shapeErrors()) {
      report.finding(FD_E1, "structure-invalid", [FD_E1.asCheckTarget()], [WitnessRef.at(art, e.element().asString())], e.detail());
    }
    for (const dup of this.entities().duplicatesByName()) {
      report.finding(FD_E1, "structure-invalid", [TargetIds.safe("entity", dup.name().asString())], [WitnessRef.at(art, `${dup.element().asString()}.name`, dup.name().asString())],
        `entity "${dup.name().asString()}" is declared more than once`);
    }
    for (const e of this.entities()) {
      for (const dup of e.attrs().duplicatesByName()) {
        report.finding(FD_E1, "structure-invalid", [TargetIds.safe("attr", `${e.name().asString()}.${dup.name().asString()}`)], [WitnessRef.at(art, `${dup.element().asString()}.name`, dup.name().asString())],
          `attribute "${e.name().asString()}.${dup.name().asString()}" is declared more than once`);
      }
    }

    for (const e of this.entities()) {
      for (const a of e.attrs()) {
        const attrId = TargetIds.safe("attr", `${e.name().asString()}.${a.name().asString()}`);
        const label = `${e.name().asString()}.${a.name().asString()}`;
        // FD-E2: 型区分整合は属性宣言が自分で判定する。
        if (a.declaresAllowedValuesOnNonEnumerableType()) {
          report.finding(FD_E2, "structure-invalid", [attrId], [WitnessRef.at(art, a.element().asString(), a.typeToken())],
            `"${label}" declares allowed values but its type "${a.typeText()}" is not an enumerable type`);
        }
        if (a.declaresBoundsOnNonNumericType()) {
          report.finding(FD_E2, "structure-invalid", [attrId], [WitnessRef.at(art, a.element().asString(), a.typeToken())],
            `"${label}" declares min/max but its type "${a.typeText()}" is not numeric or date-like`);
        }
        if (a.declaresUniqueOnCollectionType()) {
          report.finding(FD_E2, "structure-invalid", [attrId], [WitnessRef.at(art, a.element().asString(), a.typeToken())],
            `"${label}" declares unique but its type "${a.typeText()}" is not scalar`);
        }
        // FD-E3: 範囲・既定値の整合も属性宣言が告げる。
        if (a.boundsInverted()) {
          report.finding(FD_E3, "structure-invalid", [attrId], [WitnessRef.at(art, a.element().asString(), `min ${a.min()?.asNumber()} > max ${a.max()?.asNumber()}`)],
            `"${label}": min ${a.min()?.asNumber()} exceeds max ${a.max()?.asNumber()}`);
        }
        if (a.defaultBelowMin()) {
          report.finding(FD_E3, "structure-invalid", [attrId], [WitnessRef.at(art, a.element().asString(), a.def()?.render() ?? "")],
            `"${label}": default ${a.def()?.render()} is below min ${a.min()?.asNumber()}`);
        }
        if (a.defaultAboveMax()) {
          report.finding(FD_E3, "structure-invalid", [attrId], [WitnessRef.at(art, a.element().asString(), a.def()?.render() ?? "")],
            `"${label}": default ${a.def()?.render()} is above max ${a.max()?.asNumber()}`);
        }
        if (a.defaultOutsideAllowed()) {
          report.finding(FD_E3, "structure-invalid", [attrId], [WitnessRef.at(art, a.element().asString(), a.def()?.render() ?? "")],
            `"${label}": default "${a.def()?.render()}" is not one of the allowed values`);
        }
        // FD-E6: 参照の解決は宣言集合が告げる。
        const reference = a.references();
        if (reference !== null && !this.entities().resolvesReference(reference)) {
          report.finding(FD_E6, "reference-broken", [attrId], [WitnessRef.at(art, a.element().asString(), reference.asString())],
            `"${label}" references "${reference.asString()}" which is not a declared entity`);
        }
      }
    }
    // FD-E4 / FD-E5: 関係宣言が自分の整合を告げる。
    for (const r of this.allRels()) {
      for (const endpoint of [r.from(), r.to()]) {
        if (endpoint !== null && !this.entities().containsNamed(endpoint)) {
          report.finding(FD_E4, "reference-broken", [TargetIds.safe("entity", endpoint.asString())], [WitnessRef.at(art, r.element().asString(), endpoint.asString())],
            `relationship endpoint "${endpoint.asString()}" is not a declared entity`);
        }
      }
      if (r.cardinalityOutsideClosedSet()) {
        report.finding(FD_E5, "structure-invalid", [FD_E5.asCheckTarget()], [WitnessRef.at(art, r.element().asString(), r.cardinality()?.asString() ?? "")],
          `cardinality "${r.cardinality()?.asString()}" is not in the closed set 1:1 | 1:N | N:1 | N:M`);
      }
      if (r.cardinalityWithoutDirection()) {
        report.finding(FD_E5, "structure-invalid", [FD_E5.asCheckTarget()], [WitnessRef.at(art, r.element().asString())],
          "relationship declares a cardinality but no direction (from/to or direction key)");
      }
    }
  }
}
