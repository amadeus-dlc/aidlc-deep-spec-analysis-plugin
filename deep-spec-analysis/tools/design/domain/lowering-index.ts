import type { DesignMachine } from "./design-machine.ts";
import { LoweredOriginRef } from "./lowered-origin-ref.ts";
import type { LoweredOrigin } from "./lowered-origin.ts";

function designToken(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

// lowering 索引——lowered id と設計語彙（DOB/TR/SM/DSC id・機械・属性パス）の
// 対応を閉じ込める。remap はこの索引に「訊く」のではなく「頼む」：lowered id
// の設計帰属解決とテキスト書き換えは索引自身の振る舞い。
export class LoweringIndex {
  readonly #origins: ReadonlyMap<string, LoweredOrigin>;
  readonly #scenarioDesignIds: ReadonlyMap<string, string>;
  readonly #machinesByTransition: ReadonlyMap<string, DesignMachine>;
  readonly #attrPathsByMachine: ReadonlyMap<string, string>;

  private constructor(props: {
    origins: ReadonlyMap<string, LoweredOrigin>;
    scenarioDesignIds: ReadonlyMap<string, string>;
    machinesByTransition: ReadonlyMap<string, DesignMachine>;
    attrPathsByMachine: ReadonlyMap<string, string>;
  }) {
    this.#origins = props.origins;
    this.#scenarioDesignIds = props.scenarioDesignIds;
    this.#machinesByTransition = props.machinesByTransition;
    this.#attrPathsByMachine = props.attrPathsByMachine;
  }

  static of(props: {
    origins: ReadonlyMap<string, LoweredOrigin>;
    scenarioDesignIds: ReadonlyMap<string, string>;
    machinesByTransition: ReadonlyMap<string, DesignMachine>;
    attrPathsByMachine: ReadonlyMap<string, string>;
  }): LoweringIndex {
    return new LoweringIndex({
      origins: new Map(props.origins),
      scenarioDesignIds: new Map(props.scenarioDesignIds),
      machinesByTransition: new Map(props.machinesByTransition),
      attrPathsByMachine: new Map(props.attrPathsByMachine),
    });
  }

  originOf(loweredId: string): LoweredOrigin | null {
    return this.#origins.get(loweredId) ?? null;
  }

  // lowered 対象 → 設計帰属。義務・合成の origin → シナリオ → 逐語、の
  // 解決順は remap の凍結挙動。
  resolveDesignTarget(loweredId: string): { design: string; entry: LoweredOrigin | null } {
    const entry = this.#origins.get(loweredId) ?? null;
    if (entry) return { design: entry.design.asString(), entry };
    const dsc = this.#scenarioDesignIds.get(loweredId);
    if (dsc) return { design: dsc, entry: null };
    return { design: loweredId, entry: null };
  }

  // v1 detail 内の OB-n 参照を設計 id へ書き換える（"DOB-2" は \bOB-2\b
  // 境界を含まないため二重書き換えは起きない）。
  rewriteLoweredIds(text: string): string {
    return text.replace(/\bOB-([0-9]+)\b/g, (m, num) => this.#origins.get(`OB-${num}`)?.design.asString() ?? m);
  }

  // witness core のラベル内 OB_n トークンを設計 id の英数字化へ書き換える。
  rewriteLoweredIdTokens(label: string): string {
    return label.replace(/OB_([0-9]+)/g, (m, num) => {
      const entry = this.#origins.get(`OB-${num}`);
      return entry ? designToken(entry.design.asString()) : m;
    });
  }

  isTransition(designId: string): boolean {
    return this.#machinesByTransition.has(designId);
  }

  machineOfTransition(designId: string): DesignMachine | null {
    return this.#machinesByTransition.get(designId) ?? null;
  }

  attrPathOfMachine(machineId: string): string | null {
    return this.#attrPathsByMachine.get(machineId) ?? null;
  }

  // refinement 追加パス用：lowered id を素通し帰属として索引に足した新索引。
  withPassthrough(loweredId: string, designId: string): LoweringIndex {
    const origins = new Map(this.#origins);
    origins.set(loweredId, { design: LoweredOriginRef.reconstitute(designId), kind: "passthrough" });
    return new LoweringIndex({
      origins,
      scenarioDesignIds: this.#scenarioDesignIds,
      machinesByTransition: this.#machinesByTransition,
      attrPathsByMachine: this.#attrPathsByMachine,
    });
  }

  // 境界（テスト）専用のエスケープハッチ：帰属表の全エントリ。
  toOriginEntries(): readonly (readonly [string, LoweredOrigin])[] {
    return [...this.#origins.entries()];
  }
}
