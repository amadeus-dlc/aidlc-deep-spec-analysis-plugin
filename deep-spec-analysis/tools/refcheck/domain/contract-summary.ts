// contract-summary.md と units エッジブロックの型付き入力モデル（domain 語彙）。
// 解析（markdown テーブル/fence/YAML 歩き）はアダプタのパーサが行う。
// フィールドはドメインプリミティブ、集まりはファーストクラスコレクション。

import { type Result, err, ok } from "../../kernel/infrastructure/index.ts";
import type { BlockIndex, LineNumber } from "./location-values.ts";
import { UnitNames } from "./unit-name.ts";
import type { UnitName } from "./unit-name.ts";

export interface UnitDecl {
  readonly name: UnitName;
  readonly dependsOn: UnitNames;
}

// units エッジブロックの宣言面——CD-1 の照合と CD-3 の走査順を知識に持つ。
export class UnitDecls {
  readonly #values: readonly UnitDecl[];

  private constructor(values: readonly UnitDecl[]) {
    this.#values = values;
  }

  static of(values: readonly UnitDecl[]): UnitDecls {
    return new UnitDecls([...values]);
  }

  add(value: UnitDecl): UnitDecls {
    return new UnitDecls([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<UnitDecl> {
    yield* this.#values;
  }

  declares(value: string): boolean {
    return this.#values.some((u) => u.name.value() === value);
  }

  names(): UnitNames {
    return UnitNames.of(this.#values.map((u) => u.name));
  }

  // CD-3 の走査順（unit 名の辞書順）はコレクション知識。
  sortedByName(): UnitDecls {
    return new UnitDecls([...this.#values].sort((a, b) => (a.name.value() < b.name.value() ? -1 : 1)));
  }

  toArray(): readonly UnitDecl[] {
    return this.#values;
  }
}

// units エッジブロックの取得結果。absent は record に依存成果物が無い場合。
export type DeclaredUnitsOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "unrecognized"; readonly error?: string }
  | { readonly kind: "declared"; readonly units: UnitDecls };

export type ContractCellError = { readonly kind: "empty-contract-id"; readonly raw: string };

// contracts テーブルの ID 列の値。
export class ContractId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<ContractId, ContractCellError> {
    if (raw === "") return err({ kind: "empty-contract-id", raw });
    return ok(new ContractId(raw));
  }

  static reconstitute(raw: string): ContractId {
    return new ContractId(raw);
  }

  equals(other: ContractId): boolean {
    return this.#value === other.#value;
  }

  value(): string {
    return this.#value;
  }
}

// contracts テーブルの Provider / Consumer / Owner セルの値。空欄・
// `External: …` 宣言の判別はセル自身の知識（CD-1 の凍結挙動）。
export class ContractParty {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static reconstitute(raw: string): ContractParty {
    return new ContractParty(raw);
  }

  equals(other: ContractParty): boolean {
    return this.#value === other.#value;
  }

  value(): string {
    return this.#value;
  }

  isBlank(): boolean {
    return this.#value === "";
  }

  declaresExternal(): boolean {
    return /^external\b/i.test(this.#value);
  }
}

export interface ContractRow {
  readonly id: ContractId;
  readonly provider: ContractParty;
  readonly consumer: ContractParty;
  readonly owner: ContractParty;
  readonly line: LineNumber;
}

export class ContractRows {
  readonly #values: readonly ContractRow[];

  private constructor(values: readonly ContractRow[]) {
    this.#values = values;
  }

  static of(values: readonly ContractRow[]): ContractRows {
    return new ContractRows([...values]);
  }

  add(value: ContractRow): ContractRows {
    return new ContractRows([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<ContractRow> {
    yield* this.#values;
  }

  // CD-3：行が両方向で覆う (provider, consumer) 対の集合知識。
  coversEdge(from: string, to: string): boolean {
    return this.#values.some(
      (r) =>
        (r.provider.value() === from && r.consumer.value() === to) ||
        (r.consumer.value() === from && r.provider.value() === to),
    );
  }

  toArray(): readonly ContractRow[] {
    return this.#values;
  }
}

// contracts テーブルの取得結果（Provider 列を持つテーブルが無ければ absent）。
export type ContractsTableOutcome =
  | { readonly kind: "absent" }
  | { readonly kind: "rows"; readonly rows: ContractRows };

// 各 yaml spec ブロックの検査済み状態（CD-2 の判定材料）。issue の分岐は
// 材料のみの閉じたユニオン。
export interface SpecBlockAssessment {
  readonly index: BlockIndex; // 1-based
  readonly line: LineNumber;
  readonly issue:
    | { readonly kind: "unparseable"; readonly error: string }
    | { readonly kind: "not-a-mapping" }
    | { readonly kind: "openapi-without-paths" }
    | null;
}

export class SpecBlockAssessments {
  readonly #values: readonly SpecBlockAssessment[];

  private constructor(values: readonly SpecBlockAssessment[]) {
    this.#values = values;
  }

  static of(values: readonly SpecBlockAssessment[]): SpecBlockAssessments {
    return new SpecBlockAssessments([...values]);
  }

  add(value: SpecBlockAssessment): SpecBlockAssessments {
    return new SpecBlockAssessments([...this.#values, value]);
  }

  *[Symbol.iterator](): Iterator<SpecBlockAssessment> {
    yield* this.#values;
  }

  toArray(): readonly SpecBlockAssessment[] {
    return this.#values;
  }
}
