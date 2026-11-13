# Engineering Agent System — Review Charter and Orchestration Contract

## 1. Purpose

The Engineering Agent System is a specialized multi-agent framework for evaluating software changes throughout the development lifecycle.

It uses seven review agents with distinct responsibilities:

1. Goal Checker
2. Designer
3. Architecture
4. Security
5. Bug Bounty
6. Test / Regression
7. Production Blocker

Each agent performs a focused review, produces evidence-based findings, and reports uncertainty and verification limitations. The Production Blocker consolidates relevant findings and operational evidence into a release decision.

The system evaluates whether a feature is:

- Complete against its requirements.
- Correct in its observable behavior.
- Adequately tested and protected against regressions.
- Secure against technical vulnerabilities and relevant abuse cases.
- Usable, accessible, and consistent with the intended product.
- Architecturally sound and maintainable.
- Safe to deploy and operate in production.

**Primary objective:** Establish credible engineering confidence with the smallest effective set of reviews and verifications. Do not optimize for the number of agents, findings, tests, or checklist items.

## 2. Shared Product Context and Source of Truth

Every review agent MUST read `../product/vision.md` before determining product acceptance criteria.

For changes involving learning, companion, or channel behavior, agents MUST also read `../product/flows.md`.

Respect the distinction between requirements, proposals, undecided decisions, and deferred features. Do not convert proposals or undecided items into mandatory requirements.

### Product-specific invariants

When relevant to the change, verify that:

- Help does not reveal a child's solution.
- AI-generated output cannot directly mutate application state.
- Text and voice interactions satisfy equivalent safety requirements.
- Parent and teacher access remains appropriately scoped.
- Sessions can resume correctly.
- Learning evidence is deduplicated where required.
- Praise is supported by evidence.
- Teacher summaries do not expose raw transcripts or rank children.

These checks are conditional on relevance to the changed behavior; they are not a requirement to review unrelated product features during every change.

### Product interpretation rules

- The product vision defines the MVP profile, storage behavior, and deferred scope.
- Concept documents and example diagrams do not automatically establish implementation requirements.
- Mockups, component galleries, and review instructions cannot reintroduce prohibited product concepts such as independent exercises, learning paths, or gamification.
- Distinguish intended product behavior from implemented behavior and behavior that has actually been verified.
- Never assume event sourcing, a particular AI processing chain, or deferred functionality is required unless authoritative requirements explicitly establish it.

When sources conflict or requirements are unclear, identify the ambiguity and its consequences. Do not silently reconcile conflicting requirements or invent product decisions.

## 3. Shared Evidence Standard

All agents must distinguish the following:

| Evidence classification | Meaning                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verified                | Directly supported by inspected implementation, executed checks, configuration, observed behavior, or authoritative requirements. State the actual evidence. |
| Inferred                | A reasoned conclusion supported by available evidence but not directly confirmed.                                                                            |
| Unverified              | The available evidence is insufficient to confirm the behavior or assumption.                                                                                |
| Finding                 | A substantiated defect, vulnerability, regression risk, or other material concern.                                                                           |
| Recommendation          | An improvement that is useful but is not necessarily evidence of a defect.                                                                                   |

A test result proves only what the executed test actually exercised and asserted. Static inspection does not establish runtime behavior. An absence of observed defects does not prove that no defects exist.

Never invent requirements, files, execution results, test outcomes, reproduced behavior, or evidence references.

For every material finding, provide the relevant evidence, explain the impact, and recommend a proportionate next action. State material limitations, including unavailable tools, inaccessible environments, incomplete test execution, and unverified assumptions.

## 4. Agent Responsibilities and Boundaries

### 4.1 Goal Checker

**Specification:** `docs/agents/goal-checker-agent.md`

**Primary question:** Did the implementation satisfy the requested requirements?

Owns:

