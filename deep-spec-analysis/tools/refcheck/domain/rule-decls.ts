import { RuleDecl } from "./rule-decl.ts";
import type { ArtifactPath, RequirementIds } from "../../kernel/domain/index.ts";
import type { DeclaredEntities } from "./declared-entities.ts";
import { FD_R1, FD_R2, FD_R3, FD_R4, FD_R5 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessRef } from "./witness-ref.ts";

export class RuleDecls {
  readonly #values: readonly RuleDecl[];

  private constructor(values: readonly RuleDecl[]) {
    this.#values = values;
  }

  static of(values: readonly RuleDecl[]): RuleDecls {
    return new RuleDecls([...values]);
  }

  add(value: RuleDecl): RuleDecls {
    return new RuleDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<RuleDecl> {
    yield* this.#values;
  }

  toArray(): readonly RuleDecl[] {
    return this.#values;
  }


  // FD-R1..FD-R5 の不変条件（種別規律の裁定 13）: 必須キー（R1）、id の形と
  // 一意性（R2）、source id の存在（R3、requirements が読めたときだけ）、
  // applies-to の解決（R4、entities が使えるときだけ）、category の閉集合（R5）。
  // 文言と発生順は golden 凍結。
  check(report: ReferenceCheckReport, artifact: ArtifactPath, requirementIdsKnown: RequirementIds | null, entities: DeclaredEntities | null): void {
    const art = artifact.asString();
    for (const r of this) {
      if (r.missing().length > 0) {
        report.finding(FD_R1, "structure-invalid", [r.findingTarget("check:FD-R1")],
          [WitnessRef.at(art, r.element().asString())],
          `rule is missing required key(s): ${r.missing().join(", ")}`);
      }
    }
    // FD-R2: id shape + uniqueness
    const seenIds = new Set<string>();
    for (const r of this) {
      const id = r.id();
      if (id === null) continue;
      if (!id.matchesShape()) {
        report.finding(FD_R2, "structure-invalid", [FD_R2.asCheckTarget()], [WitnessRef.at(art, `${r.element().asString()}.id`, id.asString())],
          `rule id "${id.asString()}" does not match BR{group}.{seq}`);
        continue;
      }
      if (seenIds.has(id.asString())) {
        report.finding(FD_R2, "structure-invalid", [id.asString()], [WitnessRef.at(art, `${r.element().asString()}.id`, id.asString())],
          `rule id "${id.asString()}" is declared more than once`);
      }
      seenIds.add(id.asString());
    }
    // FD-R3: source FR/NFR ids exist in requirements.md
    if (requirementIdsKnown === null) {
      report.skip(FD_R3, "absent-input", "requirements.md not found under this intent record — source ids cannot be reverse-verified");
    } else {
      for (const r of this) {
        const missing = r.sourceIdValuesMissingFrom(requirementIdsKnown);
        if (missing.length > 0) {
          report.finding(FD_R3, "reference-broken",
            [r.findingTarget("check:FD-R3")],
            missing.map((id) => WitnessRef.at(art, `${r.element().asString()}.source`, id)),
            `source id(s) ${missing.join(", ")} do not exist in requirements.md`, missing);
        }
      }
    }
    // FD-R4: applies-to resolves against entities.md
    if (entities === null) {
      report.skip(FD_R4, "absent-input", "entities.md is unavailable — applies-to cannot be resolved");
    } else {
      for (const r of this) {
        const appliesTo = r.appliesTo();
        if (appliesTo === null) continue;
        if (!entities.entities().resolvesAppliesTo(appliesTo)) {
          report.finding(FD_R4, "reference-broken",
            [r.findingTarget("check:FD-R4")],
            [WitnessRef.at(art, r.element().asString(), appliesTo.asString())],
            `applies-to "${appliesTo.asString()}" does not resolve to a declared entity or entity.attribute`);
        }
      }
    }
    // FD-R5: category closed set
    for (const r of this) {
      if (r.categoryOutsideClosedSet()) {
        report.finding(FD_R5, "structure-invalid",
          [r.findingTarget("check:FD-R5")],
          [WitnessRef.at(art, `${r.element().asString()}.category`, r.category()?.asString() ?? "")],
          `category "${r.category()?.asString()}" is not one of validation | authorization | constraint | calculation | policy`);
      }
    }
  }
}
