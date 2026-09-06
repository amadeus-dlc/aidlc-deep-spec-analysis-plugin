import type { FindingTargets, TargetIdentifier, TargetIdentifiers } from "@deep-spec-analysis/kernel-domain";

type Reject<Accepted extends false> = Accepted;
export type EmptyOfArgumentsAreRejected = Reject<[] extends Parameters<typeof FindingTargets.of> ? true : false>;
export type EmptyParseArgumentsAreRejected = Reject<[] extends Parameters<typeof FindingTargets.parse> ? true : false>;
export type PrimitiveHeadIsRejected = Reject<
  [string, readonly TargetIdentifier[]] extends Parameters<typeof FindingTargets.of> ? true : false
>;
export type NullableHeadIsRejected = Reject<
  [TargetIdentifier | undefined, readonly TargetIdentifier[]] extends Parameters<typeof FindingTargets.of>
    ? true
    : false
>;
export type ArrayOnlyCompatibilityIsRejected = Reject<
  [readonly TargetIdentifier[]] extends Parameters<typeof FindingTargets.of> ? true : false
>;
export type NullableCollectionIsNotFindingTargets = Reject<TargetIdentifiers extends FindingTargets ? true : false>;
export type NonEmptyCollectionHasNoEmptyQuery = Reject<"isEmpty" extends keyof FindingTargets ? true : false>;
