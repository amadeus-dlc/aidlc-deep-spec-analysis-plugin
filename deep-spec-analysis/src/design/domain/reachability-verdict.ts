// 到達性の判定。非到達は検査した範囲内の結論で、未検証とは別の値である。
// null / undefined に判定を割り当てず、消費側には三つの分岐を要求する。
type ReachabilityKind = "reached" | "not-reached-within-bound" | "unverified";

export class ReachabilityVerdict {
  readonly #kind: ReachabilityKind;

  private constructor(kind: ReachabilityKind) {
    this.#kind = kind;
  }

  static reached(): ReachabilityVerdict {
    return new ReachabilityVerdict("reached");
  }

  static notReachedWithinBound(): ReachabilityVerdict {
    return new ReachabilityVerdict("not-reached-within-bound");
  }

  static unverified(): ReachabilityVerdict {
    return new ReachabilityVerdict("unverified");
  }

  equals(other: ReachabilityVerdict): boolean {
    return this.#kind === other.#kind;
  }

  match<T>(handlers: { reached: () => T; notReachedWithinBound: () => T; unverified: () => T }): T {
    switch (this.#kind) {
      case "reached":
        return handlers.reached();
      case "not-reached-within-bound":
        return handlers.notReachedWithinBound();
      case "unverified":
        return handlers.unverified();
    }
  }
}
