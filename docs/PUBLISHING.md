# Contributing and publishing documentation

[Project README](../README.md) · [App guide](../gridiron-app/README.md) · [Technical documentation](TECHNICAL.md)

This guide explains how to apply the documentation update on your computer and push it to `aclao89/NFL_Stats`. Run repository-level Git commands from the folder containing `gridiron-app`.

## Files in this update

| Path | Action |
| --- | --- |
| `README.md` | Replace with the new project overview and local launch instructions. |
| `gridiron-app/README.md` | Replace with the expanded app, refresh, test, and troubleshooting guide. |
| `docs/TECHNICAL.md` | Add the architecture, data schema, model, feed, and operational reference. |
| `docs/PUBLISHING.md` | Add this guide. |
| `docs/legacy-qb-analysis.md` | Add the original README analysis, preserving its narrative and figures. |

The documentation ZIP mirrors these paths. Copy its contents into your repository root, merging the `docs` and `gridiron-app` folders and replacing only the listed README files. Application source, datasets, notebooks, workflows, and images are not part of this documentation update.

## If you already cloned the repository with Git

Before copying the new files, open a terminal in your clone and check your current work:

```bash
git status
```

If you have unrelated edits, commit them or set them aside using your usual Git workflow. With a clean working tree, update `main` and create a documentation branch:

```bash
git switch main
git pull --ff-only origin main
git switch -c docs/readme-and-technical-guide
```

Copy the documentation ZIP contents into this folder. Then inspect the changes:

```bash
git status --short
git diff --check
git diff -- README.md gridiron-app/README.md
```

New untracked files do not appear in `git diff` until staged. Open the three files under `docs/` to review them, then stage exactly the documentation paths:

```bash
git add README.md gridiron-app/README.md docs/TECHNICAL.md docs/PUBLISHING.md docs/legacy-qb-analysis.md
git diff --cached --stat
git diff --cached --check
git commit -m "Update README and add technical documentation"
git push -u origin docs/readme-and-technical-guide
```

Open the repository on GitHub, use **Compare & pull request**, and target `main`. Review the files and applicable checks before merging. Use a different branch name if that branch already exists. If a push is rejected because the remote changed, inspect and integrate those changes rather than force-pushing.

## If you downloaded the app as a ZIP

A downloaded source ZIP is a copy of the files, not a Git clone. For terminal-based commits and pushes, install [Git](https://git-scm.com/downloads) or use [GitHub Desktop](https://desktop.github.com/), then clone the repository into a separate folder:

```bash
git clone https://github.com/aclao89/NFL_Stats.git
cd NFL_Stats
git switch -c docs/readme-and-technical-guide
```

Copy the documentation update into that clone and follow the review, staging, commit, and push commands above. Existing scenarios in your browser are separate from repository files; export their CSV if you want a portable record.

## Checks for this documentation update

- Confirm the root launch commands use `--directory gridiron-app/web`, and commands starting inside the app use `web/data` and the local `tests` directory.
- Check relative links between the root README, app guide, technical guide, publishing guide, and archived analysis.
- Preview the Markdown and the Mermaid architecture figure on GitHub.
- Confirm that only the five listed documentation files are staged.

No application behavior changes are required for this update. The existing app CI can run because `gridiron-app/README.md` matches its path filter; the data-refresh workflow does not run for these documentation paths. Documentation edits do not require a hosted-app deployment.

For future code changes, run the [app checks](../gridiron-app/README.md#run-checks) and browser verification appropriate to the change. For source/schema changes or publishing data, follow the [technical feed contract](TECHNICAL.md#immutable-feed-publishing-contract).
