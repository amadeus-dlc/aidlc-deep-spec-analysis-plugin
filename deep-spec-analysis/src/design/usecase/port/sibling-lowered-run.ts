import type { SiblingVerdictDocument } from "@deep-spec/design-domain";

export interface SiblingLoweredRun {
  exit: number | null;
  doc: SiblingVerdictDocument | null;
  note: string;
}
