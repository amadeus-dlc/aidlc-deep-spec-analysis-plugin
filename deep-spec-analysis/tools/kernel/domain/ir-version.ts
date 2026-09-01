// IrVersion — 契約 IR の semver（major.minor.patch）。parse が strict な
// 構築口で、invariant は両モデルパーサが課してきた凍結パターン
// /^\d+\.\d+\.\d+$/ の逐語——先行ゼロ（01.2.3）を許すのは厳密 SemVer との
// 意図的な差で、これを締めると旧実装が受理した IR を corrupt に落とす
// 観測面の変更になる（厳密化は PR10 の凍結解除と同時）。reconstitute は
// 凍結文書からの逐語再水和専用。major 抽出とサポート判定はバージョン語彙
// そのものなので DP が持つ。

import { type Result, err, ok } from "../infrastructure/index.ts";

type IrVersionError = { readonly kind: "not-a-semver"; readonly raw: string };

export class IrVersion {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  static parse(raw: string): Result<IrVersion, IrVersionError> {
    if (!/^\d+\.\d+\.\d+$/.test(raw)) return err({ kind: "not-a-semver", raw });
    return ok(new IrVersion(raw));
  }

  // 凍結文書の逐語再水和専用（"" を含む不正値も文書の bytes として保存）。
  static reconstitute(raw: string): IrVersion {
    return new IrVersion(raw);
  }

  equals(other: IrVersion): boolean {
    return this.#value === other.#value;
  }

  // 境界: 旧実装の major 抽出と同じ計算（verdict 文言に載る）。
  majorVersion(): number {
    return Number.parseInt(this.#value.split(".")[0] ?? "", 10);
  }

  supportsMajor(major: number): boolean {
    return this.majorVersion() === major;
  }

  // 境界: 文書・文言へ逐語で載る値。
  asString(): string {
    return this.#value;
  }
}
