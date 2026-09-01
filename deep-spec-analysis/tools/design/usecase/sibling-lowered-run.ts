import type { SiblingVerdictDocument } from "../domain/index.ts";

export interface SiblingLoweredRun {
  exit: number | null;
  doc: SiblingVerdictDocument | null;
  note: string;
}