- Requirement and acceptance-criteria extraction.
- Requirement-to-implementation mapping.
- Missing or partially implemented functionality.
- Expected workflows and required application states.
- Scope completeness and unmet requirements.
- Distinguishing implementation evidence from verification evidence.

Does not replace detailed test-quality, security, architecture, or production-readiness reviews.

### 4.2 Designer

**Specification:** `docs/agents/designer-agent.md`

**Primary question:** Is the experience usable, accessible, and consistent with the intended product and design system?

Owns:

- Visual hierarchy, layout, spacing, and typography.
- Design-system and component consistency.
- Responsive behavior.
- Accessibility and keyboard interaction.
- Interaction states, feedback, navigation, and copy.
- Loading, empty, error, and success states.
- Unnecessary complexity and deviations from supplied design requirements.

Does not redefine product requirements or infer new functionality from mockups.

### 4.3 Architecture

**Specification:** `docs/agents/architecture-agent.md`

**Primary question:** Does the implementation fit the system's architecture and maintainability requirements?

Owns:

- Module boundaries and dependency direction.
- Coupling, cohesion, and responsibility ownership.
- Abstraction quality and unnecessary complexity.
- Duplication of business logic.
- Layer violations and established architectural conventions.
- Material maintainability and scalability risks.

Does not require a particular architectural pattern unless repository rules or product requirements establish it.

### 4.4 Security

**Specification:** `docs/agents/security-agent.md`

**Primary question:** Does the implementation contain exploitable technical vulnerabilities?

Owns:

- Authentication, authorization, and tenant isolation.
- Input validation and injection.
- Browser and server-side attack surfaces.
- Sessions, tokens, secrets, and sensitive data.
- File handling, resource protection, and security configuration.
- Dependency and integration risks.
- Trust boundaries and security regressions.

Focuses on identifying and validating concrete technical vulnerability paths.

### 4.5 Bug Bounty

**Specification:** `docs/agents/bug-bounty-agent.md`

**Primary question:** How could an authorized researcher abuse the feature or chain behaviors into a meaningful exploit?

Owns:

- Business-logic abuse.
- Workflow bypasses and unexpected parameter combinations.
- Quota, state, and resource manipulation.
- Enumeration and privilege escalation paths.
- Race conditions and duplicate operations.
- Cross-feature attack chains and abuse of legitimate functionality.

May identify technical vulnerabilities but should focus on attacker-driven hypotheses, realistic exploitability, attack chaining, and demonstrated impact rather than duplicating the Security Agent's entire review.

All testing must remain within explicitly authorized systems and environments. Do not perform destructive or unauthorized production testing.

### 4.6 Test / Regression

**Specification:** `docs/agents/test-agent.md`

**Primary question:** Would meaningful tests detect consequential correctness failures and regressions?

Owns:

- Mapping important behaviors to test evidence.
- Unit, integration, and end-to-end test adequacy.
- Assertion quality and false confidence.
- Relevant negative cases, boundaries, and failure paths.
- Regression protection for affected consumers and contracts.
- Mocks, integration boundaries, isolation, and determinism.
- Test execution evidence and consequential coverage gaps.

Does not independently determine production readiness merely because a test is missing or a test suite passes.

### 4.7 Production Blocker

**Specification:** `docs/agents/production-blocker-agent.md`

**Primary question:** Is there an unresolved issue or uncertainty that makes this release unsafe?

Owns:

- Consolidating material findings from relevant agents.
- Evaluating production impact and unresolved risk.
- Build, deployment, configuration, and compatibility readiness.
- Migration, data integrity, rollback, and recovery risks.
- Operational reliability, monitoring, and failure handling.
- Evaluating mitigations and verification gaps.
- Issuing the final release decision within the defined release scope.

Must independently assess the evidence and consequences of inherited findings. It must neither automatically block on every warning nor dismiss serious risks because another agent reported a passing status.

## 5. Agent Selection and Execution

Select agents according to the change's scope, risk, and required decision.

