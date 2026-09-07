import type { InstallationManifest, ManifestEntries, ManifestEntry } from "@deep-spec-analysis/doctor-domain";
import type { NonEmptyFirstClassCollectionFactory } from "@deep-spec-analysis/kernel-domain";

type Accept<Accepted extends true> = Accepted;
type Reject<Accepted extends false> = Accepted;

export type NonEmptyFactory = Accept<
  typeof InstallationManifest extends NonEmptyFirstClassCollectionFactory<ManifestEntry, InstallationManifest>
    ? true
    : false
>;
export type MappedManifestIsConcrete = Accept<
  ReturnType<InstallationManifest["map"]> extends InstallationManifest ? true : false
>;
export type MappedEntriesAreConcrete = Accept<
  ReturnType<ManifestEntries["map"]> extends ManifestEntries ? true : false
>;
export type ManifestHasNoEmptyQuery = Reject<"isEmpty" extends keyof InstallationManifest ? true : false>;
export type ManifestMapToIsProtected = Reject<"mapTo" extends keyof InstallationManifest ? true : false>;
export type EntriesMapToIsProtected = Reject<"mapTo" extends keyof ManifestEntries ? true : false>;
export type ManifestCombineIsConcrete = Accept<
  ReturnType<InstallationManifest["combine"]> extends InstallationManifest ? true : false
>;
export type ManifestCombineAcceptsSameConcrete = Accept<
  Parameters<InstallationManifest["combine"]>[0] extends InstallationManifest ? true : false
>;
export type ManifestCombineRejectsEmptyCapable = Reject<
  ManifestEntries extends Parameters<InstallationManifest["combine"]>[0] ? true : false
>;
export type EntriesCombineIsConcrete = Accept<
  ReturnType<ManifestEntries["combine"]> extends ManifestEntries ? true : false
>;
export type ManifestCombineToIsProtected = Reject<"combineTo" extends keyof InstallationManifest ? true : false>;
