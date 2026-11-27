# Software Factory design

Status: Approved

## Product and repository boundary

Software Factory takes greenfield projects from a business requirements document (BRD) to production. Internal teams use the same Windows desktop workflow a customer would use. All routine human involvement occurs at requirements approval, spec approval, story PR merge, and production release approval. Blocked-story decisions are exceptions and cannot waive gates.

The public Software Factory repository holds this design, the implementation plan, the desktop application and the canonical project kit. It is based on Munder Difflin main at `c1eac0d2` (source version 0.6.0). The team currently runs 0.5.10. The app installs a versioned copy of the kit into each generated project at setup. The kit contains Claude Code and Codex gate hooks, stage rules, Git hooks, CI templates and a PR template. The public-content rules apply throughout the repository, including source, documentation, issues, fixtures, logs and CI output. Exclude secrets, client and project names, real ticket keys, internal hostnames and runner names, and real or private data. Use synthetic examples. Future design and plan changes require a pull request.

The pinned baseline restores eligible worker entries as sleeping at startup. Its worker reaper defaults to about 20 minutes without terminal output and applies token caps when configured. Its message delivery waits for an idle, safe prompt. The existing project-local stage policy is separate from the upstream runtime. Today the worker receives a stage marker at launch and a malformed marker can silently block all tools. The fork will reuse worker launch and worktree capabilities and add durable job recovery and explicit policy validation.

## Factory development and staging checkpoint

Develop the desktop app and project kit test-first. Write unit and integration tests before each behavior change and run both suites in CI on the public Software Factory repository. Apply the same PR merge rules as generated projects, including green CI on the exact PR head and combined commit against current main, protected main, and human-only merge.

Stop after plan step 2, when the first story is human-merged and running in AWS staging. Present its approval, acceptance test, review, CI and staging evidence for review. Step 3 requires explicit approval at this checkpoint.

## Desktop app and evidence

The desktop app owns intake, the approval inbox, the story dependency graph, the worker queue and the evidence view. A local transactional store records project and policy versions, numbered requirements and questions, approved scope and spec snapshots, stories, test mappings, job attempts, checkpoint commits, reports and external evidence references. Each approval records the actor, time and immutable revision. Upstream changes invalidate dependent evidence and return affected work to the existing approval point when meaning changes. The external CI platform remains authoritative for merge policy and production approval.

The project screen shows unanswered questions, coverage by BRD line, jobs and dependencies, the active CI enforcement path and why it was chosen, and concise recovery actions for blocked work. A project can continue independent stories while dependants wait. The app produces handover documentation and a BRD-to-story-to-code-and-test map linking commits, tests and CI or deployed results.

## Workflow and gates

| Stage | Work and required evidence |
| --- | --- |
| Scope | Number every BRD requirement, preserve source references and surface gaps or conflicts as questions. The human resolves scope and approves the requirements snapshot. |
| Spec | Produce architecture, UI and backlog with acceptance criteria and traceability. Use supplied Figma design when available, otherwise generate the UI with the design system. The human approves the spec, mapping and any deployed-environment-only labels. |
| Build | Write acceptance tests before implementation and record a failing run against the pre-build code for the expected reason. Commit the tests, then implement against them. Run lint, typecheck, format check and changed tests fresh on the laptop. |
| Review and fix | The other model verifies intent, coverage, structure and traceability on the exact candidate SHA. The original builder model fixes findings using a fresh worker with the full brief and findings, and the other model reviews the updated SHA. |
| PR | Require passing customer CI on the exact candidate head before opening a ready PR. Require combined CI with current main before human merge. A candidate branch can trigger initial CI before PR creation. |
| Security and finish | Gate staging and promotion on security and dependency checks, closed must-fix findings, CI evidence and runbook readiness. Track deployed acceptance, production approval, monitoring and rollback evidence through release completion. |

