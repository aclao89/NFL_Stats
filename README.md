# Gridiron — NFL Probability Lab

An NFL analysis app that turns a matchup, player stat, or touchdown scenario into an estimated probability. Start with historical NFL results, adjust the assumptions, and compare outcomes in your browser.

[Open the hosted app](https://gridiron-probability-lab.alexclao89.chatgpt.site) · [App guide](gridiron-app/README.md) · [Technical documentation](docs/TECHNICAL.md) · [Contributing and publishing](docs/PUBLISHING.md)

The hosted instance is private and requires an authorized ChatGPT account. You can also run the app on your own computer using the steps below.

## What you can analyze

| Scenario | Inputs and output |
| --- | --- |
| Game outcomes | Select teams or an upcoming matchup; estimate a home/away win, home spread cover, or game total over/under. |
| Player stats | Select a player, stat, seasons, and sample window; estimate the chance of exceeding or falling below your threshold. |
| Touchdowns | Estimate zero, exactly a selected number, or at least a selected number of rushing plus receiving touchdowns. |
| Your own assumptions | Edit projected averages, variability, or player adjustments and see the probability change. |
| Saved scenarios | Save up to 24 scenarios in your browser, restore their inputs, copy a result, and export CSV. |

The app reports model estimates. Its game-model backtest is separate from the historical player hit rates; player estimates have not been validated by that game backtest.

## Launch on your computer

You need Python 3 and a modern browser to serve the app locally. The app includes a data snapshot and calculates probabilities in the browser. Python's standard library is sufficient for this step; the data-pipeline dependencies are installed separately only when you want to refresh or train locally.

### 1. Get the repository

With Git installed:

```bash
git clone https://github.com/aclao89/NFL_Stats.git
cd NFL_Stats
```

Or choose **Code → Download ZIP** on [GitHub](https://github.com/aclao89/NFL_Stats), extract it, and open a terminal in the extracted folder. A ZIP download usually produces a folder named `NFL_Stats-main`.

**Run the launch command from the repository root: the folder containing `gridiron-app`.** If you are in its parent folder, first run `cd NFL_Stats` or `cd NFL_Stats-main`, matching the folder on your computer.

### 2. Start the local server

Windows, in PowerShell or Command Prompt:

```powershell
py -m http.server 8080 --bind 127.0.0.1 --directory gridiron-app/web
```

macOS or Linux, in Terminal:

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory gridiron-app/web
```

### 3. Open the app

Visit **[http://localhost:8080](http://localhost:8080)**. Keep the terminal open while using it; press **Ctrl+C** in the terminal to stop the server.

Serve the app over HTTP rather than opening `index.html` directly: its JavaScript modules and JSON data need an HTTP origin.

## Your first prediction

1. Choose **Game outcomes**, **Player stats**, or **Touchdowns**.
2. Leave **Auto-fill from historical NFL data** enabled to use recorded results as the starting point.
3. Select the matchup or player. For player stats, select a stat and a sample window of 5, 10, 20, 40, or all recorded appearances, with an optional season filter.
4. Enter your desired threshold or event. For example, choose passing yards and an over/under threshold of `249.5`.
5. Read the estimated chance, displayed assumptions, and historical sample information. Editing a projection switches historical auto-fill off so your scenario controls the result.
6. Select **Save scenario** to keep the exact inputs, or **Copy result** to share the text. Use **Export CSV** to download saved results.

Initial player thresholds are near the historical sample average; they are not live market lines. A player selection indicates recorded history, not current availability or a starting role.

## Historical data and automatic updates

The default pipeline uses completed regular-season **game results from 2015 onward** and recorded regular-season **QB/RB/FB/WR/TE player appearances from 2021 onward**. Each refresh extends through the current NFL season, as source data becomes available. Earlier history can be configured in the [app guide](gridiron-app/README.md#refresh-or-backfill-locally).

[GitHub Actions](https://github.com/aclao89/NFL_Stats/actions) refreshes the historical and current-season data, rebuilds the game model, checks the result, and publishes a complete snapshot:

| Trigger | Timing |
| --- | --- |
| Scheduled refresh | Tuesdays and Thursdays at **12:17 UTC**: 5:17 AM Pacific during daylight saving time, 4:17 AM during standard time. |
| Manual refresh | **Actions → Refresh Gridiron NFL data → Run workflow**, selecting `main`. |
| Pipeline changes | Changes to the refresh workflow, Python pipeline, or requirements pushed to `main`. |

The app loads its included snapshot first, then checks a published GitHub pointer and reads all data files from one immutable commit. **Check for updates** repeats that read; it does not start a training job. Internet access is needed to retrieve newer data.

The data panel shows completed-game and player-stat cutoffs separately. Source publication, corrections, and GitHub scheduling can introduce delays, so a new refresh timestamp does not imply live coverage.

## Project layout

| Path | Purpose |
| --- | --- |
| [`gridiron-app/web/`](gridiron-app/web/) | Static app, probability engine, historical-data controller, and bundled JSON snapshot. |
| [`gridiron-app/gridiron/`](gridiron-app/gridiron/) | Python download, normalization, model training, and validation pipeline. |
| [`gridiron-app/tests/`](gridiron-app/tests/) | Python and Node tests. |
| [`.github/workflows/`](.github/workflows/) | App checks and automatic data refresh. |
| [`docs/TECHNICAL.md`](docs/TECHNICAL.md) | Architecture, data schemas, formulas, validation, deployment, and maintenance. |
| [`docs/PUBLISHING.md`](docs/PUBLISHING.md) | Applying documentation updates and pushing a branch for review. |
| [`docs/legacy-qb-analysis.md`](docs/legacy-qb-analysis.md) | Original quarterback-analysis narrative and figures. |

The original notebooks and `Images/` remain part of the repository. Their historical analysis is independent of the current probability app.

## Model scope and saved data

Game projections use prior team results, Elo, venue, and rest. Player estimates use the selected historical sample. The app has no live injury, depth-chart, weather, roster-availability, or odds feed. Touchdown estimates cover **rushing plus receiving touchdowns**; passing touchdowns are a separate player-stat option.

Scenarios stay in your browser's local storage. They are not uploaded to GitHub or synchronized between devices, browsers, the hosted app, and `localhost`. Export CSV before clearing browser data or moving to another device.

For setup failures, see [troubleshooting](gridiron-app/README.md#troubleshooting). For formulas, assumptions, checks, and how to change the data window, see the [technical guide](docs/TECHNICAL.md).

## Data attribution

Data: [nflverse/nflverse-data](https://github.com/nflverse/nflverse-data) and [nflverse/nfldata](https://github.com/nflverse/nfldata), including schedules maintained by Lee Sharpe. The app preserves upstream attribution and records source URLs and SHA-256 hashes in each snapshot manifest. It transforms the inputs into cleaned histories, rolling features, fitted models, and displayed estimates.

See [nflverse's licensing information](https://github.com/nflverse#licensing), the [player-stat documentation](https://nflreadr.nflverse.com/reference/load_player_stats.html), and the [source update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html). No FTN charting data is used.
