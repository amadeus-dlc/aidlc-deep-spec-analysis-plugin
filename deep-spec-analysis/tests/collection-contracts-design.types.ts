import * as Design from "@deep-spec-analysis/design-domain";
import type * as Kernel from "@deep-spec-analysis/kernel-domain";
import type {
  FallibleFirstClassCollectionFactory,
  FirstClassCollectionFactory,
} from "@deep-spec-analysis/kernel-domain";

export const designCollectionFactories = {
  AttributeMappings: Design.AttributeMappings satisfies FirstClassCollectionFactory<
    [readonly Design.AttributeMapping[]],
    Design.AttributeMappings
  >,
  AttributePaths: Design.AttributePaths satisfies FirstClassCollectionFactory<
    [readonly Kernel.AttributePath[]],
    Design.AttributePaths
  >,
  BusinessRuleReferenceIndex: Design.BusinessRuleReferenceIndex satisfies FirstClassCollectionFactory<
    [Design.BusinessRuleReferences],
    Design.BusinessRuleReferenceIndex
  >,
  BusinessRuleReferences: Design.BusinessRuleReferences satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.BusinessRuleReference[]],
    Design.BusinessRuleReferences
  >,
  CheckedUnits: Design.CheckedUnits satisfies FirstClassCollectionFactory<
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
  DesignAttributeDeclarations: Design.DesignAttributeDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignAttributeDeclaration[]],
    Design.DesignAttributeDeclarations
  >,
  DesignBackgroundAssumptions: Design.DesignBackgroundAssumptions satisfies FirstClassCollectionFactory<
    [readonly Design.DesignBackgroundAssumption[]],
    Design.DesignBackgroundAssumptions
  >,
  DesignBackgroundDeclarations: Design.DesignBackgroundDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignBackgroundDeclaration[]],
    Design.DesignBackgroundDeclarations
  >,
  DesignCrossCheckedEntries: Design.DesignCrossCheckedEntries satisfies FirstClassCollectionFactory<
    [readonly Design.DesignCrossCheckedEntry[]],
    Design.DesignCrossCheckedEntries
  >,
  DesignEntityDeclarations: Design.DesignEntityDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignEntityDeclaration[]],
    Design.DesignEntityDeclarations
  >,
  DesignEventRuleCatalog: Design.DesignEventRuleCatalog satisfies FallibleFirstClassCollectionFactory<
    [Design.DesignUnit],
    Design.DesignEventRuleCatalog
  >,
  DesignFindings: Design.DesignFindings satisfies FirstClassCollectionFactory<
    [readonly Design.DesignFinding[]],
    Design.DesignFindings
  >,
  DesignIgnoreDeclarations: Design.DesignIgnoreDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignIgnoreDeclaration[]],
    Design.DesignIgnoreDeclarations
  >,
  DesignIgnores: Design.DesignIgnores satisfies FirstClassCollectionFactory<
    [readonly Design.DesignIgnore[]],
    Design.DesignIgnores
  >,
  DesignInputAnchors: Design.DesignInputAnchors satisfies FirstClassCollectionFactory<
    [readonly Design.DesignInputAnchor[]],
    Design.DesignInputAnchors
  >,
  DesignMachineDeclarations: Design.DesignMachineDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignMachineDeclaration[]],
    Design.DesignMachineDeclarations
  >,
  DesignMachines: Design.DesignMachines satisfies FirstClassCollectionFactory<
    [readonly Design.DesignMachine[]],
    Design.DesignMachines
  >,
  DesignObligationDeclarations: Design.DesignObligationDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignObligationDeclaration[]],
    Design.DesignObligationDeclarations
  >,
  DesignObligations: Design.DesignObligations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignObligation[]],
    Design.DesignObligations
  >,
  DesignReports: Design.DesignReports satisfies FirstClassCollectionFactory<
    [readonly Design.DesignReport[]],
    Design.DesignReports
  >,
  DesignScenarioDeclarations: Design.DesignScenarioDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignScenarioDeclaration[]],
    Design.DesignScenarioDeclarations
  >,
  DesignScenarios: Design.DesignScenarios satisfies FirstClassCollectionFactory<
    [readonly Design.DesignScenario[]],
    Design.DesignScenarios
  >,
  DesignSkips: Design.DesignSkips satisfies FirstClassCollectionFactory<
    [readonly Design.DesignSkipped[]],
    Design.DesignSkips
  >,
  DesignTransitionDeclarations: Design.DesignTransitionDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignTransitionDeclaration[]],
    Design.DesignTransitionDeclarations
  >,
  DesignTransitions: Design.DesignTransitions satisfies FirstClassCollectionFactory<
    [readonly Design.DesignTransition[]],
    Design.DesignTransitions
  >,
  DesignUnitDeclarations: Design.DesignUnitDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.DesignUnitDeclaration[]],
    Design.DesignUnitDeclarations
  >,
  DesignUnits: Design.DesignUnits satisfies FirstClassCollectionFactory<
    [readonly Design.DesignUnit[]],
    Design.DesignUnits
  >,
  EffectAssignments: Design.EffectAssignments satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.EffectAssignment[]],
    Design.EffectAssignments
  >,
  EventMappings: Design.EventMappings satisfies FirstClassCollectionFactory<
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
  LoweredBackgrounds: Design.LoweredBackgrounds satisfies FirstClassCollectionFactory<
    [readonly Design.LoweredBackground[]],
    Design.LoweredBackgrounds
  >,
  LoweredObligations: Design.LoweredObligations satisfies FirstClassCollectionFactory<
    [readonly Design.LoweredObligation[]],
    Design.LoweredObligations
  >,
  LoweredScenarios: Design.LoweredScenarios satisfies FirstClassCollectionFactory<
    [readonly Design.LoweredScenario[]],
    Design.LoweredScenarios
  >,
  ReachabilityPlan: Design.ReachabilityPlan satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.MachineReachability[]],
    Design.ReachabilityPlan
  >,
  RefinementAttributes: Design.RefinementAttributes satisfies FirstClassCollectionFactory<
    [readonly Design.RefinementAttribute[]],
    Design.RefinementAttributes
  >,
  RefinementObligations: Design.RefinementObligations satisfies FirstClassCollectionFactory<
    [readonly Design.RefinementObligation[]],
    Design.RefinementObligations
  >,
  RefinementQueryVerdicts: Design.RefinementQueryVerdicts satisfies FirstClassCollectionFactory<
    [Kernel.KeyedIndex<Kernel.QueryLabel, Design.RefinementQueryVerdict>],
    Design.RefinementQueryVerdicts
  >,
  RefinementQuintInvariants: Design.RefinementQuintInvariants satisfies FirstClassCollectionFactory<
    [readonly Design.RefinementQuintInvariant[]],
    Design.RefinementQuintInvariants
  >,
  RefinementScenarios: Design.RefinementScenarios satisfies FirstClassCollectionFactory<
    [readonly Design.RefinementScenario[]],
    Design.RefinementScenarios
  >,
  RefinementUnitMaps: Design.RefinementUnitMaps satisfies FirstClassCollectionFactory<
    [readonly Design.RefinementUnitMap[]],
    Design.RefinementUnitMaps
  >,
  RuleSubsumptions: Design.RuleSubsumptions satisfies FallibleFirstClassCollectionFactory<
    [readonly Design.RuleSubsumption[]],
    Design.RuleSubsumptions
  >,
  SiblingVerdictFindings: Design.SiblingVerdictFindings satisfies FirstClassCollectionFactory<
    [readonly Design.SiblingVerdictFinding[]],
    Design.SiblingVerdictFindings
  >,
  SiblingVerdictSkips: Design.SiblingVerdictSkips satisfies FirstClassCollectionFactory<
    [readonly Design.SiblingVerdictSkip[]],
    Design.SiblingVerdictSkips
  >,
  TransitionReferences: Design.TransitionReferences satisfies FirstClassCollectionFactory<
    [readonly Design.TransitionReference[]],
    Design.TransitionReferences
  >,
  UnformalizedTargets: Design.UnformalizedTargets satisfies FirstClassCollectionFactory<
    [readonly Kernel.TargetIdentifier[]],
    Design.UnformalizedTargets
  >,
  UnmappedDeclarations: Design.UnmappedDeclarations satisfies FirstClassCollectionFactory<
    [readonly Design.UnmappedTarget[]],
    Design.UnmappedDeclarations
  >,
};