Every approved BRD line maps to specific acceptance tests. Each validation rule gets a separate test for UI and API where both exist. Every line requires PR CI coverage except a line labeled deployed-environment-only by a human at spec approval. Agents cannot add or change the label. For those lines, write the deployed check before implementation, test its logic in PR CI wherever possible, and attach a passing staging or production-drill result to the BRD line. A production-only check remains pending until the approved release run executes it and blocks release completion until it passes. Independent review checks that tests express BRD intent, every change traces to approved scope, every line is covered, and approved assertions have not been weakened. Amendments to meaning use the existing spec or requirements approval.

Claude builds most pilot stories and Codex reviews. Codex builds one or two stories and Claude reviews. Codex receives verification credit by executing lint, typecheck, format check and tests itself, since it has no Superpowers skills. Reviewers never review their own model’s work. The app permits two fix rounds per attempt. If both fail, it immediately notifies the human with failing checks, findings and both fix diffs and reports. A human can authorize one fresh attempt per story with a new worker and the full failure evidence, return the story to spec or requirements approval, or defer it. After the fresh attempt fails, the latter two options remain. Deferred requirements block release until implemented or explicitly descoped at requirements approval.

### Project kit enforcement

The app assigns one of scope, spec, build, fix, review, security, pr or finish before each launch. The versioned stage file declares required skills before the first edit and before completion, including UI and conditional skills, verification rules per provider and report headings. The app validates the whole policy, the stage assignment and the provider’s supported gates before spawning. An invalid or missing rule fails closed with a visible diagnostic identifying the invalid setting. Hooks match actual tool calls and evidence to the session, stage, policy version and job. Pre-edit protects all write paths including shell writes through worker permissions. Completion requires Summary, Validation and Risks. Review also requires Changes trace to ticket and Structure. Reports alone cannot establish success. The app verifies fresh command results and evidence before advancing the job.

The Git hooks require a ticket key in commits, forbid force pushes and pushes to main and check CI proof before pushing a change as ready. Initial candidate uploads to isolated branches permit CI to produce that proof, with no authority to advance or merge the PR. CI and repository protections enforce the corresponding server-side conditions even if local hooks or files are changed. Treat policy, acceptance evidence and release workflow changes as protected, with the trusted CI gate definition outside worker write authority. Keep provider-specific permissions narrow. Workers receive no human credentials, status publishing privileges, main push, merge, enqueue or production approval authority. CI verifies the expected check source. Git transport uses a supervised publishing operation where worker credentials cannot express the required distinction. The kit version is pinned per generated project. Changes use the project’s normal reviewed PR flow.

## GitHub Actions publisher and human merge

The publisher is a GitHub Actions workflow in the public Software Factory repository. Its protected environment requires a human reviewer and allows deployments from main only after bootstrap. The GitHub App private key is stored as an environment secret. The App identifier is configured as an environment variable. The key and installation token stay inside the publisher job. Workers, including Codex Cloud, receive only non-secret commit and pull request evidence.

Workers produce candidate commits and report the commit, expected tree and intended bot branch to the desktop orchestrator. The pilot operator dispatches the trusted main workflow with those values, and a human approves the publisher environment job. The workflow verifies that the candidate matches the reviewed tree and is based on current main. It never executes candidate code. It obtains a short-lived GitHub App token limited to this repository with Contents and Pull requests write access. Bootstrap also requires Workflows write because it introduces workflow files. The workflow publishes only to bot-owned branches, uses non-force pushes, and opens or updates PRs against protected main. The publisher exposes no merge, review, enqueue or administration operation.

The GitHub App has no bypass on protected main. Its sole bypass is on the separate ruleset governing creation and updates of bot branches. Only the bot pushes to its PR branches. Humans request changes in review and approve and merge in GitHub. A subsequent bot push requires fresh approval. Repository setup verifies whether the host can enforce bot-only writes to its branch namespace under these rules and surfaces any missing protection.

For initial setup, permit the bootstrap branch in the publisher environment for one approved run. The bootstrap workflow verifies the previously reviewed CI tree, allows only the publisher workflow as an additional file, and republishes the verified result on a bot-owned branch from current main. It links the original PR and records the App-authenticated push, bot-authored PR and published SHA. After a human merges the replacement with fresh required CI, close the original PR and restrict the publisher environment back to main.

