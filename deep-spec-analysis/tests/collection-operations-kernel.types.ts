import type {
  BindingDeclaration,
  DeclaredBindings,
  Equatable,
  ExpressionTree,
  FindingTargets,
  FirstClassCollection,
  ImmutableFirstClassCollection,
  NonEmptyFirstClassCollection,
  RequirementIdentifier,
  RequirementIdentifiers,
  ScenarioBinding,
  ScenarioBindings,
  TargetIdentifier,
  TargetIdentifiers,
} from "@deep-spec-analysis/kernel-domain";

type Reject<Accepted extends false> = Accepted;
type Accept<Accepted extends true> = Accepted;

interface SourceValue extends Equatable<SourceValue> {
  readonly value: number;
}

interface MappedValue extends Equatable<MappedValue> {
  readonly label: string;
}

declare const sourceValue: SourceValue;
declare const mappedValue: MappedValue;
declare const collection: NonEmptyFirstClassCollection<SourceValue>;
declare const bindingDeclaration: BindingDeclaration;
declare const expressionTree: ExpressionTree;
declare const findingTargets: FindingTargets;
declare const declaredBindings: DeclaredBindings;

export type PrimitiveImmutableInputRejected = Reject<
  string extends Parameters<typeof ImmutableFirstClassCollection.of>[0][number] ? true : false
>;
export type PrimitiveCollectionMapRejected = Reject<
  ((value: SourceValue) => string) extends Parameters<typeof collection.map>[0] ? true : false
>;
export type MapReturnsFirstClassCollection = Accept<
  FirstClassCollection<MappedValue> extends ReturnType<typeof collection.map<MappedValue>> ? true : false
>;
export type FindingTargetsHaveNoEmptyQuery = Reject<"isEmpty" extends keyof FindingTargets ? true : false>;
export type TargetIdentifiersParseAcceptsTypedValues = Accept<
  Parameters<typeof TargetIdentifiers.parse>[0] extends readonly TargetIdentifier[] ? true : false
>;
export type RequirementIdentifiersParseAcceptsTypedValues = Accept<
  Parameters<typeof RequirementIdentifiers.parse>[0] extends readonly RequirementIdentifier[] ? true : false
>;
export type ScenarioBindingsParseAcceptsTypedValues = Accept<
  Parameters<typeof ScenarioBindings.parse>[0] extends readonly ScenarioBinding[] ? true : false
>;

const targetIdentifiers: TargetIdentifiers = findingTargets.tail();
const targetIdentifiersAfterFilter: TargetIdentifiers = findingTargets.filter(() => true);
const concreteTail: DeclaredBindings = declaredBindings.tail();
const concreteFilter: DeclaredBindings = declaredBindings.filter(() => true);
const mapped: FirstClassCollection<MappedValue> = collection.map(() => mappedValue);
const sourceAsEquatable: Equatable<SourceValue> = sourceValue;
const bindingAsEquatable: Equatable<BindingDeclaration> = bindingDeclaration;
const expressionTreeAsEquatable: Equatable<ExpressionTree> = expressionTree;

void targetIdentifiers;
void targetIdentifiersAfterFilter;
void concreteTail;
void concreteFilter;
void mapped;
void sourceAsEquatable;
void bindingAsEquatable;
void expressionTreeAsEquatable;
