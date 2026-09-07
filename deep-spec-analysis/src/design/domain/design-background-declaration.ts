import type { Expression } from "@deep-spec-analysis/kernel-domain";
import { ErrorMessage, ErrorMessages, ExpressionTree } from "@deep-spec-analysis/kernel-domain";
import {
  canonicalStringify,
  combinedHash,
  hashOfNullable,
  hashOfString,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { DesignAttributeCatalog } from "./design-attribute-catalog.ts";
// 設計 IR の背景仮定宣言。抱える式の列挙と prime 禁止（背景仮定は常に
// 無prime）は宣言自身が所有する——波3の義務／シナリオと同じ裁定（#71 波4）。

import type { DesignBackgroundIdentifier } from "./design-background-identifier.ts";
import { sameExpression } from "./value-equality.ts";

// 未検証の構築引数。VO・エンティティ本体とは区別する。
type DesignBackgroundDeclarationParam = { id: DesignBackgroundIdentifier; assert?: Expression };

export class DesignBackgroundDeclaration {
  readonly #id: DesignBackgroundIdentifier;
  readonly #assert: Expression | undefined;

  private constructor(props: DesignBackgroundDeclarationParam) {
    this.#id = props.id;
    this.#assert = props.assert === undefined ? undefined : ExpressionTree.of(props.assert).asExpression();
  }

  static parse(props: DesignBackgroundDeclarationParam): Result<DesignBackgroundDeclaration, ParseError> {
    return parseConstruction(() => new DesignBackgroundDeclaration(props));
  }

  static of(props: DesignBackgroundDeclarationParam): DesignBackgroundDeclaration {
    return new DesignBackgroundDeclaration(props);
  }

  equals(other: DesignBackgroundDeclaration): boolean {
    return this.#id.equals(other.#id) && sameExpression(this.#assert, other.#assert);
  }

  hashCode(): number {
    return combinedHash([
      this.#id.hashCode(),
      hashOfNullable(this.#assert, (expression) => hashOfString(canonicalStringify(expression))),
    ]);
  }

  diagnostics(catalog: DesignAttributeCatalog): ErrorMessages {
    const context = `background ${this.#id.asString()}`;
    const errors: string[] = [];
    if (this.#assert !== undefined)
      catalog.expressionDiagnostics(this.#assert, context, false).foldLeft(errors, (acc, message) => {
        acc.push(message.asString());
        return acc;
      });
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  id(): DesignBackgroundIdentifier {
    return this.#id;
  }
}
