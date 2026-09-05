import { type ArtifactPath, FindingKind, TargetIdentifiers } from "@deep-spec/kernel-domain";
import { CD_1 } from "./contract-check-families.ts";
import type { ContractIdentifier } from "./contract-identifier.ts";
import type { ContractParty } from "./contract-party.ts";
import type { LineNumber } from "./line-number.ts";
import type { ReferenceCheckReport } from "./reference-check-report.ts";
import type { UnitDeclarations } from "./unit-declarations.ts";
import { WitnessReference } from "./witness-reference.ts";

// 契約表の 1 行——契約 id・Provider・Consumer・Owner と行番号。CD-3 は辺の
// 被覆を行に問い、CD-1 は所在ラベル（凍結文言）を行に作らせる（#71 波26）。
// 未検証の構築引数。VO・エンティティ本体とは区別する。
type ContractRowParam = {
  id: ContractIdentifier;
  provider: ContractParty;
  consumer: ContractParty;
  owner: ContractParty;
  line: LineNumber;
};

export class ContractRow {
  readonly #id: ContractIdentifier;
  readonly #provider: ContractParty;
  readonly #consumer: ContractParty;
  readonly #owner: ContractParty;
  readonly #line: LineNumber;

  private constructor(props: ContractRowParam) {
    this.#id = props.id;
    this.#provider = props.provider;
    this.#consumer = props.consumer;
    this.#owner = props.owner;
    this.#line = props.line;
  }

  static of(props: ContractRowParam): ContractRow {
    return new ContractRow(props);
  }

  id(): ContractIdentifier {
    return this.#id;
  }

  // 行が (from, to) の辺をどちらの向きでも結ぶか。
  connects(from: string, to: string): boolean {
    return (
      (this.#provider.asString() === from && this.#consumer.asString() === to) ||
      (this.#consumer.asString() === from && this.#provider.asString() === to)
    );
  }

  // finding の witness に載せる所在（凍結文言）。
  locationLabel(): string {
    return `contracts table row ${this.#id.asString()} (line ${this.#line.asNumber()})`;
  }

  // CD-1 の不変条件（種別規律の裁定 12）: Provider／Consumer／Owner は宣言済み
  // ユニット（Consumer は `External: …` も可）。文言は golden 凍結。
  checkPartiesDeclared(
    declared: UnitDeclarations,
    report: ReferenceCheckReport,
    artifact: ArtifactPath,
    depArtifact: ArtifactPath,
  ): void {
    const art = artifact.asString();
    const depArt = depArtifact.asString();
    const el = this.locationLabel();
    if (!this.#provider.isBlank() && !declared.declares(this.#provider.asString())) {
      report.finding(
        CD_1,
        FindingKind.referenceBroken(),
        [`contract:${this.#id.asString()}`, TargetIdentifiers.safe("unit", this.#provider.asString())],
        [WitnessReference.at(art, el, this.#provider.asString()), WitnessReference.at(depArt, "units")],
        `Provider Unit "${this.#provider.asString()}" is not a declared unit`,
      );
    }
    if (
      !this.#consumer.isBlank() &&
      !declared.declares(this.#consumer.asString()) &&
      !this.#consumer.declaresExternal()
    ) {
      report.finding(
        CD_1,
        FindingKind.referenceBroken(),
        [`contract:${this.#id.asString()}`, TargetIdentifiers.safe("unit", this.#consumer.asString())],
        [WitnessReference.at(art, el, this.#consumer.asString()), WitnessReference.at(depArt, "units")],
        `Consumer "${this.#consumer.asString()}" is neither a declared unit nor \`External: …\``,
      );
    }
    if (!this.#owner.isBlank() && !declared.declares(this.#owner.asString())) {
      report.finding(
        CD_1,
        FindingKind.referenceBroken(),
        [`contract:${this.#id.asString()}`, TargetIdentifiers.safe("unit", this.#owner.asString())],
        [WitnessReference.at(art, el, this.#owner.asString()), WitnessReference.at(depArt, "units")],
        `Owner "${this.#owner.asString()}" is not a declared unit`,
      );
    }
  }
}
