import { ContractId } from "./contract-id.ts";
import { ContractParty } from "./contract-party.ts";
import { type LineNumber } from "./line-number.ts";

export interface ContractRow {
  readonly id: ContractId;
  readonly provider: ContractParty;
  readonly consumer: ContractParty;
  readonly owner: ContractParty;
  readonly line: LineNumber;
}