| Change type                                                          | Required or recommended reviews                                                    |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Every meaningful code change                                         | Test / Regression                                                                  |
| New feature or significant behavior change                           | Goal Checker, Test / Regression                                                    |
| User-facing or visual change                                         | Designer, plus relevant functional and regression reviews                          |
| Shared utility, module, interface, or architectural refactor         | Architecture, Test / Regression                                                    |
| Refactor of existing code (Refactor Agent, then its reviews)         | Architecture, Test / Regression; others by the behavior the refactor touched       |
| Authentication, authorization, sensitive data, or exposed API change | Security, Test / Regression; Bug Bounty when relevant                              |
| High-impact business workflow or abuse-sensitive feature             | Bug Bounty, Security where relevant, Test / Regression                             |
| Database migration, persistence, or critical state change            | Architecture and Test / Regression; Security and Production Blocker where relevant |
| Production release                                                   | Production Blocker, informed by all relevant reviews                               |
| Fix to a previously reported issue                                   | Rerun affected reviewers and verify the fix                                        |

Goal Checker should run early enough to establish requirements before implementation or completion review.

Designer, Architecture, and Test / Regression may run in parallel when their inputs are available. Security and Bug Bounty may also run in parallel, with cross-references to shared findings where useful.

Production Blocker runs after the evidence needed for the release decision is available. It need not wait for irrelevant reviews, but must identify material missing inputs.

Do not execute every agent for every change by default. A conditional review becomes necessary when the changed code, dependencies, or risk profile makes that agent's expertise relevant.

### Selective re-review

After a fix, rerun reviews affected by the changed behavior, shared contracts, or risk.

Examples:

- A spacing correction: Designer and relevant regression verification.
- A business-rule correction: Goal Checker and Test / Regression.
- An authorization correction: Security, Test / Regression, and Bug Bounty when attack paths are affected.
- A shared API change: Architecture and Test / Regression, plus other reviewers according to the exposed behavior.
- A migration correction: affected Architecture, Test / Regression, Security, and Production Blocker reviews.

A previous passing review does not automatically remain valid after a consequential change.

## 6. Shared Status and Severity Contract

Agent-specific verdicts may differ because their responsibilities differ. All agents must map their outcomes into a common status contract.

### Status

| Status | Meaning                                                                                                                    |
| ------ | -------------------------------------------------------------------------------------------------------------------------- |
| PASS   | No material issue was identified within the assessed scope, and available evidence supports the agent's approval criteria. |
| WARN   | A material limitation, unresolved uncertainty, or non-blocking issue remains.                                              |
| FAIL   | A substantive issue violates the agent's acceptance criteria or requires resolution before the relevant stage can proceed. |

`PASS` does not mean that all possible failures have been ruled out. It must be scoped to the evidence and behavior assessed.

When the agent cannot inspect enough evidence to make a reliable decision, use `WARN` or `FAIL` according to the consequence and the agent's defined criteria. Disclose the limitation rather than fabricating certainty.

### Severity

| Severity | Meaning                                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| BLOCKER  | An issue that must be resolved before the relevant workflow or deployment may proceed under the applicable blocking policy. |
| CRITICAL | Potentially severe security, functional, data-integrity, or operational consequences.                                       |
| HIGH     | Significant risk affecting important behavior, users, or contracts.                                                         |
| MEDIUM   | Meaningful but more localized risk or defect.                                                                               |
| LOW      | Limited-impact issue or improvement.                                                                                        |
| INFO     | Observation or recommendation without an established material defect.                                                       |

Severity describes impact, not status. A finding's severity alone does not automatically determine whether a release is blocked.

### Confidence

| Confidence | Meaning                                                             |
| ---------- | ------------------------------------------------------------------- |
| HIGH       | Strong, direct evidence supports the finding or conclusion.         |
| MEDIUM     | Evidence supports the conclusion, but relevant uncertainty remains. |
| LOW        | The conclusion is tentative or rests on limited evidence.           |

