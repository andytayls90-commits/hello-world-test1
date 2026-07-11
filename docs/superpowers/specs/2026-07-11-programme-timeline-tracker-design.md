# Re-AgentAI Programme Timeline Tracker — Design

**Date:** 2026-07-11  
**Status:** APPROVED DESIGN / IMPLEMENTATION PLANNED  
**Public repository:** `andytayls90-commits/hello-world-test1`  
**Private sources:** `andytayls90-commits/Project-wallstreet`, `andytayls90-commits/mission-control`

## Purpose

Replace the existing Hello World GitHub Pages site with a public-safe programme oversight surface that shows current progress, timeline variance, active work, blockers, evidence state and next actions across Re-AgentAI.

The landing page is an executive overview. Project Wallstreet and Mission Control each have a dedicated project page.

## Architecture

```text
hello-world-test1/
├── index.html
├── project-wallstreet.html
├── mission-control.html
├── assets/
│   ├── tracker.css
│   └── tracker.js
├── data/
│   ├── programme-summary.json
│   ├── project-wallstreet.json
│   └── mission-control.json
└── GLOBAL_TIMELINE_RULE.md
```

The browser reads only public JSON committed to this repository. It does not call private repositories, private APIs or internal services.

## Executive overview

The landing page displays:

- overall programme state;
- current active task for each project;
- milestone completion and schedule variance;
- blocked or unknown work;
- latest evidence classification;
- next owner or engineering action;
- last updated timestamp;
- links to each project page.

## Project pages

Each project page displays:

- milestone timeline;
- completed, in-progress, blocked and planned tasks;
- task owner;
- start and completion timestamps;
- target dates where defined;
- evidence classification;
- abbreviated public-safe commit SHA;
- current blockers and next action;
- recent status history.

## Phase A — manually maintained public data

Claude or the active agent updates the relevant public JSON whenever a task:

1. is selected or claimed;
2. starts;
3. changes scope or owner;
4. becomes blocked;
5. resumes;
6. completes;
7. is superseded or cancelled.

The tracker update is part of the task lifecycle, not optional reporting after the work.

## Phase B — future automated publication

Later, each private repository may use a GitHub Action to:

1. read committed milestone and review files;
2. transform them into the same public JSON schema;
3. validate all output through an explicit allowlist;
4. publish only sanitised data to the public tracker repository.

Phase B must preserve the Phase A schema so no webpage rebuild is required.

## Public JSON contract

Each task contains:

```json
{
  "id": "M1.3",
  "title": "Canonical Account Truth + Market Clock",
  "project": "Project Wallstreet",
  "status": "IN_PROGRESS",
  "owner": "Claude",
  "started_at": "2026-07-11T12:30:00+10:00",
  "completed_at": null,
  "target_at": null,
  "evidence": "PLANNED",
  "commit": null,
  "summary": "Public-safe description",
  "blockers": [],
  "next_action": "Implement and verify PAPER preflight gates",
  "updated_at": "2026-07-11T12:30:00+10:00"
}
```

Allowed status values:

- `PLANNED`
- `READY`
- `IN_PROGRESS`
- `BLOCKED`
- `COMPLETE`
- `SUPERSEDED`
- `CANCELLED`
- `UNKNOWN`

Allowed evidence values:

- `VERIFIED LIVE`
- `SELF-VERIFIED LIVE`
- `IMPLEMENTED / UNVERIFIED`
- `PARTIAL`
- `PLANNED`
- `BLOCKED`
- `CONTRADICTED`
- `UNKNOWN`

## Staleness and error handling

- Every data file has a top-level `updated_at` timestamp.
- The UI displays a stale warning when the threshold is exceeded.
- A failed or malformed source displays `UNKNOWN`; it never silently reuses stale data as current.
- Percent completion is calculated only from explicit milestone/task states.
- Missing target dates display as unknown, not fabricated.

## Public information boundary

Only allowlisted fields may be published.

Never publish:

- secrets, credentials or tokens;
- broker account identifiers, balances, positions or orders;
- internal hosts, IP addresses, ports or private URLs;
- private file paths;
- security finding details;
- incident details that expose a control weakness;
- full private repository content;
- personal information.

## Global repository rule

The canonical policy is `GLOBAL_TIMELINE_RULE.md` in the public tracker repository. Matching repository-local instructions are installed as `AGENTS.md` in Project Wallstreet and Mission Control and are referenced by each repository's `CLAUDE.md`.

The rule requires:

1. review the tracker before selecting work;
2. reconcile tracker state with the repo and canonical backlog;
3. mark the selected task `IN_PROGRESS` before substantive implementation;
4. update immediately on block, scope change or ownership change;
5. update completion evidence and SHA before declaring a task closed;
6. review the resulting tracker state before beginning the next task;
7. withhold work when the tracker materially contradicts repository or runtime evidence.

## Acceptance tests

- Executive page loads without private authentication.
- Project pages load from their own JSON files.
- Malformed/missing JSON displays `UNKNOWN` and a visible error.
- Stale data displays a warning.
- Status filtering and timeline rendering work on mobile and desktop.
- No browser request targets private repositories or internal services.
- Secret scan finds no credentials, tokens, account data, private endpoints or internal addresses.
- Project Wallstreet and Mission Control instructions both require tracker review before work.
- Starting, blocking and completing a test task produces the expected visible transitions.

## Rollback

Restore the previous `gh-pages` commit or revert the tracker implementation commits. Policy files in private repositories may be reverted independently, but any rollback must record why timeline governance was removed.

## Implementation boundary

The design and repository rules are approved. The webpage, data files and rendering implementation must follow the committed implementation plan and the global tracker rule.