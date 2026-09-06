import type { FirstClassCollection } from "@deep-spec-analysis/kernel-domain";
import {
  AttributePath,
  type DeclaredBindings,
  ErrorMessage,
  ErrorMessages,
  type Expression,
  ExpressionTree,
  KeyedIndex,
} from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";
import type { IntermediateRepresentationEntityDeclarations } from "./intermediate-representation-entity-declarations.ts";

export class IntermediateRepresentationAttributeCatalog implements FirstClassCollection {
  readonly #byPath: KeyedIndex<AttributePath, IntermediateRepresentationAttributeDeclaration>;
  private constructor(declarations: IntermediateRepresentationEntityDeclarations) {
    let count = 0;
    for (const entity of declarations) {
      if (++count > 65_536) throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      entity.inspectAttributes(() => {
        if (++count > 65_536) throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      });
    }
    if (declarations.hasAmbiguousAttributes())
      throw new IllegalArgumentException({ kind: "ambiguous-requirement-attributes" });

    const attributes = new Map<string, IntermediateRepresentationAttributeDeclaration>();
    for (const entity of declarations)
      entity.inspectAttributes((path, attribute) => {
        attributes.set(path, attribute);
      });
    this.#byPath = KeyedIndex.of(
      [...attributes].map(([path, attribute]) => [AttributePath.of(path), attribute] as const),
    );
  }
  #attributeAt(path: string): IntermediateRepresentationAttributeDeclaration | undefined {
    const parsed = AttributePath.parse(path);
    return parsed.ok ? this.#byPath.get(parsed.value) : undefined;
  }

  static of(declarations: IntermediateRepresentationEntityDeclarations): IntermediateRepresentationAttributeCatalog {
    return new IntermediateRepresentationAttributeCatalog(declarations);
  }
  static parse(
    declarations: IntermediateRepresentationEntityDeclarations,
  ): Result<IntermediateRepresentationAttributeCatalog, ParseError> {
    return parseConstruction(() => new IntermediateRepresentationAttributeCatalog(declarations));
  }

  diagnostics(): ErrorMessages {
    const errors: string[] = [];
    const encoded = new Map<string, string>();
    for (const coordinate of this.#byPath.keys()) {
      const path = coordinate.asString();
      const key = path.replace(/\./g, "_");
      const prior = encoded.get(key);
      if (prior !== undefined) {
        errors.push(
          `schema: attribute paths "${prior}" and "${path}" collide under the solver variable encoding (dots become underscores)`,
        );
      } else {
        encoded.set(key, path);
      }
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  expressionDiagnostics(expression: Expression, where: string, primesAllowed: boolean): ErrorMessages {
    const errors: string[] = [];
    ExpressionTree.of(expression).inspectTerms({
      reference: (path, primed) => {
        if (!(this.#attributeAt(path) !== undefined)) errors.push(`${where}: unresolvable reference "${path}"`);
        if (primed && !primesAllowed)
          errors.push(
            `${where}: primed reference "${path}" is only legal in event effects and event-scenario expectations`,
          );
      },
      enumLiteral: (value) => {
        if (![...this.#byPath.values()].some((attribute) => attribute.admitsEnumLiteral(value)))
          errors.push(`${where}: enum literal "${value}" is not a value of any declared enum attribute`);
      },
    });
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  bindingDiagnostics(bindings: DeclaredBindings, context: string): ErrorMessages {
    const errors: string[] = [];
    for (const binding of bindings) {
      const path = binding.path().asString();
      const attribute = this.#attributeAt(path);
      if (!attribute) errors.push(`${context}: binding for unknown attribute "${path}"`);
      else if (!attribute.fitsBinding(binding.value()))
        errors.push(
          `${context}: binding value ${binding.value().describe()} does not fit ${attribute.kindLabel()} attribute "${path}"`,
        );
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  isEmpty(): boolean {
    return this.#byPath.isEmpty();
  }
}
