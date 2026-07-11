# Re-AgentAI Programme Tracker

Public-safe executive and project timeline for Project Wallstreet and Mission Control.

## Review before work

1. Read `GLOBAL_TIMELINE_RULE.md`.
2. Review the executive page and the relevant project page.
3. Reconcile the public state with the private repository, committed milestone evidence and canonical backlog.

## Mark a task in progress

```bash
node scripts/update-task.mjs \
  --project project-wallstreet \
  --task M1.3 \
  --status IN_PROGRESS \
  --owner Claude \
  --evidence PLANNED \
  --commit null \
  --summary "Implement public-safe PAPER preflight truth checks" \
  --next "Run fail-first tests"
```

## Mark a task complete

```bash
node scripts/update-task.mjs \
  --project project-wallstreet \
  --task M1.3 \
  --status COMPLETE \
  --owner Claude \
  --evidence "SELF-VERIFIED LIVE" \
  --commit abcdef1 \
  --summary "Pre-submit truth checks deployed and verified in PAPER" \
  --next "Run the integrated M1 review"
```

## Validate before commit

```bash
npm test
npm run validate
```

Commit the relevant project JSON and `data/programme-summary.json` together. Review the rendered Pages result before beginning the next task.

Never place private runtime, credential, account, security or incident details in public JSON.
