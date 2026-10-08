# Engineering Agent System

A specialized multi-agent system for validating software features throughout the development lifecycle.

The system uses dedicated agents for requirements validation, design, architecture, security, testing, adversarial analysis, and production readiness. Each agent has a clearly defined responsibility and operates within a specific scope.

The objective is to provide a consistent and repeatable process for determining whether a feature is:

- Complete
- Correct
- Tested
- Secure
- Architecturally sound
- Usable
- Maintainable
- Ready for production

---

## Table of Contents

- [Overview](#overview)
- [Agents](#agents)

  - [Goal Checker Agent](#goal-checker-agent)
  - [Designer Agent](#designer-agent)
  - [Architecture Agent](#architecture-agent)
  - [Security Agent](#security-agent)
  - [Bug Bounty Agent](#bug-bounty-agent)
  - [Test Agent](#test-agent)
  - [Production Blocker Agent](#production-blocker-agent)

- [Agent Responsibility Matrix](#agent-responsibility-matrix)
- [Agent Lifecycle](#agent-lifecycle)
- [Execution Matrix](#execution-matrix)
- [Finding Classification](#finding-classification)
- [Agent Output Contract](#agent-output-contract)
- [Repository Structure](#repository-structure)
- [Development Principles](#development-principles)

---

# Overview

A single general-purpose review agent tends to mix unrelated concerns. This system separates those concerns into specialized agents.

Each agent answers a specific engineering question.

| Agent              | Primary Question                                                        |
| ------------------ | ----------------------------------------------------------------------- |
| Goal Checker       | Did we build everything that was requested?                             |
| Designer           | Is the user experience correct, consistent, and usable?                 |
| Architecture       | Does the implementation fit the system's architecture?                  |
| Security           | Can the implementation be exploited through technical vulnerabilities?  |
| Bug Bounty         | How could an authorized external researcher abuse or break the feature? |
| Test               | Does the implementation work and preserve existing behavior?            |
| Production Blocker | Is there anything that should prevent production deployment?            |

The agents should complement each other rather than duplicate each other's responsibilities.

---

# Agents

## Goal Checker Agent

**Specification:** [docs/agents/goal-checker-agent.md](goal-checker-agent.md)

### Purpose

Validates that the implementation satisfies the original feature requirements and acceptance criteria.

### Responsibilities

- Parse feature requirements
- Identify acceptance criteria
- Map requirements to implementation
- Identify missing functionality
- Detect partially implemented requirements
- Validate expected workflows
- Validate edge cases
- Check required error and empty states
- Verify that relevant requirements have test coverage
- Identify scope gaps
- Distinguish implementation from verification

### Primary question

> Did we build everything that was requested?

### Typical use

Run for every feature or significant change where completion must be verified against a defined specification.

---

## Designer Agent

**Specification:** [docs/agents/designer-agent.md](designer-agent.md)

### Purpose

Evaluates the user-facing experience and determines whether the implementation satisfies the product and design requirements.

### Responsibilities

- Layout and visual hierarchy
- Spacing and typography
- Design-system compliance
- Component consistency
- Responsive behavior
- Accessibility
- Loading states
- Empty states
- Error states
- Success states
- Hover, focus, active, and disabled states
- Form and validation UX
- Navigation and interaction flows
- Copy and microcopy
- Mobile, tablet, and desktop behavior
- Unnecessary interaction or visual complexity
- Compliance with supplied design specifications

### Primary question

> Is the feature clear, consistent, accessible, and usable from the user's perspective?

### Typical use

Run for user-facing changes, frontend features, workflows, and changes that affect the product's visual or interaction design.

---

## Architecture Agent

**Specification:** [docs/agents/architecture-agent.md](architecture-agent.md)

### Purpose

Evaluates whether the implementation follows the project's architectural principles and maintains long-term codebase quality.

### Responsibilities

- Layer violations
- Dependency direction
- Circular dependencies
- Module boundaries
- Coupling
- Cohesion
- Abstraction quality
- Responsibility boundaries
- Excessive complexity
- God classes and functions
- Duplicate business logic
- Incorrect ownership
- Business logic in inappropriate layers
- Architectural convention violations
- Scalability concerns
- Maintainability
- Technical debt

### Primary question

> Does this implementation fit the architecture of the system?

### Typical use

Run for major features, backend changes, new modules, shared components, architectural changes, and refactors.

---

## Security Agent

**Specification:** [docs/agents/security-agent.md](security-agent.md)

### Purpose

Performs a security-focused analysis of the implementation, configuration, data flows, and access-control model.

### Responsibilities

- Authentication
- Authorization
- Access control
- IDOR/BOLA
- Input validation
- Injection vulnerabilities
- XSS
- CSRF
- SSRF
- Session management
- Token handling
- Secrets exposure
- Sensitive data exposure
- Rate limiting
- File handling
- Tenant isolation
- Security configuration
- Dependency vulnerabilities
- Trust-boundary violations

### Primary question

> Can the implementation be exploited through a security vulnerability?

### Typical use

Run for security-sensitive features, externally accessible functionality, authentication and authorization changes, data handling, APIs, and before production deployment.

---

## Bug Bounty Agent

**Specification:** [docs/agents/bug-bounty-agent.md](bug-bounty-agent.md)

### Purpose

Performs adversarial analysis from the perspective of an authorized external security researcher.

The Bug Bounty Agent focuses particularly on unexpected attack paths, abuse cases, and business-logic vulnerabilities that may not be identified through conventional security review.

### Responsibilities

- Business-logic abuse
- Workflow bypasses
- Privilege escalation
- Account takeover paths
- Enumeration
- Race conditions
- Unexpected API parameters
- Resource exhaustion
- Quota and limit abuse
- State manipulation
- Trust-boundary violations
- Chained vulnerabilities
- Feature interaction vulnerabilities
- Abuse of legitimate functionality

### Primary question

> How could an authorized external researcher break or abuse this feature?

### Typical use

Run before production for security-sensitive, externally exposed, financially relevant, or high-impact functionality.

Testing must only be performed against systems and environments where the operator has authorization.

---

## Test Agent

**Specification:** [docs/agents/test-agent.md](test-agent.md)

### Purpose

Evaluates functional correctness, test coverage, and regression risk.

The Test Agent should not only determine whether existing tests pass. It should evaluate whether the tests adequately validate the behavior introduced by the change.

### Responsibilities

- Unit tests
- Integration tests
- End-to-end tests
- Regression tests
- Edge cases
- Error paths
- Boundary conditions
- Negative cases
- Existing behavior
- Missing coverage
- Test quality
- Flaky tests
- Incorrect assertions
- Integration coverage

### Primary question

> Does the implementation work correctly, and did it break existing behavior?

### Typical use

Run for every feature and significant code change.

---

## Production Blocker Agent

**Specification:** [docs/agents/production-blocker-agent.md](production-blocker-agent.md)

### Purpose

Acts as the final production-readiness gate.

The Production Blocker Agent consumes findings from the other agents together with build, deployment, configuration, migration, and operational information.

It determines whether any known issue is sufficiently severe to prevent production deployment.

### Responsibilities

- Critical security findings
- Failed tests
- Build failures
- Deployment failures
- Database migration risks
- Data-loss risks
- Breaking changes
- Missing production configuration
- Rollback capability
- Backward compatibility
- Severe performance issues
- Observability
- Monitoring
- Logging
- Operational failure modes
- Production environment risks

### Primary question

> Is there anything that should prevent us from safely deploying this feature?

### Typical use

Run as the final gate before production deployment.

---

# Agent Responsibility Matrix

The agents should have clearly separated responsibilities.

| Concern                   |    Goal    | Design  | Architecture |  Security  | Bug Bounty |    Test    | Production |
| ------------------------- | :--------: | :-----: | :----------: | :--------: | :--------: | :--------: | :--------: |
| Requirements completeness |  Primary   |         |              |            |            | Supporting |            |
| Acceptance criteria       |  Primary   |         |              |            |            | Supporting |            |
| UI/UX                     |            | Primary |              |            |            | Supporting |            |
| Accessibility             |            | Primary |              |            |            | Supporting |            |
| Code structure            |            |         |   Primary    |            |            | Supporting |            |
| Complexity                |            |         |   Primary    |            |            |            |            |
| Authentication            |            |         |              |  Primary   | Supporting | Supporting |    Gate    |
| Authorization             |            |         |              |  Primary   |  Primary   | Supporting |    Gate    |
| Technical vulnerabilities |            |         |              |  Primary   | Supporting |            |    Gate    |
| Business-logic abuse      |            |         |              | Supporting |  Primary   |            |    Gate    |
| Functional correctness    | Supporting |         |              |            |            |  Primary   |    Gate    |
| Regression detection      |            |         |              |            |            |  Primary   |    Gate    |
| Deployment readiness      |            |         |              | Supporting |            | Supporting |  Primary   |
| Release blocking          |            |         |              |            |            |            |  Primary   |

The **Production Blocker Agent is the final decision layer**, not a duplicate implementation reviewer.

---

# Agent Lifecycle

A typical feature should pass through the following lifecycle:

```text
Feature Specification
        |
        v
Goal Checker
        |
        v
Implementation
        |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
     Designer         Architecture           Test
        |                   |                   |
        +-------------------+-------------------+
                            |
                            v
                        Security
                            |
                            v
                       Bug Bounty
                            |
                            v
                  Production Blocker
                            |
                  +---------+---------+
                  |                   |
                BLOCK                PASS
                  |                   |
              Fix Issues           Deploy
                  |
                  v
             Re-run Agents
```

Agents may be re-run selectively after changes.

For example, a change that only addresses a UI issue may require the Designer and Test Agents to run again, while a change to authorization logic should also trigger Security and Bug Bounty analysis.

---

# Execution Matrix

| Agent              | Pull Request | Feature Completion | Pre-Release | Major Refactor | Security-Sensitive Change |
| ------------------ | :----------: | :----------------: | :---------: | :------------: | :-----------------------: |
| Goal Checker       | Recommended  |      Required      |  Optional   |  Recommended   |         Required          |
| Designer           | Conditional  |  Required for UI   | Conditional |  Conditional   |        Conditional        |
| Architecture       | Conditional  |    Recommended     | Conditional |    Required    |        Recommended        |
| Security           | Conditional  |    Recommended     |  Required   |  Conditional   |         Required          |
| Bug Bounty         | Not normally |    Conditional     |  Required   |  Conditional   |         Required          |
| Test               |   Required   |      Required      |  Required   |    Required    |         Required          |
| Production Blocker | Not normally |    Not normally    |  Required   |  Not normally  |         Required          |

The execution strategy should be configurable based on the type and risk of the change.

---

# Finding Classification

Every agent should classify findings consistently.

| Severity | Meaning                                                                                      |
| -------- | -------------------------------------------------------------------------------------------- |
| BLOCKER  | Must be resolved before the relevant workflow can proceed or production deployment can occur |
| CRITICAL | Severe issue with significant functional, security, architectural, or operational impact     |
| HIGH     | Significant issue that should normally be resolved before release                            |
| MEDIUM   | Meaningful issue that should be addressed but does not necessarily block release             |
| LOW      | Minor issue or improvement                                                                   |
| INFO     | Observation or recommendation without a direct defect                                        |

Severity describes the **impact of a finding**.

It should not automatically determine whether a production deployment is blocked.

The Production Blocker Agent makes that determination using the complete context.

---

# Agent Output Contract

All agents should produce a consistent output format.

```text
Status:
PASS | WARN | FAIL

Severity:
BLOCKER | CRITICAL | HIGH | MEDIUM | LOW | INFO

Finding:
<description>

Evidence:
<relevant files, code, tests, behavior, or other evidence>

Impact:
<why the finding matters>

Recommendation:
<recommended remediation>

Confidence:
HIGH | MEDIUM | LOW
```

For automated orchestration, agents should additionally support a machine-readable representation.

Example:

```json
{
  "agent": "security",
  "status": "fail",
  "severity": "critical",
  "blocking": true,
  "finding": "Authorization bypass",
  "evidence": "...",
  "impact": "...",
  "recommendation": "Add an ownership check before accessing the resource.",
  "confidence": "high"
}
```

---

# Blocking Model

A finding and a production blocker are not necessarily the same thing.

For example:

```text
Designer
  Medium
  Inconsistent spacing
  -> Not a production blocker

Architecture
  Medium
  Excessive coupling
  -> Technical debt; may be shippable

Security
  Critical
  Authorization bypass
  -> Production blocker

Goal Checker
  High
  Required functionality missing
  -> Production blocker

Test
  High
  Existing critical workflow broken
  -> Production blocker
```

This distinction prevents the system from becoming overly conservative while still protecting against serious release risks.

---

# Repository Structure

Agent specifications are maintained independently under `docs/agents`.

```text
docs/
└── agents/
    ├── goal-checker-agent.md
    ├── designer-agent.md
    ├── architecture-agent.md
    ├── security-agent.md
    ├── bug-bounty-agent.md
    ├── test-agent.md
    └── production-blocker-agent.md
```

Each agent specification should define:

1. Purpose
2. Scope
3. Responsibilities
4. Non-responsibilities
5. Inputs
6. Execution conditions
7. Analysis methodology
8. Severity model
9. Output contract
10. Blocking criteria
11. Examples
12. Failure handling

The root `README.md` provides the system-level overview. Individual agent specifications contain the detailed instructions required to execute each agent.

---

# Development Principles

## Single Responsibility

Each agent should have one primary responsibility.

Agents should not become generic reviewers that duplicate the work of other agents.

## Evidence-Based Findings

Agents should provide concrete evidence for findings whenever possible.

A finding should reference relevant:

- Files
- Functions
- Components
- Tests
- Requirements
- Configuration
- Runtime behavior
- Architecture rules

## Deterministic Output

Agent output should follow a predictable structure so that findings can be consumed by humans, automation, CI/CD systems, or another orchestration agent.

## No False Confidence

Agents should explicitly distinguish between:

- Verified behavior
- Inferred behavior
- Missing information
- Unverified assumptions

An agent should not report an issue as confirmed when it could not establish the evidence.

## Separation of Concerns

The agents should complement one another:

```text
Goal Checker
    -> Completeness

Designer
    -> User Experience

Architecture
    -> System Structure

Security
    -> Technical Security

Bug Bounty
    -> Adversarial Abuse

Test
    -> Functional Correctness

Production Blocker
    -> Release Readiness
```

## Final Release Decision

The Production Blocker Agent should consume the findings from the other agents rather than attempting to reproduce every analysis itself.

Its purpose is to determine whether the known state of the feature is acceptable for production deployment.

---

# Target Outcome

A completed feature review should provide a concise, evidence-based status across all relevant engineering dimensions.

Example:

```text
FEATURE REVIEW
==============

Goal Checker
  PASS
  14/14 requirements implemented

Designer
  PASS
  No blocking UX issues

Architecture
  WARN
  1 medium complexity issue

Security
  PASS
  No blocking security findings

Bug Bounty
  WARN
  2 low-risk abuse cases identified

Test
  PASS
  Required tests passing
  Regression coverage complete

Production Blocker
  PASS
  No production blockers

--------------------------------
FINAL STATUS: READY FOR RELEASE
--------------------------------
```

The objective of the agent system is not to maximize the number of findings.

The objective is to provide a reliable engineering process for answering:

> **Is this feature complete, correct, usable, secure, maintainable, tested, and safe to release?**
