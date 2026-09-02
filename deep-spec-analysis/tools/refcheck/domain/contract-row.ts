import type { ContractId } from "./contract-id.ts";
import type { ContractParty } from "./contract-party.ts";
import type { LineNumber } from "./line-number.ts";

// 契約表の 1 行——契約 id・Provider・Consumer・Owner と行番号。CD-3 は辺の
// 被覆を行に問い、CD-1 は所在ラベル（凍結文言）を行に作らせる（#71 波26）。
export class ContractRow {
  readonly #id: ContractId;
  readonly #provider: ContractParty;
  readonly #consumer: ContractParty;
  readonly #owner: ContractParty;
  readonly #line: LineNumber;

  private constructor(props: { id: ContractId; provider: ContractParty; consumer: ContractParty; owner: ContractParty; line: LineNumber }) {
    this.#id = props.id;
    this.#provider = props.provider;
    this.#consumer = props.consumer;
    this.#owner = props.owner;
    this.#line = props.line;
  }

  static reconstitute(props: { id: ContractId; provider: ContractParty; consumer: ContractParty; owner: ContractParty; line: LineNumber }): ContractRow {
    return new ContractRow(props);
  }

  id(): ContractId {
    return this.#id;
  }

  provider(): ContractParty {
    return this.#provider;
  }

  consumer(): ContractParty {
    return this.#consumer;
  }

  owner(): ContractParty {
    return this.#owner;
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
}
