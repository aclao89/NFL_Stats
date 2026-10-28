# Gridiron — NFL Probability Lab

An actual NFL data app, extending the original probability calculator. Includes a usable historical snapshot, a reproducible Python data pipeline, trained game projections, a chronological game backtest, and scheduled GitHub Actions refreshes. No paid stats key is required.

The existing repository's 2020/2021 notebooks and images are preserved.

## Run the app

The frontend is buildless and includes its data. From the repository root:

```bash
python -m http.server 8080 --directory gridiron-app/web
```

Open `http://localhost:8080`. A Python backend is not needed to use the app. ES modules require HTTP; do not double-click `index.html`.

## What it does

- **Game outcomes:** choose an upcoming matchup or any two teams. Historical mode estimates score margin, total points, and residual variability using completed regular-season games since 2015. Predict a winner, home spread cover, or over/under total. Ties and integer-line pushes are separate.
- **Player stats:** select a recorded QB, RB, FB, WR, or TE, a stat, seasons, and the last 5/10/20/40/all recorded appearances. The selected sample fills the mean, SD, historical hit rate, and uncertainty interval. Enter your desired threshold. Initial player lines are near the sample mean; they are not sportsbook lines.
- **Touchdowns:** estimates rushing plus receiving touchdowns. This deliberately excludes passing, return, defensive, and fumble-recovery touchdowns. Passing TDs have a separate Player stats option.
- **Editable scenarios:** turn historical auto-fill off or edit a projection. Your assumptions replace the historical baseline. Saved scenarios retain their exact inputs, sample provenance, and as-of date; reloading them disables auto-fill so new data cannot overwrite them.
- **Evidence:** the model report shows data coverage, train/calibration/test periods, Brier scores, score errors, and limitations. The player empirical check is not a player forecasting backtest.
- **Portability:** save scenarios in browser storage, copy results, export CSV, or host `web/` on a static web server. User scenarios do not get uploaded to GitHub.

## Refresh and backfill

Python 3.11+ is required for the pinned data dependencies; CI uses Python 3.12. From `gridiron-app/`:

```bash
python -m venv .venv
# Activate .venv for your shell, then:
python -m pip install -r requirements.txt
python -m gridiron.refresh
python -m gridiron.validate web/data
```

Defaults: completed **2015–current NFL season games**, **2021–current NFL season player stats**. January and February belong to the preceding NFL season. Use `--start-season`, `--player-start`, and `--through` to change the window. For a full source re-download, pass `--force`. Raw cached downloads are ignored by Git.

The pipeline validates source schemas and duplicate keys, joins player rows only to completed games, preserves recorded zeros and negative yardage, and publishes all JSON files as a single snapshot. A failed refresh leaves the last complete snapshot intact. Files include version identifiers and source hashes; frontend version checks reject mixed snapshots.

Only QB/RB/FB/WR/TE source-recorded regular-season appearances enter player samples. DNPs and appearances missing from the source are **not** manufactured as zeros. Selecting a player does not establish current team membership, an active roster spot, a starting role, or injury availability. Latest source season and latest recorded team are labeled accordingly.

## Automatic weekly updates

`.github/workflows/gridiron-refresh.yml` refreshes both schedules and player stats, retrains the game baseline, validates the result, and commits `gridiron-app/web/data/` to `main`:

- Tuesday at **12:17 UTC**, after Monday games.
- Thursday at **12:17 UTC**, after midweek stat corrections.
- Also supports **Run workflow** for an immediate refresh.
- Pipeline or refresh-workflow changes on `main` also run a refresh, including the initial installation.

These are **5:17 AM Pacific during daylight saving time and 4:17 AM Pacific during standard time**. GitHub scheduled jobs may be delayed. The workflow must be on the default branch and Actions must be enabled. Protected branches that prohibit the workflow's data commit require your normal review/merge route; the app retains the previous snapshot if publishing fails. A workflow file prepared locally is not an activated schedule.

The workflow needs the repository's automatic `GITHUB_TOKEN` with `contents: write`; no personal access token or sports-provider secret belongs in the code. Public-repository scheduled workflows may be disabled after inactivity under GitHub's policies, so check the Actions page if freshness stops advancing.

On app startup the included snapshot renders first, then the app checks `gridiron-app/web/data/latest.json` on the repository's `main` branch. This pointer selects an immutable commit for every data file, so a cached pointer still returns a complete snapshot. The **Check for updates** button repeats that check. If GitHub is unavailable, the included snapshot remains usable and clearly labeled. Checking for updates does not run the Python pipeline; only the scheduled or manual refresh job publishes new data.

## Model details

Game features are each team's **prior 10** games of points scored and allowed, Elo difference, venue, and known schedule rest. Franchise aliases are normalized. A result is added to its team's history only **after** that game's features are constructed.

Game dates are partitioned chronologically into approximately 75% training, 12.5% calibration, and 12.5% held-out testing. Ridge coefficients and scaling use only training data. Calibration supplies an intercept correction and residual SD. The held-out period is excluded from fitting; earlier test-game results may enter later test-game rolling features, matching real forecasting. The published forecasts use these evaluated coefficients and current team histories. There is no random train/test split or use of closing betting lines as a feature.

Score-margin/total probabilities use a normal approximation with an integer continuity correction. Player yards use a selected-sample normal approximation; reception/completion/passing-TD counts and rushing+receiving TDs use Poisson. The player sample is equally weighted, carries across seasons when selected, and is not automatically opponent-adjusted. A constant yardage sample uses a disclosed SD floor of one unit. These baselines can miss skew, changing usage, injuries, and football scoring patterns. The game backtest must not be presented as validation of player props.

## Checks

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
node --test tests/*.test.mjs
python -m gridiron.validate web/data
```

Tests cover temporal leakage, future/unfinished games, duplicate and missing-source records, zero and negative stats, sample selection, probability conservation, spread signs, pushes, touchdown counts, and all 992 distinct home/away matchup projections. `gridiron-ci.yml` runs these checks on app changes.

## Data attribution

Data: [nflverse/nflverse-data](https://github.com/nflverse/nflverse-data) and [nflverse/nfldata](https://github.com/nflverse/nfldata), including schedules maintained by Lee Sharpe. These inputs are used under **CC BY 4.0**; attribution is preserved in the app and snapshot manifest. This app transforms the source into cleaned histories, rolling features, fitted models, and displayed estimates. No FTN charting data is used.

- [Player statistics](https://nflreadr.nflverse.com/reference/load_player_stats.html)
- [Schedule data](https://nflreadr.nflverse.com/reference/load_schedules.html)
- [Source update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html)
- [Chronological validation](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html)

NFL data availability can lag games and may be corrected later. The app displays completed-game and player-stat cutoffs separately; the refresh timestamp is not a promise of complete real-time coverage.
