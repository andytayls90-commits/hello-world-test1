# Global Timeline Tracker Rule

**Applies to:** Project Wallstreet, Mission Control, and work that changes their programme state.  
**Public tracker repository:** `andytayls90-commits/hello-world-test1`  
**Status:** MANDATORY

## Rule

No substantive task may begin until the active agent has reviewed the public programme tracker, reconciled it against the current repository and canonical backlog, and confirmed that the selected task is the correct next action.

The tracker is part of the work system. It must reflect work-as-done, not handover narrative.

## Before starting any task

The active agent must:

1. fetch the current repository baseline;
2. read the repository `CLAUDE.md` and `AGENTS.md`;
3. review the executive tracker and the relevant project page/data;
4. reconcile tracker state against:
   - current branch and commit;
   - committed milestone/review documents;
   - canonical backlog or mission store;
   - known runtime evidence where applicable;
5. identify contradictions, stale status or missing work;
6. correct the public-safe tracker record before substantive implementation;
7. set the selected task to `IN_PROGRESS`, including owner, start time, public-safe summary and next action.

If the tracker materially contradicts source, backlog or runtime evidence, work is `BLOCKED` until the contradiction is corrected or explicitly recorded.

## During work

Update the tracker immediately when:

- scope changes;
- ownership changes;
- a dependency appears;
- work becomes blocked;
- a blocker clears;
- the target date changes;
- evidence contradicts the original plan;
- a task is superseded or cancelled.

Do not wait until the end of a long session to record a material status change.

## Before declaring completion

The active agent must:

1. run the required tests and negative-path tests;
2. verify runtime behaviour where the task requires runtime proof;
3. record the final evidence classification;
4. add the public-safe abbreviated commit SHA;
5. record completion time, outcome, unresolved risks and next action;
6. change the task to `COMPLETE` only when the committed evidence supports it;
7. update the executive summary and project timeline;
8. review the rendered tracker state before starting or claiming the next task.

A task is not closed merely because code was committed. The tracker update is part of the completion criteria.

## Phase A update command

Use `node scripts/update-task.mjs` for every task transition, then run:

```bash
npm test
npm run validate
```

Commit the relevant project JSON and `data/programme-summary.json` together. Review the rendered Pages result before beginning the next task.

## Public information boundary

Tracker updates must never publish:

- credentials, secrets or tokens;
- broker account identifiers, balances, positions or orders;
- internal hostnames, IPs, ports or private URLs;
- private paths or raw logs;
- exploitable security or incident details;
- personal information;
- full private-repository content.

Use public-safe summaries and abbreviated commit SHAs only.

## Allowed status values

`PLANNED` · `READY` · `IN_PROGRESS` · `BLOCKED` · `COMPLETE` · `SUPERSEDED` · `CANCELLED` · `UNKNOWN`

## Allowed evidence values

`VERIFIED LIVE` · `SELF-VERIFIED LIVE` · `IMPLEMENTED / UNVERIFIED` · `PARTIAL` · `PLANNED` · `BLOCKED` · `CONTRADICTED` · `UNKNOWN`

## Failure handling

If the public tracker is unavailable:

- do not fabricate an update;
- record the outage in the repository task evidence;
- continue only when delay would create a greater operational risk;
- publish the missed transition as soon as the tracker is restored;
- mark the interval as `TRACKER_UPDATE_DELAYED` in the public-safe history.

## Bootstrap exception

The first tracker implementation task may proceed after reviewing the approved design specification because the public JSON files and project pages do not yet exist. That task must create the initial timeline from committed evidence and then activate this rule without further exception.

## Enforcement outcome

A change packet that omits required tracker review or status updates is `PARTIAL` and cannot be represented as fully closed.