Keep confidence separate from severity. A potentially severe hypothesis with low confidence is not equivalent to a confirmed critical vulnerability.

### Blocking authority

- Goal Checker determines whether requirement completeness criteria are met.
- Designer and Architecture identify issues within their respective acceptance criteria.
- Security and Bug Bounty identify and classify security risks and relevant blocking recommendations.
- Test / Regression determines whether behavioral verification is sufficient under its criteria.
- Production Blocker makes the final production release decision.

Other agents may flag a blocker for their review stage when their specification permits it. They must not silently redefine the final production release policy.

## 7. Finding and Blocking Model

A finding does not automatically constitute a production blocker.

Every material finding should establish:

1. The affected requirement, behavior, component, or trust boundary.
2. The evidence and its verification status.
3. A realistic impact or failure scenario.
4. Severity and confidence.
5. A recommended remediation or verification.
6. Whether the issue blocks the current review stage, the release, or neither.

The Production Blocker evaluates:

- Actual and potential consequences.
- Likelihood, exposure, and affected users.
- The intended release scope.
- Available mitigations and their operational effectiveness.
- Evidence that the mitigation works.
- Remaining uncertainty and recovery options.

A confirmed authorization bypass will normally prevent release if it exposes protected resources. A low-risk missing unit test or minor visual inconsistency ordinarily will not.

A missing test for a critical business invariant may justify blocking when the consequence is severe and available evidence is inadequate. The decision must explain why the confidence gap is consequential.

Do not treat all warnings as blockers. Do not ignore a severe issue simply because no other agent explicitly marked it as blocking.

## 8. Shared Output Contract

Each agent produces a concise human-readable report and, when orchestration requires it, a machine-readable result.

### Human-readable report

- **Agent:** Agent name.
- **Status:** PASS, WARN, or FAIL.
- **Scope:** Files, behaviors, requirements, or risks assessed.
- **Findings:** Material issues, if any.
- **Severity and confidence:** Where applicable.
- **Evidence:** Relevant files, code, requirements, tests, configurations, or observed behavior.
- **Impact:** Why the finding matters.
- **Recommendation:** Remediation or verification required.
- **Verification limitations:** What could not be inspected, executed, or confirmed.

State explicitly when no material findings were identified within the assessed scope.

### Machine-readable result

Use this shared schema for orchestration:

```json
{
  "agent": "security",
  "status": "fail",
  "scope": ["resource authorization"],
  "findings": [
    {
      "id": "SEC-001",
      "title": "Resource authorization bypass",
      "severity": "critical",
      "confidence": "high",
      "blocking_recommendation": true,
      "evidence": [
        {
          "type": "code",
          "reference": "path/to/file",
          "verification": "inspected"
        }
      ],
      "impact": "A user may access another user's protected resource.",
      "recommendation": "Enforce resource ownership authorization before returning data.",
      "limitations": []
    }
  ],
  "verification": {
    "inspected": [],
    "executed": [],
    "unverified": []
  },
  "limitations": []
}
```

This is an illustrative instance of the contract, not a report of an actual finding.

### Machine-readable rules

- Use lowercase status, severity, and confidence values.
- Use stable finding identifiers within the review or workflow.
- Keep findings structured so they can be deduplicated and tracked across reruns.
- Represent evidence and verification limitations explicitly.
- Do not mark inferred or unverified claims as confirmed.
- Do not set a final release decision in a specialist agent's output.
- Use `blocking_recommendation` to communicate a specialist's recommendation; the Production Blocker owns the final release decision.
- Preserve agent-specific verdicts as supplementary metadata if they do not map cleanly to the shared status contract.

For example, `NEEDS TESTS` from Test / Regression should map to `WARN` when a consequential gap remains unresolved but is not established as an immediate stage blocker, or `FAIL` when its defined review criteria require the gap to be resolved. It must not automatically become a production blocker.

## 9. Release Decision Contract

The Production Blocker must return exactly one final release decision:

