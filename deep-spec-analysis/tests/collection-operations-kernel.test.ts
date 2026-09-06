import { describe, expect, test } from "bun:test";
import {
  AttributePath,
  BackendName,
  BindingDeclaration,
  BindingValue,
  ContentHash,
  Declaration,
  DeclaredBindings,
  DeclaredBindingValue,
  EnumerationMember,
  EnumerationMembers,
  ErrorMessage,
  ErrorMessages,
  ExpressionTree,
  FindingTargets,
  FirstClassCollectionBase,
  FunctionalRequirementReferences,
  ImmutableFirstClassCollection,
  RequirementIdentifier,
  RequirementIdentifiers,
  ScenarioBinding,
  ScenarioBindings,
  ScenarioVerdict,
  ScenarioVerdicts,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";
import { IllegalArgumentException } from "@deep-spec-analysis/kernel-infrastructure";

class NumberValue {
  readonly #value: number;

  private constructor(value: number) {
    this.#value = value;
  }

  static of(value: number): NumberValue {
    return new NumberValue(value);
  }

  asNumber(): number {
    return this.#value;
  }

  equals(other: NumberValue): boolean {
    return this.#value === other.#value;
  }
}

const number = (value: number): NumberValue => NumberValue.of(value);

class ProbeCollection extends FirstClassCollectionBase<NumberValue, ImmutableFirstClassCollection<NumberValue>> {
  readonly #iteratorFactory: () => IterableIterator<NumberValue>;

  constructor(iteratorFactory: () => IterableIterator<NumberValue>) {
    super();
    this.#iteratorFactory = iteratorFactory;
  }

  [Symbol.iterator](): Iterator<NumberValue> {
    return this.#iteratorFactory();
  }

  protected rebuild(values: readonly NumberValue[]): ImmutableFirstClassCollection<NumberValue> {
    return ImmutableFirstClassCollection.of(values);
  }
}

describe("kernel first-class collection operations", () => {
  test("ImmutableFirstClassCollection keeps order and exposes all operations", () => {
    const source = [number(1), number(2), number(3)];
    const values = ImmutableFirstClassCollection.of(source);
    source[0] = number(99);

    expect([...values].map((value) => value.asNumber())).toEqual([1, 2, 3]);
    expect(values.at(1).asNumber()).toBe(2);
    expect(values.head().asNumber()).toBe(1);
    expect([...values.tail()].map((value) => value.asNumber())).toEqual([2, 3]);
    expect(values.include(number(2))).toBe(true);
    expect(values.include(number(9))).toBe(false);
    expect(values.exists((value) => value.asNumber() === 3)).toBe(true);
    expect(values.exists((value) => value.asNumber() === 9)).toBe(false);
    expect([...values.filter((value) => value.asNumber() !== 2)].map((value) => value.asNumber())).toEqual([1, 3]);

    const mapped = values.map((value) => number(value.asNumber() * 10));
    expect(mapped).toBeInstanceOf(ImmutableFirstClassCollection);
    expect([...mapped].map((value) => value.asNumber())).toEqual([10, 20, 30]);
    expect([...values].map((value) => value.asNumber())).toEqual([1, 2, 3]);
  });

  test("invalid positions and empty head/tail are rejected at the public seam", () => {
    const empty = ImmutableFirstClassCollection.of<NumberValue>([]);
    expect(empty.isEmpty()).toBe(true);
    expect(empty.include(number(1))).toBe(false);
    expect(empty.exists(() => true)).toBe(false);
    expect(() => empty.head()).toThrow(IllegalArgumentException);
    expect(() => empty.tail()).toThrow(IllegalArgumentException);
    expect(() => empty.at(-1)).toThrow(IllegalArgumentException);
    expect(() => empty.at(0)).toThrow(IllegalArgumentException);
    expect(() => empty.at(65_536)).toThrow(IllegalArgumentException);
    expect(() => ImmutableFirstClassCollection.of([number(1)]).at(1.5)).toThrow(IllegalArgumentException);
    expect(() => ImmutableFirstClassCollection.of([number(1)]).at(1)).toThrow(IllegalArgumentException);
  });

  test("filter can become empty while map changes element type", () => {
    const values = ImmutableFirstClassCollection.of([number(1), number(2)]);
    const filtered = values.filter((value) => value.asNumber() > 10);
    expect(filtered.isEmpty()).toBe(true);
    expect([...filtered]).toEqual([]);

    const mapped = values.map((value) => ErrorMessage.of(`value:${value.asNumber()}`));
    expect([...mapped].map((value) => value.asString())).toEqual(["value:1", "value:2"]);
  });

  test("callbacks receive only the element and mapper failures escape", () => {
    const values = ImmutableFirstClassCollection.of([number(1), number(2)]);
    const argumentCounts: number[] = [];

    values.exists((...args: NumberValue[]) => {
      argumentCounts.push(args.length);
      return true;
    });
    values.filter((...args: NumberValue[]) => {
      argumentCounts.push(args.length);
      return true;
    });
    values.map((...args: NumberValue[]) => {
      argumentCounts.push(args.length);
      return number(args[0]?.asNumber() ?? 0);
    });

    expect(argumentCounts).toEqual([1, 1, 1, 1, 1]);
    const mapperFailure = new Error("mapper failure");
    expect(() =>
      values.map(() => {
        throw mapperFailure;
      }),
    ).toThrow(mapperFailure);
  });

  test("head, at, and exists close the iterator after short-circuiting", () => {
    const observedReads: number[] = [];
    const observedCloses: number[] = [];
    const queries: readonly ((collection: ProbeCollection) => void)[] = [
      (collection) => void collection.head(),
      (collection) => void collection.at(1),
      (collection) => void collection.exists(() => true),
    ];

    for (const query of queries) {
      let reads = 0;
      let closes = 0;
      const collection = new ProbeCollection(function* () {
        try {
          for (const value of [number(1), number(2), number(3)]) {
            reads++;
            yield value;
          }
        } finally {
          closes++;
        }
      });
      query(collection);
      observedReads.push(reads);
      observedCloses.push(closes);
    }

    expect(observedReads).toEqual([1, 2, 1]);
    expect(observedCloses).toEqual([1, 1, 1]);
  });

  test("FirstClassCollectionBase.isEmpty checks one element and closes the iterator", () => {
    let reads = 0;
    let closes = 0;
    const nonempty = new ProbeCollection(function* () {
      try {
        reads++;
        yield number(1);
        reads++;
        yield number(2);
      } finally {
        closes++;
      }
    });
    expect(nonempty.isEmpty()).toBe(false);
    expect(reads).toBe(1);
    expect(closes).toBe(1);

    const empty = new ProbeCollection(function* () {
      try {
        yield* [];
      } finally {
        closes++;
      }
    });
    expect(empty.isEmpty()).toBe(true);
    expect(closes).toBe(2);
  });

  test("the immutable constructor checks the budget before copying and while reading", () => {
    const value = number(1);
    const oversized = Array.from({ length: 65_537 }, () => value);
    let preflightReads = 0;
    const originalOversizedIterator = oversized[Symbol.iterator];
    oversized[Symbol.iterator] = () => {
      preflightReads++;
      return originalOversizedIterator.call(oversized);
    };
    expect(() => ImmutableFirstClassCollection.of(oversized)).toThrow(IllegalArgumentException);
    expect(preflightReads).toBe(0);
    const parsed = ImmutableFirstClassCollection.parse(oversized);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error.kind).toBe("too-many-immutable-collection-elements");

    const deceptive = [value];
    const overread = Array.from({ length: 65_537 }, () => value);
    deceptive[Symbol.iterator] = () => overread[Symbol.iterator]();
    expect(() => ImmutableFirstClassCollection.of(deceptive)).toThrow(IllegalArgumentException);
  });

  test("bounded operations reject an iterator that exceeds the shared scan budget", () => {
    const operation = (name: string, run: (collection: ProbeCollection) => void): void => {
      expect(() =>
        run(
          new ProbeCollection(function* () {
            for (let index = 0; index < 65_537; index++) yield number(index);
          }),
        ),
      ).toThrow(IllegalArgumentException);
      expect(name.length).toBeGreaterThan(0);
    };

    operation("tail", (collection) => void collection.tail());
    operation("include", (collection) => void collection.include(number(-1)));
    operation("exists", (collection) => void collection.exists(() => false));
    operation("filter", (collection) => void collection.filter(() => true));
    operation("map", (collection) => void collection.map((value) => number(value.asNumber())));
  });
});

