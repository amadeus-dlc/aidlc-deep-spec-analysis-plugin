import * as Doctor from "@deep-spec-analysis/doctor-domain";
import type {
  FallibleFirstClassCollectionFactory,
  FirstClassCollectionFactory,
  IterableFirstClassCollection,
  KeyedIndex,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import * as Refcheck from "@deep-spec-analysis/refcheck-domain";

Refcheck.AllowedValues satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.AllowedValue[]],
  Refcheck.AllowedValues
>;
Refcheck.AttributeDeclarations satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.AttributeDeclaration[]],
  Refcheck.AttributeDeclarations
>;
Refcheck.AttributeNames satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.AttributeName[]],
  Refcheck.AttributeNames
>;
Refcheck.CheckFamilies satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.CheckFamily[]],
  Refcheck.CheckFamilies
>;
Refcheck.ComponentEntities satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.ComponentEntity[]],
  Refcheck.ComponentEntities
>;
Refcheck.ComponentReferences satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.ComponentReference[]],
  Refcheck.ComponentReferences
>;
Refcheck.ComponentShapeErrors satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.ComponentShapeError[]],
  Refcheck.ComponentShapeErrors
>;
Refcheck.Components satisfies FirstClassCollectionFactory<[values: readonly Refcheck.Component[]], Refcheck.Components>;
Refcheck.ContractRows satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.ContractRow[]],
  Refcheck.ContractRows
>;
Refcheck.DomainEntitySketches satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.DomainEntitySketch[]],
  Refcheck.DomainEntitySketches
>;
Refcheck.EntityDeclarations satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.EntityDeclaration[]],
  Refcheck.EntityDeclarations
>;
Refcheck.EntityReferences satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.EntityReference[]],
  Refcheck.EntityReferences
>;
Refcheck.Findings satisfies FirstClassCollectionFactory<[values: readonly Refcheck.Finding[]], Refcheck.Findings>;
Refcheck.InputAnchors satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.InputAnchor[]],
  Refcheck.InputAnchors
>;
Refcheck.RelationshipDeclarations satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.RelationshipDeclaration[]],
  Refcheck.RelationshipDeclarations
>;
Refcheck.RuleDeclarations satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.RuleDeclaration[]],
  Refcheck.RuleDeclarations
>;
Refcheck.ShapeErrors satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.ShapeError[]],
  Refcheck.ShapeErrors
>;
Refcheck.SiblingUnitIndex satisfies FallibleFirstClassCollectionFactory<
  [units: KeyedIndex<UnitName, Refcheck.EntityDeclarations>],
  Refcheck.SiblingUnitIndex
>;
Refcheck.Skips satisfies FirstClassCollectionFactory<[values: readonly Refcheck.Skipped[]], Refcheck.Skips>;
Refcheck.SourceIdentifiers satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.SourceIdentifier[]],
  Refcheck.SourceIdentifiers
>;
Refcheck.SpecificationBlockAssessments satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.SpecificationBlockAssessment[]],
  Refcheck.SpecificationBlockAssessments
>;
Refcheck.StateMachineSketches satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.StateMachineSketch[]],
  Refcheck.StateMachineSketches
>;
Refcheck.StateNames satisfies FirstClassCollectionFactory<[values: readonly Refcheck.StateName[]], Refcheck.StateNames>;
Refcheck.UnitDeclarations satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.UnitDeclaration[]],
  Refcheck.UnitDeclarations
>;
Refcheck.UnitNames satisfies FirstClassCollectionFactory<[values: readonly UnitName[]], Refcheck.UnitNames>;
Refcheck.WitnessReferences satisfies FirstClassCollectionFactory<
  [values: readonly Refcheck.WitnessReference[]],
  Refcheck.WitnessReferences
>;
Doctor.DesignArtifacts satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Doctor.DesignArtifactReference[]],
  Doctor.DesignArtifacts
>;
Doctor.HealthVerdict satisfies FirstClassCollectionFactory<[values: readonly Doctor.Check[]], Doctor.HealthVerdict>;
Doctor.InstallationManifest satisfies { standard(): IterableFirstClassCollection<Doctor.ManifestEntry> };
Doctor.StableReleases satisfies FallibleFirstClassCollectionFactory<
  [versions: readonly Doctor.PluginVersion[]],
  Doctor.StableReleases
>;
Doctor.StageScopes satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Doctor.StageScope[]],
  Doctor.StageScopes
>;
Doctor.StructuralDebt satisfies FallibleFirstClassCollectionFactory<
  [observations: readonly Doctor.StructuralObservation[]],
  Doctor.StructuralDebt
>;
