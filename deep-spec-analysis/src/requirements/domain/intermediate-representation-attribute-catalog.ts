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
  readonly #entries: readonly IntermediateRepresentationAttributeEntry[];
  readonly #byPath: KeyedIndex<AttributePath, IntermediateRepresentationAttributeDeclaration>;
  private constructor(entries: Iterable<IntermediateRepresentationAttributeEntry>) {
    super();
    const snapshot: IntermediateRepresentationAttributeEntry[] = [];
    const paths = new Set<string>();
    for (const entry of entries) {
      if (snapshot.length >= 65_536)
        throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: snapshot.length + 1 });
      const path = entry.path().asString();
      if (paths.has(path)) throw new IllegalArgumentException({ kind: "ambiguous-requirement-attributes", raw: path });
      paths.add(path);
      snapshot.push(entry);
    }
    this.#entries = Object.freeze(snapshot);
    this.#byPath = KeyedIndex.of(this.#entries.map((entry) => [entry.path(), entry.attribute()] as const));
  }

  protected override rebuild(
    values: readonly IntermediateRepresentationAttributeEntry[],
  ): IntermediateRepresentationAttributeCatalog {
    return new IntermediateRepresentationAttributeCatalog(values);
  }

  override map(
    transform: (element: IntermediateRepresentationAttributeEntry) => IntermediateRepresentationAttributeEntry,
  ): IntermediateRepresentationAttributeCatalog {
    return this.mapTo(transform, (values) => this.rebuild(values));
  }

  override combine(other: IntermediateRepresentationAttributeCatalog): IntermediateRepresentationAttributeCatalog {
    return this.combineTo(other, (values) => this.rebuild(values));
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
    return new IntermediateRepresentationAttributeCatalog(
      IntermediateRepresentationAttributeCatalog.entriesOf(declarations),
    );
  }
  static parse(
    declarations: IntermediateRepresentationEntityDeclarations,
  ): Result<IntermediateRepresentationAttributeCatalog, ParseError> {
    return parseConstruction(
      () =>
        new IntermediateRepresentationAttributeCatalog(
          IntermediateRepresentationAttributeCatalog.entriesOf(declarations),
        ),
    );
  }

  private static *entriesOf(
    declarations: IntermediateRepresentationEntityDeclarations,
  ): Iterable<IntermediateRepresentationAttributeEntry> {
    let count = 0;
    for (const entity of declarations) {
      if (++count > 65_536) throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      entity.inspectAttributes((_path, _attribute) => {
        if (++count > 65_536) throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      });
    }
    if (declarations.hasAmbiguousAttributes())
      throw new IllegalArgumentException({ kind: "ambiguous-requirement-attributes" });
    const entries: IntermediateRepresentationAttributeEntry[] = [];
    for (const entity of declarations)
      entity.inspectAttributes((_path, attribute) => {
        entries.push(IntermediateRepresentationAttributeEntry.of(entity.name(), attribute));
      });
    yield* entries;
  }

  diagnostics(): ErrorMessages {
    return ErrorMessages.collect(this.diagnosticStrings().map(ErrorMessage.parse));
  }

  // 境界: 診断の表現予算は呼び手の ErrorMessages.collect が守るので、
  // ここは文字列のまま返す。
  diagnosticStrings(): string[] {
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
    return errors;
  }

  expressionDiagnostics(expression: Expression, where: string, primesAllowed: boolean): ErrorMessages {
    return ErrorMessages.collect(
      this.expressionDiagnosticStrings(expression, where, primesAllowed).map(ErrorMessage.parse),
    );
  }

  // 境界: 診断の表現予算は呼び手の ErrorMessages.collect が守るので、
  // ここは文字列のまま返す。
  expressionDiagnosticStrings(expression: Expression, where: string, primesAllowed: boolean): string[] {
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
    return errors;
  }

  bindingDiagnostics(bindings: DeclaredBindings, context: string): ErrorMessages {
    return ErrorMessages.collect(this.bindingDiagnosticStrings(bindings, context).map(ErrorMessage.parse));
  }

  // 境界: 診断の表現予算は呼び手の ErrorMessages.collect が守るので、
  // ここは文字列のまま返す。
  bindingDiagnosticStrings(bindings: DeclaredBindings, context: string): string[] {
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
    return errors;
  }
}