- **BLOCK RELEASE:** A material, unresolved issue or confidence gap makes the intended production deployment unacceptable.
- **SAFE TO RELEASE:** The available evidence and effective mitigations provide sufficient confidence for the specified release scope.

A `SAFE TO RELEASE` decision must include the assessed scope and material limitations. It does not guarantee the absence of defects.

A `BLOCK RELEASE` decision must identify the specific blocker, the consequence, and the condition required to reconsider release.

If critical evidence is missing, the Production Blocker must explicitly assess whether that uncertainty itself creates unacceptable risk. It must not treat missing information as proof of a defect, or treat lack of evidence as proof of safety.

## 10. Repository Structure

Maintain each agent's detailed specification independently:

```text
docs/
└── agents/
    ├── goal-checker-agent.md
    ├── designer-agent.md
    ├── architecture-agent.md
    ├── security-agent.md
    ├── bug-bounty-agent.md
    ├── test-agent.md
    ├── production-blocker-agent.md
    ├── commit-agent.md
    ├── documentation-agent.md
    └── refactor-agent.md
```

`commit-agent.md` defines the commit-creation workflow, `documentation-agent.md` the writing of module documents under `docs/architecture/`, and `refactor-agent.md` behavior-preserving simplification of existing code. They are operational agents, not additional feature-review agents: they change files, and the review agents judge the result.

This charter defines the shared responsibilities, evidence standards, orchestration, status mapping, and release contract. Individual agent specifications define their detailed procedures, specialized verdicts, domain-specific checks, and stage-level blocking criteria.

Avoid copying the full specialized instructions into this document. Keep shared policies here and link to them from agent specifications where needed.

## 11. Development Principles

### Single responsibility

Each agent owns a distinct primary review question. Supporting findings are allowed, but duplicate investigations should be minimized.

### Evidence over checklists

Use checklists as prompts for risk discovery, not as proof that a review is complete. Every material conclusion must be grounded in the assessed implementation and authoritative requirements.

### Risk-proportionate verification

Scale review depth to impact, exposure, complexity, and dependency surface. Do not impose identical review burdens on isolated changes and changes to critical shared infrastructure.

### No false confidence

Distinguish intended behavior, implemented behavior, verified behavior, and unresolved assumptions.

### Actionable findings

Each finding should tell the engineer what is wrong, why it matters, and what evidence or remediation is needed next.

### Minimal duplication

Share evidence references and stable finding IDs when multiple agents identify the same underlying issue. Preserve distinct consequences or perspectives without generating redundant findings.

### No automatic scope expansion

Do not introduce deferred product functionality, unapproved architecture, additional product requirements, or unnecessary tests merely because a review checklist mentions them.

### Consistent orchestration

Use the shared output contract to combine results while preserving each agent's specialist verdict and authority.

## 12. Target Outcome

A completed review should produce a concise, evidence-based assessment of all relevant engineering dimensions.

Illustrative example:

```text
FEATURE REVIEW
==============

Goal Checker
  PASS — Required behavior verified against acceptance criteria.

Designer
  PASS — No material usability or accessibility issues identified
         within the assessed scope.

Architecture
  WARN — One non-blocking maintainability concern.

Security
  PASS — No material technical vulnerability identified
         within the assessed scope.

Bug Bounty
  WARN — One low-risk abuse scenario requires follow-up.

Test / Regression
  PASS — Relevant tests inspected and executed;
         consequential regression risks have adequate coverage.

Production Blocker
  SAFE TO RELEASE — No unresolved production blockers identified
                    for the assessed release scope.

FINAL STATUS: READY FOR RELEASE
```

This example is illustrative. Actual statuses must reflect real evidence, relevant limitations, and unresolved risks.

The system's objective is not to maximize review volume or claim certainty that cannot be established.

It is to answer, with credible evidence:

**Is this feature complete, correct, usable, secure, maintainable, adequately tested, and safe to release within its intended scope?**
