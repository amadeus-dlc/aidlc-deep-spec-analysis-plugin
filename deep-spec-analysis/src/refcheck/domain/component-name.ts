import { IllegalArgumentException, parseConstruction, compareCanonically, type Result } from "@deep-spec/kernel-infrastructure";

export class ComponentName {
  readonly #value: string;
  private constructor(raw: string) {
    if (raw === "") throw new IllegalArgumentException({ kind: "empty-token", raw });
    this.#value = raw;
  }
  static of(raw: string): ComponentName {
    return new ComponentName(raw);
  }

  static parse(raw: string): Result<ComponentName, IllegalArgumentException["problem"]> {
    return parseConstruction(() => new ComponentName(raw));
  }
  equals(other: ComponentName): boolean { return this.#value === other.#value; }
  // 正準順（裁定 1）——kernel の TargetId が所有する順序に従う。
  compareTo(other: ComponentName): number { return compareCanonically(this.#value, other.#value); }
  asString(): string { return this.#value; }
}
