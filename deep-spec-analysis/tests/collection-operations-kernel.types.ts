import type {
  BindingDeclaration,
  DeclaredBindings,
  Equatable,
  ErrorMessage,
  ErrorMessages,
  ExpressionTree,
  FindingTargets,
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

declare const sourceValue: SourceValue;
declare const collection: NonEmptyFirstClassCollection<SourceValue>;
declare const bindingDeclaration: BindingDeclaration;
declare const expressionTree: ExpressionTree;
declare const findingTargets: FindingTargets;
declare const declaredBindings: DeclaredBindings;
declare const errorMessages: ErrorMessages;

export type PrimitiveCollectionInputRejected = Reject<
  string extends Parameters<typeof ErrorMessages.of>[0][number] ? true : false
>;
export type PrimitiveCollectionMapRejected = Reject<
  ((value: SourceValue) => string) extends Parameters<typeof collection.map>[0] ? true : false
>;
export type MapReturnsSourceConcrete = Accept<
  ReturnType<typeof errorMessages.map> extends ErrorMessages ? true : false
>;
export type MapCallbackPreservesElementType = Accept<
  Parameters<typeof errorMessages.map>[0] extends (value: ErrorMessage) => ErrorMessage ? true : false
>;
export type ErrorMessagesMapRejectsDifferentElementType = Reject<
  ((value: ErrorMessage) => TargetIdentifier) extends Parameters<typeof errorMessages.map>[0] ? true : false
>;
export type ErrorMessagesCombineRejectsDifferentConcreteType = Reject<
  TargetIdentifiers extends Parameters<typeof errorMessages.combine>[0] ? true : false
>;
export type MapReturnsFindingTargets = Accept<
  ReturnType<typeof findingTargets.map> extends FindingTargets ? true : false
>;
export type MapReturnsDeclaredBindings = Accept<
  ReturnType<typeof declaredBindings.map> extends DeclaredBindings ? true : false
>;
export type MapToIsNotPublic = Reject<"mapTo" extends keyof ErrorMessages ? true : false>;
export type CombineToIsNotPublic = Reject<"combineTo" extends keyof ErrorMessages ? true : false>;
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
const findingTargetsAfterMap: FindingTargets = findingTargets.map((value) => value);
const findingTargetsAfterCombine: FindingTargets = findingTargets.combine(findingTargets);
const concreteTail: DeclaredBindings = declaredBindings.tail();
const concreteFilter: DeclaredBindings = declaredBindings.filter(() => true);
const concreteMap: DeclaredBindings = declaredBindings.map((value) => value);
const mapped: SourceValue = collection.map((value) => value).head();
const counted: number = collection.count();
const foldedNumber: number = collection.foldLeft(0, (accumulator, value) => accumulator + value.value);
const foldedString: string = collection.foldLeft("", (accumulator, value) => `${accumulator}${value.value}`);
const sourceAsEquatable: Equatable<SourceValue> = sourceValue;
const bindingAsEquatable: Equatable<BindingDeclaration> = bindingDeclaration;
const expressionTreeAsEquatable: Equatable<ExpressionTree> = expressionTree;

void targetIdentifiers;
void targetIdentifiersAfterFilter;
void findingTargetsAfterMap;
void findingTargetsAfterCombine;
void concreteTail;
void concreteFilter;
void concreteMap;
void mapped;
void counted;
void foldedNumber;
void foldedString;
void sourceAsEquatable;
void bindingAsEquatable;
void expressionTreeAsEquatable;
