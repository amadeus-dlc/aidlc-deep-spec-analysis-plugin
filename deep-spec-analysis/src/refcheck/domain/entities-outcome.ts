import type { DeclaredEntities } from "./declared-entities.ts";
import type { LineNumber } from "./line-number.ts";
import { FindingKind, type ArtifactPath } from "@deep-spec/kernel-domain";
import { FD_E1, FD_E2, FD_E3, FD_E4, FD_E5, FD_E6 } from "./functional-check-families.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import { WitnessRef } from "./witness-ref.ts";
import { FenceCount } from "./fence-count.ts";

// entities.md の yaml 真実源ブロックの解析結果——文書が無い、フェンス数が
// 違う、解析できない、抽出できた。FD-E 検査は `match` で解釈へ命じる
// （#71 波26）。
export class EntitiesOutcome {
  readonly #kind: "absent" | "wrong-fence-count" | "unparseable" | "extracted";
  readonly #found: FenceCount;
  readonly #line: LineNumber | null;
  readonly #error: string | null;
  readonly #model: DeclaredEntities | null;

  private constructor(props: { kind: "absent" | "wrong-fence-count" | "unparseable" | "extracted"; found: number; line: LineNumber | null; error: string | null; model: DeclaredEntities | null }) {
    this.#kind = props.kind;
    this.#found = FenceCount.of(props.found);
    this.#line = props.line;
    this.#error = props.error;
    this.#model = props.model;
  }

  static absent(): EntitiesOutcome {
    return new EntitiesOutcome({ kind: "absent", found: 0, line: null, error: null, model: null });
  }

  static wrongFenceCount(found: number): EntitiesOutcome {
    return new EntitiesOutcome({ kind: "wrong-fence-count", found, line: null, error: null, model: null });
  }

  static unparseable(line: LineNumber, error: string): EntitiesOutcome {
    return new EntitiesOutcome({ kind: "unparseable", found: 0, line, error, model: null });
  }

  static extracted(model: DeclaredEntities): EntitiesOutcome {
    return new EntitiesOutcome({ kind: "extracted", found: 0, line: null, error: null, model });
  }

  match<T>(handlers: {
    absent: () => T;
    wrongFenceCount: (found: number) => T;
    unparseable: (line: LineNumber, error: string) => T;
    extracted: (model: DeclaredEntities) => T;
  }): T {
    if (this.#kind === "absent") return handlers.absent();
    if (this.#kind === "wrong-fence-count") return handlers.wrongFenceCount(this.#found.asNumber());
    if (this.#kind === "unparseable" && this.#line !== null) return handlers.unparseable(this.#line, this.#error ?? "");
    if (this.#model === null) throw new Error("defect: an extracted entities document carries no model");
    return handlers.extracted(this.#model);
  }


  // FD-E1 の門（種別規律の裁定 13）: 文書が無ければ FD-E を skip、fence の形が
  // 崩れていれば finding と blocked スキップ。抽出できれば宣言集合が FD-E1..E6
  // を書き、後続（FD-R4／FD-S）のために宣言集合を返す。文言は golden 凍結。
  check(report: ReferenceCheckReport, artifact: ArtifactPath): DeclaredEntities | null {
    const art = artifact.asString();
    return this.match<DeclaredEntities | null>({
      absent: () => {
        for (const f of [FD_E1, FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
          report.skip(f, "absent-input", "entities.md is not present in this unit's functional-design record");
        }
        return null;
      },
      wrongFenceCount: (found) => {
        report.finding(FD_E1, FindingKind.structureInvalid(), [FD_E1.asCheckTarget()], [WitnessRef.at(art, "yaml fence")],
          `entities.md must carry exactly one fenced yaml source-of-truth block (found ${found})`);
        for (const f of [FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
          report.skip(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
        }
        return null;
      },
      unparseable: (line, error) => {
        report.finding(FD_E1, FindingKind.structureInvalid(), [FD_E1.asCheckTarget()], [WitnessRef.at(art, `yaml fence (line ${line.asNumber()})`)],
          `yaml block does not parse in the supported subset: ${error}`);
        for (const f of [FD_E2, FD_E3, FD_E4, FD_E5, FD_E6]) {
          report.skip(f, "unrecognized-format", "blocked by FD-E1: the entities yaml block is unusable");
        }
        return null;
      },
      extracted: (model) => {
        model.check(report, artifact);
        return model;
      },
    });
  }
}
