# Gridiron app guide

[Project overview](../README.md) · [Technical documentation](../docs/TECHNICAL.md) · [Contributing and publishing](../docs/PUBLISHING.md)

This directory contains the static NFL probability app and its reproducible historical-data pipeline. Use the included snapshot to run the app, or install the Python data dependencies to download newer records and rebuild the game model.

## Run the app

Start from the **repository root**, `NFL_Stats` or `NFL_Stats-main`, containing this `gridiron-app` directory.

Windows:

```powershell
py -m http.server 8080 --bind 127.0.0.1 --directory gridiron-app/web
```

macOS / Linux:

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory gridiron-app/web
```

Open [http://localhost:8080](http://localhost:8080), keep the terminal open, and press **Ctrl+C** to stop. If your terminal is already inside `gridiron-app`, use `--directory web` instead. Opening `web/index.html` directly does not provide the HTTP origin needed for modules and data loading.

## Use the calculator

### Game outcomes

Choose an upcoming matchup or two different teams, then select a home win, away win, home spread cover, total over, or total under. Historical auto-fill supplies the score projection and residual variability. A custom matchup assumes a non-neutral home venue and equal rest; a listed fixture supplies the schedule's venue and rest values.

For a home spread of `-3`, the home team must win by more than three points to cover. Integer thresholds can produce a tie or push; half-point thresholds cannot. The app displays that probability separately from a successful or opposite outcome.

### Player stats and touchdowns

Select a player, a stat, an optional season, and the last 5/10/20/40/all recorded appearances. At least three matching appearances are required. Passing stats filter for quarterbacks; receiving yards and receptions filter for RB/FB/WR/TE. The team label and team filter use the player's latest recorded team, and selected history can include earlier teams.

Supported player stats are passing yards, rushing yards, receiving yards, receptions, completions, and passing touchdowns. Yardage uses a normal approximation; counts use Poisson. The **Touchdowns** tab uses rushing plus receiving touchdowns only. It excludes passing, return, defensive, and fumble-recovery touchdowns.

Source-recorded zeros and negative yardage are retained. DNPs and missing source appearances are not created as zeros. **Latest-season players** means players with a record in the latest loaded source season; it is not an active-roster or injury filter.

### Manual assumptions and scenarios

Turn historical auto-fill off, or edit a projection, to enter your own assumptions. The player adjustment applies a percentage change to the expected average; it does not run an opponent or injury model.

**Manual example** loads illustrative inputs. **Save scenario** stores the exact scenario, probability, and available historical provenance in browser storage, with a limit of 24 saved scenarios. Reloading disables auto-fill to protect those saved inputs from replacement by newer data. The saved model inputs are preserved; returning to historical auto-fill deliberately applies the currently loaded snapshot.

**Export CSV** exports saved scenarios, including probability, push probability, historical counts, and raw input JSON. CSV is an export; there is no CSV-import or account-sync feature. The optional price comparison accepts manually entered American odds and accounts for returned stakes on pushes.

## How fresh data reaches the app

The app first loads its bundled files from `web/data/`. It then checks:

```text
https://raw.githubusercontent.com/aclao89/NFL_Stats/main/gridiron-app/web/data/latest.json
```

That file contains an immutable Git commit reference. All remote manifest, model, player-index, and player-history requests use that commit. This keeps one snapshot consistent while GitHub caches update. A cached pointer can temporarily select an older complete snapshot.

The data panel identifies **Published GitHub data** or **Included data snapshot**. If the remote read fails, the included snapshot remains usable. A snapshot older than seven days is flagged. **Check for updates** retries the published-data read; it does not download source CSVs or retrain the model.

## Automatic refresh workflow

The workflow is [`.github/workflows/gridiron-refresh.yml`](../.github/workflows/gridiron-refresh.yml):

- Tuesday and Thursday at **12:17 UTC**.
- Manual dispatch from **Actions → Refresh Gridiron NFL data → Run workflow**, selecting `main`.
- Pushes to `main` affecting the refresh workflow, `gridiron-app/gridiron/**`, or `gridiron-app/requirements.txt`.

It installs the pinned dependencies, runs Python and Node tests, downloads the configured historical and current-season data with `--force`, retrains, validates, creates a data commit and a pointer commit, pushes them together, and uploads the static app as a run artifact. The writer uses GitHub's automatic `GITHUB_TOKEN` with `contents: write`.

The schedule requires the workflow on the default branch and Actions enabled. The checkout and publishing destination are explicitly `main`. Branch protections can prevent automatic publishing. Scheduled runs can be delayed, and public-repository schedules can be disabled after inactivity; inspect the [Actions page](https://github.com/aclao89/NFL_Stats/actions) if the snapshot stops advancing.

## Refresh or backfill locally

Use **Python 3.12**, matching CI, for the documented data-pipeline environment. Node 22 is used for JavaScript tests. Python dependencies are pinned in [`requirements.txt`](requirements.txt).

These commands start at the **repository root** and then change into `gridiron-app`. A virtual environment keeps the pipeline dependencies together. Calling its Python executable directly also avoids shell activation differences.

Windows:

```powershell
cd gridiron-app
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m gridiron.refresh --force
.\.venv\Scripts\python.exe -m gridiron.validate web/data
```

macOS / Linux:

```bash
cd gridiron-app
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m gridiron.refresh --force
.venv/bin/python -m gridiron.validate web/data
```

Defaults are 2015–current NFL season for completed game results and 2021–current NFL season for player stats. January and February use the previous NFL season. The CLI supports:

| Option | Default / purpose |
| --- | --- |
| `--start-season` | `2015`; earliest completed game season. |
| `--player-start` | `2021`; earliest player-stat season. |
| `--through` | Current NFL season; latest completed-game/player-stat season to import. |
| `--output` | `web/data`; destination snapshot directory. |
| `--cache` | `.cache/gridiron`; raw player-download cache. |
| `--force` | Re-download all player seasons instead of reusing eligible cached seasons. Schedules are fetched on every run. |

Seasons must satisfy `1999 ≤ start-season ≤ player-start ≤ through ≤ current calendar year`. Training also requires enough completed games for separate training, calibration, and test periods. Use the virtual-environment Python from above with `-m gridiron.refresh --help` to see the CLI options.

A local refresh replaces the files in the selected output directory; it does not push them to GitHub or update the hosted app's bundled files. Use the GitHub workflow to publish the shared feed and its pointer. Manual publication of local output must keep the data commit and `latest.json` pointer aligned; see [the publishing contract](../docs/TECHNICAL.md#immutable-feed-publishing-contract).

## Run checks

From `gridiron-app`, after installing the dependencies above:

Windows:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/model.test.mjs tests/historical.test.mjs
.\.venv\Scripts\python.exe -m gridiron.validate web/data
```

macOS / Linux:

```bash
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/model.test.mjs tests/historical.test.mjs
.venv/bin/python -m gridiron.validate web/data
```

The current suite has five Python tests and twelve Node tests, including all 992 distinct home/away team pairings. CI runs the suite and snapshot validation on app and workflow changes. Documentation-only changes outside those path filters do not trigger the app workflow.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `py` or `python3` is not recognized | Install [Python](https://www.python.org/downloads/), reopen the terminal, and use the launcher available on your system. |
| `py -3.12` or `python3.12` is not found | Install Python 3.12 for the pipeline environment. The simple app launch can use another installed Python 3. |
| `cd NFL_Stats` cannot find the folder | Check where you extracted/cloned the project and its exact name, which may be `NFL_Stats-main`. |
| Directory listing or `404` at localhost | Run from the folder containing `gridiron-app`, and keep `--directory gridiron-app/web`; from inside the app folder, use `--directory web`. |
| Port 8080 is already in use | Change `8080` to `8081` in the command and open `http://localhost:8081`. |
| App fails when opened as a file | Start the HTTP server and open its localhost URL. |
| Included data is shown | Check internet access and the latest refresh run; then select **Check for updates**. The included snapshot remains available while the feed is unavailable. |
| Player is absent or sample is too small | Clear team/search filters, include earlier seasons, or widen the appearance window. Missing appearances are not inferred. |
| Editing or reloading turns auto-fill off | This preserves the selected manual/saved assumptions. Re-enable it to apply the currently loaded historical data. |
| Saved scenarios seem missing | Use the same browser and origin as before. Hosted and localhost storage are separate; clearing browser data removes saved scenarios. |
| Refresh ran, but cutoffs did not change | Check the manifest's separate source cutoffs and warnings. A successful download does not guarantee newer source records exist. |
| GitHub workflow cannot push | Inspect permissions, `main` branch protections, and the run logs. Retain the last published pointer while resolving the failure. |

## Hosting and development

Serve or deploy the contents of `web/` as static assets with `index.html` at the site's root. Use a static host with correct MIME types for `.mjs`, JSON, CSS, and SVG and with public HTTPS access to the GitHub raw-data origin. Local scenario storage remains specific to each hosting origin.

Frontend source edits require updating the deployed static app. New published data is read through the GitHub feed without redeploying the frontend. The hosted private instance uses the same frontend with a separate hosting sign-in gate; the GitHub Actions data workflow does not itself deploy that instance.

For a fork, change `DEFAULT_REMOTE` in [`web/historical.mjs`](web/historical.mjs), review the workflow's hardcoded `main` branch, and update project links. For architecture, schemas, formulas, and operational recovery, see [the technical documentation](../docs/TECHNICAL.md).