describe("kernel concrete collection contracts", () => {
  test("all ordinary kernel collections retain their concrete type for tail/filter", () => {
    const binding = BindingDeclaration.of(
      AttributePath.of("Ticket.open"),
      DeclaredBindingValue.of(Declaration.of(true)),
    );
    const scenarioBinding = ScenarioBinding.of(AttributePath.of("Ticket.open"), BindingValue.of(true));
    const verdict = ScenarioVerdict.clean(
      BackendName.of("smt"),
      ContentHash.ofText("model"),
      TargetIdentifier.of("SC-1"),
      null,
    );
    const collections = [
      [DeclaredBindings.of([binding]), DeclaredBindings],
      [EnumerationMembers.of([EnumerationMember.of("open")]), EnumerationMembers],
      [ErrorMessages.of([ErrorMessage.of("failure")]), ErrorMessages],
      [FunctionalRequirementReferences.of([RequirementIdentifier.of("FR-1")]), FunctionalRequirementReferences],
      [RequirementIdentifiers.of([RequirementIdentifier.of("FR-1")]), RequirementIdentifiers],
      [ScenarioBindings.of([scenarioBinding]), ScenarioBindings],
      [ScenarioVerdicts.of([verdict]), ScenarioVerdicts],
      [TargetIdentifiers.of([TargetIdentifier.of("OB-1")]), TargetIdentifiers],
    ] as const;

    for (const [collection, type] of collections) {
      expect(collection.tail()).toBeInstanceOf(type);
      expect(collection.filter(() => true)).toBeInstanceOf(type);
    }
  });

  test("FindingTargets remains non-empty and returns TargetIdentifiers for emptying operations", () => {
    const targets = FindingTargets.of(TargetIdentifier.of("OB-1"), [TargetIdentifier.of("SC-1")]);

    expect(targets.head().asString()).toBe("OB-1");
    expect(targets.tail()).toBeInstanceOf(TargetIdentifiers);
    expect([...targets.tail()].map((target) => target.asString())).toEqual(["SC-1"]);
    expect(FindingTargets.of(TargetIdentifier.of("OB-1"), []).tail().isEmpty()).toBe(true);
    expect(targets.filter(() => false)).toBeInstanceOf(TargetIdentifiers);
    expect(targets.filter(() => false).isEmpty()).toBe(true);
    expect(targets.include(TargetIdentifier.of("SC-1"))).toBe(true);
  });

  test("missing element equality is value-based", () => {
    expect(ErrorMessage.of("same").equals(ErrorMessage.of("same"))).toBe(true);
    expect(ErrorMessage.of("same").equals(ErrorMessage.of("other"))).toBe(false);

    const path = AttributePath.of("Ticket.open");
    const declaration = (value: boolean) => BindingDeclaration.of(path, DeclaredBindingValue.of(Declaration.of(value)));
    expect(declaration(true).equals(declaration(true))).toBe(true);
    expect(declaration(true).equals(declaration(false))).toBe(false);

    const scenarioBinding = (value: boolean) => ScenarioBinding.of(path, BindingValue.of(value));
    expect(scenarioBinding(true).equals(scenarioBinding(true))).toBe(true);
    expect(scenarioBinding(true).equals(scenarioBinding(false))).toBe(false);

    const verdict = (state: "clean" | "violated") =>
      state === "clean"
        ? ScenarioVerdict.clean(BackendName.of("smt"), ContentHash.ofText("model"), TargetIdentifier.of("SC-1"), null)
        : ScenarioVerdict.violated(
            BackendName.of("smt"),
            ContentHash.ofText("model"),
            TargetIdentifier.of("SC-1"),
            null,
          );
    expect(verdict("clean").equals(verdict("clean"))).toBe(true);
    expect(verdict("clean").equals(verdict("violated"))).toBe(false);
  });

  test("bounded snapshots reject over-reading iterators through of and parse", () => {
    const binding = BindingDeclaration.of(
      AttributePath.of("Ticket.open"),
      DeclaredBindingValue.of(Declaration.of(true)),
    );
    const enumMember = EnumerationMember.of("open");
    const message = ErrorMessage.of("failure");
    const reference = RequirementIdentifier.of("FR-1");
    const target = TargetIdentifier.of("OB-1");
    const scenarioBinding = ScenarioBinding.of(AttributePath.of("Ticket.open"), BindingValue.of(true));
    const scenarioVerdict = ScenarioVerdict.clean(BackendName.of("smt"), ContentHash.ofText("model"), target, null);
    const verify = <E>(
      name: string,
      of: (values: readonly E[]) => object,
      parse: (values: readonly E[]) => { ok: true } | { ok: false; error: { kind: string } },
      value: E,
      count: number,
      problemKind: string,
    ): void => {
      const input = [value];
      const overread = Array.from({ length: count }, () => value);
      input[Symbol.iterator] = () => overread[Symbol.iterator]();
      expect(() => of(input), name).toThrow(IllegalArgumentException);
      const parsed = parse(input);
      expect(parsed.ok, name).toBe(false);
      if (!parsed.ok) expect(parsed.error.kind, name).toBe(problemKind);
    };

    verify(
      "DeclaredBindings",
      DeclaredBindings.of,
      DeclaredBindings.parse,
      binding,
      10_001,
      "too-many-binding-declarations",
    );
    verify(
      "EnumerationMembers",
      EnumerationMembers.of,
      EnumerationMembers.parse,
      enumMember,
      10_001,
      "too-many-enum-members",
    );
    verify("ErrorMessages", ErrorMessages.of, ErrorMessages.parse, message, 65_537, "too-many-error-messages");
    verify(
      "FunctionalRequirementReferences",
      FunctionalRequirementReferences.of,
      FunctionalRequirementReferences.parse,
      reference,
      10_001,
      "too-many-functional-requirement-references",
    );
    verify(
      "TargetIdentifiers",
      TargetIdentifiers.of,
      TargetIdentifiers.parse,
      target,
      65_537,
      "too-many-target-identifiers",
    );
    verify(
      "RequirementIdentifiers",
      RequirementIdentifiers.of,
      RequirementIdentifiers.parse,
      reference,
      65_537,
      "too-many-requirement-identifiers",
    );
    verify(
      "ScenarioBindings",
      ScenarioBindings.of,
      ScenarioBindings.parse,
      scenarioBinding,
      10_001,
      "too-many-scenario-bindings",
    );
    verify(
      "ScenarioVerdicts",
      ScenarioVerdicts.of,
      ScenarioVerdicts.parse,
      scenarioVerdict,
      129,
      "too-many-scenario-verdicts",
    );

    const findingHead = TargetIdentifier.of("OB-1");
    const findingTail = [TargetIdentifier.of("OB-2")];
    const overreadFindingTail = Array.from({ length: 65_536 }, () => TargetIdentifier.of("OB-2"));
    findingTail[Symbol.iterator] = () => overreadFindingTail[Symbol.iterator]();
    expect(() => FindingTargets.of(findingHead, findingTail)).toThrow(IllegalArgumentException);
    const parsedFindingTargets = FindingTargets.parse(findingHead, findingTail);
    expect(parsedFindingTargets.ok).toBe(false);
    if (!parsedFindingTargets.ok) expect(parsedFindingTargets.error.kind).toBe("too-many-finding-targets");
  });

  test("Declaration equality compares Json values without conflating null or key order", () => {
    const ordered = Declaration.of({ outer: { b: 2, a: [null, "text"] } });
    const reordered = Declaration.of({ outer: { a: [null, "text"], b: 2 } });
    expect(ordered.equals(reordered)).toBe(true);
    expect(Declaration.of(null).equals(Declaration.of(null))).toBe(true);
    expect(Declaration.of(null).equals(Declaration.of({}))).toBe(false);
    expect(Declaration.of([1, 2]).equals(Declaration.of([2, 1]))).toBe(false);
    expect(() => Declaration.of(Number.NaN)).toThrow(IllegalArgumentException);
    expect(() => Declaration.of(Number.POSITIVE_INFINITY)).toThrow(IllegalArgumentException);
    expect(Declaration.parse(Number.NaN).ok).toBe(false);
    expect(Declaration.parse(Number.POSITIVE_INFINITY).ok).toBe(false);
  });

  test("ExpressionTree equality follows its canonical value semantics", () => {
    const first = ExpressionTree.of({ op: "and", args: [{ op: "bool", value: true }] });
    const same = ExpressionTree.of({ args: [{ value: true, op: "bool" }], op: "and" });
    const different = ExpressionTree.of({ op: "and", args: [{ op: "bool", value: false }] });
    expect(first.equals(same)).toBe(true);
    expect(first.equals(different)).toBe(false);
    expect(first.isCanonicallyEqual(same)).toBe(first.equals(same));
  });
});