For future workflow-file changes, have the repository owner authorize a single reviewed bootstrap run. Temporarily allow its exact control branch in the publisher environment and grant the App Workflows write. Pin the current main commit and exact workflow diff in the control run, require human environment approval, and publish a bot PR through the same required CI and human merge. Remove temporary access as soon as the workflow-change PR merges. Ordinary publication from main continues to reject workflow diffs and uses only Contents and Pull requests write.

## Recovery and Windows 11

Use isolated worktrees and short-lived workers with a complete, immutable brief. The brief includes the approved scope, expected output, constraints, validation steps and the last accepted checkpoint or findings. A running worker is never corrected by message. It commits each finished piece and records a handoff with completed steps, remaining work and validation. A checkpoint records the commit and handoff together before the job advances. The supervisor reconciles interrupted writes on startup. If a commit landed before its handoff was recorded, the supervisor reconciles the branch and reconstructs a minimal handoff from the recorded brief, completed checkpoints and commit before resuming. Uncommitted edits are isolated from resumed work.

On crash, restart, silence timeout or token cap, the scheduler reconciles worker leases, owned processes, worktrees, intent records and remote CI/PR state. It starts interrupted jobs automatically in fresh sessions from their last checkpoint, with idempotent job and publication keys to prevent duplicate PRs or CI side effects. Distinguish interrupted infrastructure work from a consumed fix round. Bound infrastructure retries and surface repeated failure with the cause. Healthy independent jobs keep moving.

Windows 11 is the pilot platform, followed by macOS and then Linux. Workers and hooks use PowerShell 7. Measure available RAM before dispatch, queue workers and heavy jobs, and run at most one heavy local job at a time, including WSL2/Docker work. Below the configured headroom, keep the job queued with a visible reason. Run the full suite on customer CI. Normalize Windows paths case-insensitively and detach dependency junctions or symlinks before removing worktrees without traversing their targets. Setup probes Git transport and provider APIs separately and diagnoses TLS interception for Git, registries and browser test tooling without disabling certificate verification. A successful API probe does not clear failed Git transport.

## Model access and data

Use existing team Claude and Codex accounts for the internal pilot. Give each worker only the project context required for its job. Keep provider credentials out of briefs, worktrees, reports and logs. The app excludes credentials, environment files and other sensitive inputs from worker-visible material, limits file access to approved context, and redacts secrets from test output and logs before model access. Use synthetic fixtures in tests. Secrets must never be sent to a model.

**Known pilot limit.** Only one Codex session can run at a time. Codex reviews queue behind active Codex builds, fixes or reviews. Revisit this limit after the pilot.

Keep one authoritative Codex login for the desktop user. A single managed Codex session at a time uses provider-managed refresh in the protected login home, with job worktrees and conversation state scoped to the job. Do not depend on a worker copying a refreshed login back at exit. Preflight login health and verify recovery from forced termination during or after refresh. If provider auth becomes invalid, pause with a reauthentication prompt and resume the durable job after login. Provider credentials are available only to the provider runtime through its supported login path.

Before any client project starts, require a project data policy at setup and display it in the project view. It names allowed providers, account requirements, retention or no-training settings, and prohibited content such as secrets, environment files and personal data in fixtures. Dispatch validates policy and blocks if requirements cannot be verified. This client-use control is outside the internal pilot milestone.

## Customer CI and protected merge

The kit runs unit, integration, Playwright end-to-end and API contract tests on customer CI. Record separate CI evidence for the exact PR head and the combined candidate against latest main, tied to head, base, candidate SHA and trusted run identity. A new head or base invalidates the corresponding evidence. Run integration CI on candidate updates and main updates, and on the merged main commit, to catch interactions across stories.

Setup detects the provider plan where available and reads effective repository and deployment settings. It verifies enforcement and displays the active path, the reason it was chosen and any blocking control. Plan detection alone cannot qualify a repository. The pilot organization’s actual plan is pending confirmation.

