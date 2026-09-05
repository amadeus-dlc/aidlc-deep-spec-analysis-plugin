import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec/kernel-infrastructure";

export class InstallationSource {
  readonly #value: "local" | "ref" | "tag" | "latest";
  private constructor(value: string) {
    if (value.length > 6)
      throw new IllegalArgumentException({ kind: "invalid-installation-source-size", raw: value.length });
    if (value !== "local" && value !== "ref" && value !== "tag" && value !== "latest")
      throw new IllegalArgumentException({ kind: "invalid-installation-source", raw: value });
    this.#value = value;
  }
  static of(value: string): InstallationSource {
    return new InstallationSource(value);
  }
  static parse(value: string): Result<InstallationSource, ParseError> {
    return parseConstruction(() => new InstallationSource(value));
  }
  asString(): string {
    return this.#value;
  }
}
