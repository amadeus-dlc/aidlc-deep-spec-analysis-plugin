import type { DomainEntitySketches } from "./domain-entity-sketches.ts";

// domain-design の components.md から読む実体スケッチ——文書が無い（absent）、
// yaml が使えない（unusable：理由つき）、抽出できた（extracted）。XS 検査は
// `match` で解釈へ命じる（#71 波26）。
export class DomainEntitiesOutcome {
  readonly #kind: "absent" | "unusable" | "extracted";
  readonly #error: string | null;
  readonly #entities: DomainEntitySketches | null;

  private constructor(kind: "absent" | "unusable" | "extracted", error: string | null, entities: DomainEntitySketches | null) {
    this.#kind = kind;
    this.#error = error;
    this.#entities = entities;
  }

  static absent(): DomainEntitiesOutcome {
    return new DomainEntitiesOutcome("absent", null, null);
  }

  static unusable(error: string): DomainEntitiesOutcome {
    return new DomainEntitiesOutcome("unusable", error, null);
  }

  static extracted(entities: DomainEntitySketches): DomainEntitiesOutcome {
    return new DomainEntitiesOutcome("extracted", null, entities);
  }

  // 抽出できたか——リポジトリは兄弟ユニットをこのときだけ読む。
  isExtracted(): boolean {
    return this.#kind === "extracted";
  }

  match<T>(handlers: { absent: () => T; unusable: (error: string) => T; extracted: (entities: DomainEntitySketches) => T }): T {
    if (this.#kind === "absent") return handlers.absent();
    if (this.#kind === "unusable" || this.#entities === null) return handlers.unusable(this.#error ?? "");
    return handlers.extracted(this.#entities);
  }
}
