import type { UnitDeclaration } from "./unit-declaration.ts";
import { UnitNames } from "./unit-names.ts";
import { FindingKind, TargetIdentifiers, type ArtifactPath } from "@deep-spec/kernel-domain";
import { CD_3 } from "./contract-check-families.ts";
import type { ContractRows } from "./contract-rows.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessReference } from "./witness-reference.ts";

// units エッジブロックの宣言面——CD-1 の照合と CD-3 の走査順を知識に持つ。
export class UnitDeclarations {
  readonly #values: readonly UnitDeclaration[];

  private constructor(values: readonly UnitDeclaration[]) {
    this.#values = Object.freeze([...values]);
  }

  static of(values: readonly UnitDeclaration[]): UnitDeclarations {
    return new UnitDeclarations(values);
  }

  add(value: UnitDeclaration): UnitDeclarations {
    return new UnitDeclarations([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnitDeclaration> {
    yield* this.#values;
  }

  declares(value: string): boolean {
    return this.#values.some((u) => u.name().asString() === value);
  }

  names(): UnitNames {
    return UnitNames.of(this.#values.map((u) => u.name()));
  }

  // CD-3 の走査順（unit 名の辞書順）はコレクション知識。
  sortedByName(): UnitDeclarations {
    return new UnitDeclarations([...this.#values].sort((a, b) => (a.name().asString() < b.name().asString() ? -1 : 1)));
  }

  toArray(): readonly UnitDeclaration[] {
    return this.#values;
  }


  // CD-3 の不変条件（種別規律の裁定 12）: 宣言済みの依存辺は契約表の行に
  // どちらかの向きで覆われる。走査は名前順、依存先は宣言の値順（凍結）。
  checkEdgesCovered(rows: ContractRows, report: ReferenceCheckReport, artifact: ArtifactPath, depArtifact: ArtifactPath): void {
    const art = artifact.asString();
    const depArt = depArtifact.asString();
    for (const u of this.sortedByName()) {
      const uName = u.name().asString();
      // 宙に浮いた辺（未宣言の依存先）は宣言が落とす——units-generation の問題。
      for (const dep of u.declaredDependencies(this)) {
        const depName = dep.asString();
        if (!rows.coversEdge(depName, uName)) {
          report.finding(CD_3, FindingKind.consistencyMismatch(), [TargetIdentifiers.safe("unit", depName), TargetIdentifiers.safe("unit", uName)],
            [WitnessReference.at(depArt, `units (${uName} depends_on ${depName})`), WitnessReference.at(art, "contracts table")],
            `unit dependency edge "${uName}" -> "${depName}" has no contracts-table row in either orientation`);
        }
      }
    }
  }
}
