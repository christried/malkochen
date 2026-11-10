# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## Ideas

An idea that isn't grilled yet is an **Idea issue**. `/capture-idea` files one in about two minutes: a few quick questions, a draft, the user's OK.

- **Title**: `Idea: <the idea in a few words>`. The prefix says what the issue is: a placeholder, not a ticket.
- **Labels**: `enhancement` + `needs-triage`, where `needs-triage` means "not grilled yet". An Idea issue waits for a grilling, not for `/triage`: it is the user's own.
- **Body**: unfinished on purpose. The idea in the user's words, where it came from (a review, a device check, a session), and, where known, what it contradicts (`CONTEXT.md`, an ADR, the design handoff) and the open questions. People appear as roles, never by name: the repo is public.
- **One idea per issue**: a note that holds several ideas becomes several issues.
- **Create**: `gh issue create --title "Idea: …" --label enhancement --label needs-triage --body-file body.md`.
- **Find**: `gh issue list --state open --label needs-triage --search "Idea in:title" --json number,title,body`. Every grilling for a next spec reads them.
- **Not a ticket**: an Idea issue is not in `docs/agents/implementation-order.md` and `/implement` never picks one up.
- **Picked up**: a grilling that takes an idea into a spec closes the Idea issue with a link to the spec, or rewrites it into one of the spec's tickets (new title, `ready-for-agent` instead of `needs-triage`). An idea too small for a spec goes into a bundle ticket. An idea the user drops is closed as not planned (`gh issue close <n> --reason "not planned"`), with the reason in a comment.
- **In a cloud session** (`CLAUDE_CODE_REMOTE=true`), `gh issue …` fails with a 403, so use REST:
  - **Create**: `gh api repos/christried/malkochen/issues -f title="Idea: …" -F body=@body.md -f "labels[]=enhancement" -f "labels[]=needs-triage"`
  - **List**: `gh api 'repos/christried/malkochen/issues?state=open&labels=needs-triage&per_page=100' --jq '[.[] | select(.pull_request | not) | {number, title}]'`
  - **Comment**: `gh api repos/christried/malkochen/issues/<n>/comments -F body=@comment.md`

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
