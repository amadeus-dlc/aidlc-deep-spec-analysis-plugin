import type { SiblingVerdictFindings } from "./sibling-verdict-findings.ts";
import type { SiblingVerdictSkips } from "./sibling-verdict-skips.ts";
import { VerificationMethod } from "../../kernel/domain/index.ts";

// v1 兄弟バックエンドの findings 文書の型付き判定面——読めなかった
// （unreadable）、バックエンドが不能を申告した（unavailable）、読めた
// （readable：method・findings・skipped）。読み手は `match` で解釈へ命じる
// ——kind を読んで分岐する代わりに（#71 波23）。
export class SiblingVerdictDocument {
  readonly #kind: "unreadable" | "unavailable" | "readable";
  readonly #reason: string | null;
  readonly #method: VerificationMethod | null;
  readonly #findings: SiblingVerdictFindings | null;
  readonly #skipped: SiblingVerdictSkips | null;

  private constructor(props: {
    kind: "unreadable" | "unavailable" | "readable";
    reason: string | null;
    method: string | null;
    findings: SiblingVerdictFindings | null;
    skipped: SiblingVerdictSkips | null;
  }) {
    this.#kind = props.kind;
    this.#reason = props.reason;
    this.#method = props.method === null ? null : VerificationMethod.reconstitute(props.method);
    this.#findings = props.findings;
    this.#skipped = props.skipped;
  }

  static unreadable(): SiblingVerdictDocument {
    return new SiblingVerdictDocument({ kind: "unreadable", reason: null, method: null, findings: null, skipped: null });
  }

  static unavailable(reason: string, method: string | null): SiblingVerdictDocument {
    return new SiblingVerdictDocument({ kind: "unavailable", reason, method, findings: null, skipped: null });
  }

  static readable(method: string | null, findings: SiblingVerdictFindings, skipped: SiblingVerdictSkips): SiblingVerdictDocument {
    return new SiblingVerdictDocument({ kind: "readable", reason: null, method, findings, skipped });
  }

  // バックエンドが申告した不能理由。不能申告でなければ null。
  unavailableReason(): string | null {
    return this.#kind === "unavailable" ? this.#reason : null;
  }

  match<T>(handlers: {
    unreadable: () => T;
    unavailable: (reason: string, method: string | null) => T;
    readable: (method: string | null, findings: SiblingVerdictFindings, skipped: SiblingVerdictSkips) => T;
  }): T {
    if (this.#kind === "unreadable") return handlers.unreadable();
    if (this.#kind === "unavailable") return handlers.unavailable(this.#reason ?? "", this.#method?.asString() ?? null);
    if (this.#findings === null || this.#skipped === null) throw new Error("defect: a readable sibling document carries no verdicts");
    return handlers.readable(this.#method?.asString() ?? null, this.#findings, this.#skipped);
  }
}
