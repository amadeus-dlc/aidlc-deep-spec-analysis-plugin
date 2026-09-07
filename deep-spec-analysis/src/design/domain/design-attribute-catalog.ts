import {
  AttributePath,
  type DeclaredBindings,
  type EnumerationMembers,
  ErrorMessage,
  ErrorMessages,
  type Expression,
  ExpressionTree,
  FirstClassCollectionBase,
  KeyedIndex,
} from "@deep-spec-analysis/kernel-domain";
import {
  IllegalArgumentException,
  type ParseError,
  parseConstruction,
  type Result,
} from "@deep-spec-analysis/kernel-infrastructure";
import { AttributePaths } from "./attribute-paths.ts";
import { DesignAttributeCatalogEntry } from "./design-attribute-catalog-entry.ts";
import type { DesignAttributeDeclaration } from "./design-attribute-declaration.ts";
import { DesignAttributeDeclarations } from "./design-attribute-declarations.ts";
import { DesignEntityDeclaration } from "./design-entity-declaration.ts";
import { DesignEntityDeclarations } from "./design-entity-declarations.ts";

export class DesignAttributeCatalog extends FirstClassCollectionBase<
  DesignAttributeCatalogEntry,
  DesignAttributeCatalog
> {
  readonly #declarations: DesignEntityDeclarations;
  readonly #byPath: KeyedIndex<AttributePath, DesignAttributeDeclaration>;
  readonly #entries: readonly DesignAttributeCatalogEntry[];

  private constructor(declarations: DesignEntityDeclarations) {
    super();
    let count = 0;
    for (const entity of declarations) {
      if (++count > 65_536) throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      entity.inspectAttributes(() => {
        if (++count > 65_536) throw new IllegalArgumentException({ kind: "attribute-catalog-too-large", raw: count });
      });
    }

    if (declarations.hasAmbiguousAttributes())
      throw new IllegalArgumentException({ kind: "ambiguous-design-attributes" });
    const attributes = new Map<string, DesignAttributeDeclaration>();
    const entries: DesignAttributeCatalogEntry[] = [];
    for (const entity of declarations)
      entity.inspectAttributes((path, attribute) => {
        attributes.set(path, attribute);
        entries.push(DesignAttributeCatalogEntry.of(entity.name(), attribute));
      });
    this.#declarations = declarations;
    this.#entries = Object.freeze(entries);
    this.#byPath = KeyedIndex.of(
      [...attributes].map(([path, attribute]) => [AttributePath.of(path), attribute] as const),
    );
  }

  protected override rebuild(values: readonly DesignAttributeCatalogEntry[]): DesignAttributeCatalog {
    const selectedByOwner = new Map<string, Set<DesignAttributeDeclaration>>();
    for (const entry of values) {
      const selected = selectedByOwner.get(entry.owner().asString()) ?? new Set<DesignAttributeDeclaration>();
      selected.add(entry.attribute());
      selectedByOwner.set(entry.owner().asString(), selected);
    }
    const declarations = [...this.#declarations].map((entity) =>
      DesignEntityDeclaration.of({
        name: entity.name(),
        ...(entity.description() !== undefined ? { description: entity.description() } : {}),
        attributes: DesignAttributeDeclarations.of(
          [...entity.attributes()].filter((attribute) => selectedByOwner.get(entity.name().asString())?.has(attribute)),
        ),
      }),
    );
    return new DesignAttributeCatalog(DesignEntityDeclarations.of(declarations));
  }

  override *[Symbol.iterator](): Iterator<DesignAttributeCatalogEntry> {
    yield* this.#entries;
  }

  #attributeAt(path: string): DesignAttributeDeclaration | undefined {
    const parsed = AttributePath.parse(path);
    return parsed.ok ? this.#byPath.get(parsed.value) : undefined;
  }

  static of(declarations: DesignEntityDeclarations): DesignAttributeCatalog {
    return new DesignAttributeCatalog(declarations);
  }
  static parse(declarations: DesignEntityDeclarations): Result<DesignAttributeCatalog, ParseError> {
    return parseConstruction(() => new DesignAttributeCatalog(declarations));
  }

  declarations(): DesignEntityDeclarations {
    return this.#declarations;
  }
  paths(): AttributePaths {
    return AttributePaths.of([...this.#byPath.keys()]);
  }
  enumValuesAt(path: string): EnumerationMembers | null {
    return this.#attributeAt(path)?.enumStates() ?? null;
  }
  declares(path: string): boolean {
    return this.#attributeAt(path) !== undefined;
  }

  encodingDiagnostics(): ErrorMessages {
    const errors: string[] = [];
    const encoded = new Map<string, string>();
    for (const coordinate of this.#byPath.keys()) {
      const path = coordinate.asString();
      const key = path.replace(/\./g, "_");
      const prior = encoded.get(key);
      if (prior !== undefined) {
        errors.push(
          `attribute paths "${prior}" and "${path}" collide under the solver variable encoding (dots become underscores)`,
        );
      } else {
        encoded.set(key, path);
      }
    }
    return ErrorMessages.collect(errors.map(ErrorMessage.parse));
  }

  expressionDiagnostics(e: Expression, ctx: string, primesAllowed: boolean): ErrorMessages {
    const errors: string[] = [];
    ExpressionTree.of(e).inspectTerms({
      reference: (path, primed) => {
        if (!(this.#attributeAt(path) !== undefined)) errors.push(`${ctx}: unresolvable reference "${path}"`);
        if (primed && !primesAllowed)
          errors.push(`${ctx}: primed reference "${path}" is only legal in effects and event-scenario expectations`);
      },
      enumLiteral: (value, sibling) => {
        const attribute = sibling === undefined ? undefined : this.#attributeAt(sibling);
        if (attribute !== undefined) {
          if (!attribute.isEnum())
            errors.push(`${ctx}: enum literal "${value}" is compared against non-enum attribute "${sibling}"`);
          else if (!attribute.admitsEnumLiteral(value))
            errors.push(`${ctx}: enum literal "${value}" is not a value of "${sibling}"`);
        } else if (
          sibling === undefined &&
          ![...this.#byPath.values()].some((attribute) => attribute.admitsEnumLiteral(value))
        ) {
          errors.push(`${ctx}: enum literal "${value}" is not a value of any declared enum attribute`);
        }
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
