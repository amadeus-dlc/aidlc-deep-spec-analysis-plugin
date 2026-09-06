import type * as Design from "@deep-spec-analysis/design-domain";
import type { Equatable, FirstClassCollection, TargetIdentifier, UnitName } from "@deep-spec-analysis/kernel-domain";

type AssertCollection<
  E extends Equatable<E>,
  C extends FirstClassCollection<E> & {
    tail(): C;
    filter(predicate: (element: E) => boolean): C;
  },
> = C;

type DesignCollectionContracts =
  | AssertCollection<Design.AttributeMapping, Design.AttributeMappings>
  | AssertCollection<Design.AttributePath, Design.AttributePaths>
  | AssertCollection<Design.BusinessRuleReference, Design.BusinessRuleReferenceIndex>
  | AssertCollection<Design.BusinessRuleReference, Design.BusinessRuleReferences>
  | AssertCollection<UnitName, Design.CheckedUnits>
  | AssertCollection<Design.DesignAssignment, Design.DesignAssignments>
  | AssertCollection<Design.DesignAttributeCatalogEntry, Design.DesignAttributeCatalog>
  | AssertCollection<Design.DesignAttributeDeclaration, Design.DesignAttributeDeclarations>
  | AssertCollection<Design.DesignBackgroundAssumption, Design.DesignBackgroundAssumptions>
  | AssertCollection<Design.DesignBackgroundDeclaration, Design.DesignBackgroundDeclarations>
  | AssertCollection<Design.DesignCrossCheckedEntry, Design.DesignCrossCheckedEntries>
  | AssertCollection<Design.DesignEntityDeclaration, Design.DesignEntityDeclarations>
  | AssertCollection<Design.DesignEventRule, Design.DesignEventRuleCatalog>
  | AssertCollection<Design.DesignFinding, Design.DesignFindings>
  | AssertCollection<Design.DesignIgnoreDeclaration, Design.DesignIgnoreDeclarations>
  | AssertCollection<Design.DesignIgnore, Design.DesignIgnores>
  | AssertCollection<Design.DesignInputAnchor, Design.DesignInputAnchors>
  | AssertCollection<Design.DesignMachineDeclaration, Design.DesignMachineDeclarations>
  | AssertCollection<Design.DesignMachine, Design.DesignMachines>
  | AssertCollection<Design.DesignObligationDeclaration, Design.DesignObligationDeclarations>
  | AssertCollection<Design.DesignObligation, Design.DesignObligations>
  | AssertCollection<Design.DesignReport, Design.DesignReports>
  | AssertCollection<Design.DesignScenarioDeclaration, Design.DesignScenarioDeclarations>
  | AssertCollection<Design.DesignScenario, Design.DesignScenarios>
  | AssertCollection<Design.DesignSkipped, Design.DesignSkips>
  | AssertCollection<Design.DesignTransitionDeclaration, Design.DesignTransitionDeclarations>
  | AssertCollection<Design.DesignTransition, Design.DesignTransitions>
  | AssertCollection<Design.DesignUnitDeclaration, Design.DesignUnitDeclarations>
  | AssertCollection<Design.DesignUnit, Design.DesignUnits>
  | AssertCollection<Design.EffectAssignment, Design.EffectAssignments>
  | AssertCollection<Design.EventMapping, Design.EventMappings>
  | AssertCollection<Design.InitialState, Design.InitialStates>
  | AssertCollection<Design.LoweredIdentifier, Design.IssuedLoweredIdentifiers>
  | AssertCollection<Design.LoweredBackground, Design.LoweredBackgrounds>
  | AssertCollection<Design.LoweredObligation, Design.LoweredObligations>
  | AssertCollection<Design.LoweredScenario, Design.LoweredScenarios>
  | AssertCollection<Design.MachineReachability, Design.ReachabilityPlan>
  | AssertCollection<Design.RefinementAttribute, Design.RefinementAttributes>
  | AssertCollection<Design.RefinementObligation, Design.RefinementObligations>
  | AssertCollection<Design.RefinementQueryVerdictEntry, Design.RefinementQueryVerdicts>
  | AssertCollection<Design.RefinementQuintInvariant, Design.RefinementQuintInvariants>
  | AssertCollection<Design.RefinementScenario, Design.RefinementScenarios>
  | AssertCollection<Design.RefinementUnitMap, Design.RefinementUnitMaps>
  | AssertCollection<Design.RuleSubsumption, Design.RuleSubsumptions>
  | AssertCollection<Design.SiblingVerdictFinding, Design.SiblingVerdictFindings>
  | AssertCollection<Design.SiblingVerdictSkip, Design.SiblingVerdictSkips>
  | AssertCollection<Design.TransitionReference, Design.TransitionReferences>
  | AssertCollection<TargetIdentifier, Design.UnformalizedTargets>
  | AssertCollection<Design.UnmappedTarget, Design.UnmappedDeclarations>;

type EveryDesignCollectionIsChecked = DesignCollectionContracts;

declare const allDesignCollections: EveryDesignCollectionIsChecked;
void allDesignCollections;