- GitHub merge queue path. A human enqueues the PR and GitHub can finish the merge only after required merge-group CI passes. Agent identities cannot enqueue. Configure the queue to test the candidate against current main, with one PR per merge group for the pilot.
- GitHub manual fallback. Protect main with strict required checks, a current base and human-only merge authority. Prove with a setup test PR that GitHub blocks a stale check and a failing check, including when main advances between candidate validation and merge. Evidence on the head and combined SHA must both be required. Keep merge blocked if the setup proof fails. Disable bypasses for worker identities and verify effective protections again before marking a PR eligible.
- GitHub production. Required reviewers on a protected production environment are mandatory, with the reviewers held by human accounts outside worker access. Restrict deployment inputs and refs to the trusted release workflow and prohibit bypass. For private organization repositories, GitHub documents merge queues and required deployment reviewers on Enterprise Cloud. Team’s private environments alone do not qualify. Staging can proceed while production remains blocked. Show the missing protection explicitly.
- Bitbucket later. Require Premium and prove enforced checks block stale and failing evidence. Allow one PR eligible at a time and recheck when its base changes. Verify human deployment permissions end to end. Block Bitbucket client use until those checks pass.

[GitHub merge queue availability](https://docs.github.com/en/enterprise-cloud@latest/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) · [GitHub environment protection availability](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

## AWS release and rollback

The pilot organization’s GitHub plan is unconfirmed. Proceed through staging. Before plan step 4, the product owner chooses one of three paths once the plan is confirmed: use Enterprise Cloud with a private pilot repository, use a public pilot repository with no private material and verified required reviewers, or end the pilot at staging. Changing pilot repository visibility requires a separate explicit decision. Production requires verified enforcement of human deployment reviewers regardless of the path.

Confirm the fixed target stack for generated software. A TypeScript pnpm monorepo keeps shared types, tests and CI conventions consistent. A Node API with Prisma and PostgreSQL gives a standard persistence and migration path. React and Playwright standardize UI and browser coverage. Redis supports background work, including the pilot’s job. AWS provides managed deployment, logs, monitoring and database backups. Redis and the managed services add cost and operational surface, which the single kit and runbook must make visible. A second stack would multiply the gate and deployment combinations before the team proves the first.

Customer CI builds an immutable artifact from a green main commit and deploys it to staging. It records the digest, provenance, security/dependency results, test evidence and staged acceptance results. CI requires the protected production environment’s human approval, verifies the exact staged digest before deploying and uses short-lived AWS credentials issued to CI. The desktop app links to the CI approval and shows the result. AWS credentials never reach a laptop or agent. Confirm coverage, runbook, architecture, artifact lineage, logs, monitoring and alerts, backup status and a recorded rollback baseline as part of release readiness.

Use expand/contract database changes across releases so the previous artifact works against the new schema. A destructive migration needs a separately scoped human approval inside the protected release process and a tested backup restore. CI runs a real production rollback drill on the first release, any release with a schema migration and on a schedule defaulting to monthly. For the pilot, establish a working rollback baseline before the first promotion. On drill runs, verify monitoring and alert delivery, switch to the baseline, verify health and previous-version behavior against the current schema, then restore the approved artifact after rechecking its digest. One approval covers this sequence in the same release run. A different artifact needs new approval. On failure, keep release completion blocked and execute the recovery runbook. On other releases, verify monitoring and alerts, and keep the rollback baseline available. Scheduled drills use the protected CI workflow and human approval for production access.

## Decisions made by Codex

- Use the fork’s desktop runtime and a local SQLite workflow store so checkpoints and approval revisions survive process loss.
- Use PowerShell 7 on Windows to give workers and hooks a single shell contract.
- Use one Codex session at a time against an authoritative provider login to avoid conflicting refreshes and exit-time copies.
- Use one PR per GitHub merge group for the pilot so a failing candidate has a clear owner.
- Use isolated candidate pushes before ready-PR creation so CI can validate the exact head without a circular gate.
- Use a trusted CI gate definition and supervised Git publication so project-local writes cannot grant merge or deployment authority.
- Start the Windows heavy-job queue with a configurable free-memory floor and tune it against measured WSL2 usage on pilot laptops.
- Use managed AWS containers, PostgreSQL, Redis and CloudWatch as the reference deployment to minimize platform-specific operations.
- Require the same protected CI workflow for scheduled production drills so scheduled access honors the release boundary.
