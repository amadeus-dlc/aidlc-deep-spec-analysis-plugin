import {
  AttributePath,
  type DeclaredBindings,
  ErrorMessage,
  ErrorMessages,
  type Expression,
  ExpressionTree,
  type FirstClassCollection,
  FirstClassCollectionBase,
  KeyedIndex,
} from "@deep-spec-analysis/kernel-domain";
import {
  boundedCollectionSnapshot,
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import type { IntermediateRepresentationAttributeDeclaration } from "./intermediate-representation-attribute-declaration.ts";
import { IntermediateRepresentationAttributeEntry } from "./intermediate-representation-attribute-entry.ts";
import type { IntermediateRepresentationEntityDeclarations } from "./intermediate-representation-entity-declarations.ts";

export class IntermediateRepresentationAttributeCatalog
  extends FirstClassCollectionBase<IntermediateRepresentationAttributeEntry, IntermediateRepresentationAttributeCatalog>
  implements FirstClassCollection<IntermediateRepresentationAttributeEntry>
{
  readonly #declarations: IntermediateRepresentationEntityDeclarations;
  readonly #entries: readonly IntermediateRepresentationAttributeEntry[];
  readonly #byPath: KeyedIndex<AttributePath, IntermediateRepresentationAttributeDeclaration>;
  private constructor(
    declarations: IntermediateRepresentationEntityDeclarations,
    entries?: readonly IntermediateRepresentationAttributeEntry[],
  ) {
    super();
    this.#declarations = declarations;
    const derived: IntermediateRepresentationAttributeEntry[] = [];
    if (entries === undefined) {
      let count = 0;
      for (const entity of declarations) {
        if (++count > 65_536) throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
        entity.inspectAttributes((_path, attribute) => {
          if (++count > 65_536) throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
          derived.push(IntermediateRepresentationAttributeEntry.of(entity.name(), attribute));
        });
      }
      if (declarations.hasAmbiguousAttributes())
        throw new IllegalArgumentException({ kind: "ambiguous-requirement-attributes" });
    }
    this.#entries = boundedCollectionSnapshot(entries ?? derived, 65_536, "attribute-catalog-too-large");
    this.#byPath = KeyedIndex.of(this.#entries.map((entry) => [entry.path(), entry.attribute()] as const));
  }

  protected override rebuild(
    values: readonly IntermediateRepresentationAttributeEntry[],
  ): IntermediateRepresentationAttributeCatalog {
    return new IntermediateRepresentationAttributeCatalog(this.#declarations, values);
  }

  override *[Symbol.iterator](): Iterator<IntermediateRepresentationAttributeEntry> {
    yield* this.#entries;
  }

  toArray(): readonly IntermediateRepresentationAttributeEntry[] {
    return this.#entries;
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
}
