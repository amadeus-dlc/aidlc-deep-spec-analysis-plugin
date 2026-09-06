# Terms Used in Requirements and Design Verification

English | [日本語](CONTEXT.ja.md)

Shared vocabulary for inspecting requirements and design declarations, explaining their correspondence, and describing verification results.

## Terms

**Attribute declaration**:
A declaration of an attribute belonging to an entity, including its name, type, and value domain. Declarations containing errors are retained as inspection targets.

**Attribute catalog**:
A collection that uniquely identifies a declared attribute from an entity name and attribute name.
_Distinguish from_: attribute mapping. A mapping defines correspondence between requirement and design attributes.

**Design event rule**:
A design rule defining applicability conditions and effects for an input trigger. It includes state-transition and event-type obligations.
_Avoid calling it_: event. This avoids confusing a declaration with an event that actually occurred.

**Subsumption candidate**:
A directional question that checks whether one of two rules with the same trigger and effect subsumes the other.

**Rule subsumption**:
A relation in which every state satisfying B's applicability condition also satisfies A's, and both have the same trigger and effect. A subsumes B.

**Subsumption evidence**:
A verification result supporting that the target subsumption holds. Absence of evidence alone does not establish that subsumption fails.

**Mutual equivalence**:
Both directions of subsumption hold for the same two rules.

**Attribute coverage**:
The state in which attributes required for verification are classified as mapped, explicitly exempted, or uncovered.

**Explicit exemption**:
A declaration, with a reason, that a target will not be mapped or verified.
_Distinguish from_: omission and insufficient capability. Missing documentation and verification limitations are not exemption declarations.

**Scenario acceptance expectation**:
An expectation of whether a concrete example should be allowed or rejected by the rules.
_Distinguish from_: expectation expression. An expectation expression states a property required of a post-state or other result.

**Verification query**:
A unit of verification whose purpose, target, and verdict meaning are defined.
_Distinguish from_: query string. The meaning of a query and its notation are separate.

**Lifecycle target coverage**:
For an entity, the lifecycle attribute selected with explicit attributes taking priority is checked by a state diagram. A diagram for another entity or one whose attribute cannot be resolved does not provide coverage.

**Sibling unit declaration index**:
A collection that holds entities and attributes declared by adjacent units as information from the same acquisition point. It is used to compare ownership duplicates or omissions and attribute coverage.

**Scenario verdict comparison**:
Checking agreement among verdicts returned by different backends for the same target. A design scenario target includes unit ownership; unchecked or unavailable results do not count as verified.

**Issued lowering identifier**:
An obligation, scenario, or background identifier actually assigned in one lowering document. Duplicates are forbidden, and response targets are resolved from the issued correspondence.

**Verification model version**:
A hash identifying the target content. Scenario verdict comparison identifies a target using this version together with the unit and local ID. It is distinct from the artifact model identifier.

**Expression synthesis failure**:
The condition in which each input expression is valid, but adding implicit conditions or mapping expansions exceeds the representation budget and the verification expression cannot be built. It is recorded as the target's unverified reason.

**Diagnostic target**:
A collection of targets pointed to by one diagnostic. A diagnostic has at least one target. The list of inspected targets may be empty, so the two must be distinguished.

**Effect assignment equation**:
An equation connecting an attribute's next-state reference with the right-hand side. The written left-to-right order is also preserved.

**Assignment to a design attribute**:
The pair consisting of the attribute updated by a design event and the right-hand side assigned to it. It is distinct from the full assignment equation.
