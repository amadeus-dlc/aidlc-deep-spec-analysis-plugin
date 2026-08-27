# Requirements — Order Handling (conformance fixture)

Fixture requirements document for the deep-spec conformance suite. It
deliberately contains static-rule defects (FR-1 vs FR-2, FR-4 vs FR-5), a
state-machine defect (FR-6 vs FR-7), an unspecified input region (FR-6), and
an unformalizable NFR — the canonical IR fixture formalizes exactly these.

## Functional Requirements

- **FR-1** Expedited orders shall carry an amount of at least 3.
- **FR-2** Expedited orders shall carry an amount of at most 1.
- **FR-3** No order amount shall exceed 3.
- **FR-4** When a submit request arrives for a draft order with a positive
  amount, the system shall mark the order submitted.
- **FR-5** When a submit request arrives, the system shall mark the order
  rejected.
- **FR-6** When a ship request arrives for a submitted order, the system
  shall mark the order shipped.
- **FR-7** Shipped orders shall carry an amount of at least 1.
- **FR-8** A submitted order shall eventually leave the submitted state.

## Non-Functional Requirements

- **NFR-1** The system shall respond to any order request within 200 ms.

## Acceptance Criteria (Gherkin)

- Given a draft order with amount 1 and no expedite flag, the state is
  acceptable (FR-1).
- Given an approved order with amount 2 and the expedite flag set, the state
  is acceptable (FR-2).
- Given the expedite flag set with amount 2, the state must be rejected
  (FR-2).
- Given a draft order with amount 1, when submit arrives, the order becomes
  submitted (FR-4).
