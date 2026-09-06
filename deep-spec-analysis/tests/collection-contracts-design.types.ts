import * as Design from "@deep-spec-analysis/design-domain";
import type * as Kernel from "@deep-spec-analysis/kernel-domain";
import type { FallibleFirstClassCollectionFactory } from "@deep-spec-analysis/kernel-domain";

export const designCollectionFactories = {
  AttributeMappings: Design.AttributeMappings satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.AttributeMapping[]],
    Design.AttributeMappings
  >,
  AttributePaths: Design.AttributePaths satisfies FallibleFirstClassCollectionFactory<
    [readonly Kernel.AttributePath[]],
    Design.AttributePaths
  >,
  BusinessRuleReferenceIndex: Design.BusinessRuleReferenceIndex satisfies FallibleFirstClassCollectionFactory<
    [Design.BusinessRuleReferences],
    Design.BusinessRuleReferenceIndex
  >,
  BusinessRuleReferences: Design.BusinessRuleReferences satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.BusinessRuleReference[]],
    Design.BusinessRuleReferences
  >,
  CheckedUnits: Design.CheckedUnits satisfies FallibleFirstClassCollectionFactory<
    [readonly Kernel.UnitName[]],
    Design.CheckedUnits
  >,
  DesignAssignments: Design.DesignAssignments satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignAssignment[]],
    Design.DesignAssignments
  >,
  DesignAttributeCatalog: Design.DesignAttributeCatalog satisfies FallibleFirstClassCollectionFactory<
    [Design.DesignEntityDeclarations],
    Design.DesignAttributeCatalog
  >,
  DesignAttributeDeclarations: Design.DesignAttributeDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignAttributeDeclaration[]],
    Design.DesignAttributeDeclarations
  >,
  DesignBackgroundAssumptions: Design.DesignBackgroundAssumptions satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignBackgroundAssumption[]],
    Design.DesignBackgroundAssumptions
  >,
  DesignBackgroundDeclarations: Design.DesignBackgroundDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignBackgroundDeclaration[]],
    Design.DesignBackgroundDeclarations
  >,
  DesignCrossCheckedEntries: Design.DesignCrossCheckedEntries satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignCrossCheckedEntry[]],
    Design.DesignCrossCheckedEntries
  >,
  DesignEntityDeclarations: Design.DesignEntityDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignEntityDeclaration[]],
    Design.DesignEntityDeclarations
  >,
  DesignEventRuleCatalog: Design.DesignEventRuleCatalog satisfies FallibleFirstClassCollectionFactory<
    [Design.DesignUnit],
    Design.DesignEventRuleCatalog
  >,
  DesignFindings: Design.DesignFindings satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignFinding[]],
    Design.DesignFindings
  >,
  DesignIgnoreDeclarations: Design.DesignIgnoreDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignIgnoreDeclaration[]],
    Design.DesignIgnoreDeclarations
  >,
  DesignIgnores: Design.DesignIgnores satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignIgnore[]],
    Design.DesignIgnores
  >,
  DesignInputAnchors: Design.DesignInputAnchors satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignInputAnchor[]],
    Design.DesignInputAnchors
  >,
  DesignMachineDeclarations: Design.DesignMachineDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignMachineDeclaration[]],
    Design.DesignMachineDeclarations
  >,
  DesignMachines: Design.DesignMachines satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignMachine[]],
    Design.DesignMachines
  >,
  DesignObligationDeclarations: Design.DesignObligationDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignObligationDeclaration[]],
    Design.DesignObligationDeclarations
  >,
  DesignObligations: Design.DesignObligations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignObligation[]],
    Design.DesignObligations
  >,
  DesignReports: Design.DesignReports satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignReport[]],
    Design.DesignReports
  >,
  DesignScenarioDeclarations: Design.DesignScenarioDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignScenarioDeclaration[]],
    Design.DesignScenarioDeclarations
  >,
  DesignScenarios: Design.DesignScenarios satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignScenario[]],
    Design.DesignScenarios
  >,
  DesignSkips: Design.DesignSkips satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignSkipped[]],
    Design.DesignSkips
  >,
  DesignTransitionDeclarations: Design.DesignTransitionDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignTransitionDeclaration[]],
    Design.DesignTransitionDeclarations
  >,
  DesignTransitions: Design.DesignTransitions satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignTransition[]],
    Design.DesignTransitions
  >,
  DesignUnitDeclarations: Design.DesignUnitDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignUnitDeclaration[]],
    Design.DesignUnitDeclarations
  >,
  DesignUnits: Design.DesignUnits satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.DesignUnit[]],
    Design.DesignUnits
  >,
  EffectAssignments: Design.EffectAssignments satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.EffectAssignment[]],
    Design.EffectAssignments
  >,
  EventMappings: Design.EventMappings satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.EventMapping[]],
    Design.EventMappings
  >,
  InitialStates: Design.InitialStates satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.InitialState[]],
    Design.InitialStates
  >,
  IssuedLoweredIdentifiers: Design.IssuedLoweredIdentifiers satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.LoweredIdentifier[]],
    Design.IssuedLoweredIdentifiers
  >,
  LoweredBackgrounds: Design.LoweredBackgrounds satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.LoweredBackground[]],
    Design.LoweredBackgrounds
  >,
  LoweredObligations: Design.LoweredObligations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.LoweredObligation[]],
    Design.LoweredObligations
  >,
  LoweredScenarios: Design.LoweredScenarios satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.LoweredScenario[]],
    Design.LoweredScenarios
  >,
  ReachabilityPlan: Design.ReachabilityPlan satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.MachineReachability[]],
    Design.ReachabilityPlan
  >,
  RefinementAttributes: Design.RefinementAttributes satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.RefinementAttribute[]],
    Design.RefinementAttributes
  >,
  RefinementObligations: Design.RefinementObligations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.RefinementObligation[]],
    Design.RefinementObligations
  >,
  RefinementQueryVerdicts: Design.RefinementQueryVerdicts satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.RefinementQueryVerdictEntry[]],
    Design.RefinementQueryVerdicts
  >,
  RefinementQuintInvariants: Design.RefinementQuintInvariants satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.RefinementQuintInvariant[]],
    Design.RefinementQuintInvariants
  >,
  RefinementScenarios: Design.RefinementScenarios satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.RefinementScenario[]],
    Design.RefinementScenarios
  >,
  RefinementUnitMaps: Design.RefinementUnitMaps satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.RefinementUnitMap[]],
    Design.RefinementUnitMaps
  >,
  RuleSubsumptions: Design.RuleSubsumptions satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.RuleSubsumption[]],
    Design.RuleSubsumptions
  >,
  SiblingVerdictFindings: Design.SiblingVerdictFindings satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.SiblingVerdictFinding[]],
    Design.SiblingVerdictFindings
  >,
  SiblingVerdictSkips: Design.SiblingVerdictSkips satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.SiblingVerdictSkip[]],
    Design.SiblingVerdictSkips
  >,
  TransitionReferences: Design.TransitionReferences satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.TransitionReference[]],
    Design.TransitionReferences
  >,
  UnformalizedTargets: Design.UnformalizedTargets satisfies FallibleFirstClassCollectionFactory<
    [readonly Kernel.TargetIdentifier[]],
    Design.UnformalizedTargets
  >,
  UnmappedDeclarations: Design.UnmappedDeclarations satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.UnmappedTarget[]],
    Design.UnmappedDeclarations
  >,
};
