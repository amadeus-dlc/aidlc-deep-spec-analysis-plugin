import * as Doctor from "@deep-spec-analysis/doctor-domain";
import type {
  FallibleFirstClassCollectionFactory,
  KeyedIndex,
  NonEmptyFirstClassCollection,
  UnitName,
} from "@deep-spec-analysis/kernel-domain";
import * as Refcheck from "@deep-spec-analysis/refcheck-domain";

Refcheck.AllowedValues satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.AllowedValue[]],
  Refcheck.AllowedValues
>;
Refcheck.AttributeDeclarations satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.AttributeDeclaration[]],
  Refcheck.AttributeDeclarations
>;
Refcheck.AttributeNames satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.AttributeName[]],
  Refcheck.AttributeNames
>;
Refcheck.CheckFamilies satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.CheckFamily[]],
  Refcheck.CheckFamilies
>;
Refcheck.ComponentEntities satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.ComponentEntity[]],
  Refcheck.ComponentEntities
>;
Refcheck.ComponentReferences satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.ComponentReference[]],
  Refcheck.ComponentReferences
>;
Refcheck.ComponentShapeErrors satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.ComponentShapeError[]],
  Refcheck.ComponentShapeErrors
>;
Refcheck.Components satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.Component[]],
  Refcheck.Components
>;
Refcheck.ContractRows satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.ContractRow[]],
  Refcheck.ContractRows
>;
Refcheck.DomainEntitySketches satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.DomainEntitySketch[]],
  Refcheck.DomainEntitySketches
>;
Refcheck.EntityDeclarations satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.EntityDeclaration[]],
  Refcheck.EntityDeclarations
>;
Refcheck.EntityReferences satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.EntityReference[]],
  Refcheck.EntityReferences
>;
Refcheck.Findings satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.Finding[]],
  Refcheck.Findings
>;
Refcheck.InputAnchors satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.InputAnchor[]],
  Refcheck.InputAnchors
>;
Refcheck.RelationshipDeclarations satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.RelationshipDeclaration[]],
  Refcheck.RelationshipDeclarations
>;
Refcheck.RuleDeclarations satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.RuleDeclaration[]],
  Refcheck.RuleDeclarations
>;
Refcheck.ShapeErrors satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.ShapeError[]],
  Refcheck.ShapeErrors
>;
Refcheck.SiblingUnitIndex satisfies FallibleFirstClassCollectionFactory<
  [units: KeyedIndex<UnitName, Refcheck.EntityDeclarations>],
  Refcheck.SiblingUnitIndex
>;
Refcheck.Skips satisfies FallibleFirstClassCollectionFactory<[values: readonly Refcheck.Skipped[]], Refcheck.Skips>;
Refcheck.SourceIdentifiers satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.SourceIdentifier[]],
  Refcheck.SourceIdentifiers
>;
Refcheck.SpecificationBlockAssessments satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.SpecificationBlockAssessment[]],
  Refcheck.SpecificationBlockAssessments
>;
Refcheck.StateMachineSketches satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.StateMachineSketch[]],
  Refcheck.StateMachineSketches
>;
Refcheck.StateNames satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.StateName[]],
  Refcheck.StateNames
>;
Refcheck.UnitDeclarations satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.UnitDeclaration[]],
  Refcheck.UnitDeclarations
>;
Refcheck.UnitNames satisfies FallibleFirstClassCollectionFactory<[values: readonly UnitName[]], Refcheck.UnitNames>;
Refcheck.WitnessReferences satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Refcheck.WitnessReference[]],
  Refcheck.WitnessReferences
>;
Doctor.DesignArtifacts satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Doctor.DesignArtifactReference[]],
  Doctor.DesignArtifacts
>;
Doctor.HealthVerdict satisfies FallibleFirstClassCollectionFactory<
  [values: readonly Doctor.Check[]],
  Doctor.HealthVerdict
>;
Doctor.InstallationManifest satisfies { standard(): NonEmptyFirstClassCollection<Doctor.ManifestEntry> };
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
