"""Chronological game features and a held-out ridge/normal baseline.

No betting line, game outcome, or later game is used in a game's features.
"""
from collections import defaultdict, deque
from datetime import date
import math
import numpy as np
from scipy.stats import norm
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler

FEATURES = ["home_venue", "elo_difference", "home_scoring", "away_scoring",
            "home_allowed", "away_allowed", "rest_difference"]
TEAM_ALIASES = {"LA": "LAR", "STL": "LAR", "SD": "LAC", "OAK": "LV", "JAC": "JAX"}
TEAMS = sorted("ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS".split())

def team_code(value):
    return TEAM_ALIASES.get(value, value)

def finite(value, default=0.):
    try:
        n = float(value)
        return n if math.isfinite(n) else default
    except (TypeError, ValueError):
        return default

def build_features(games):
    history = defaultdict(lambda: deque(maxlen=10))
    elo = defaultdict(lambda: 1500.)
    rows, last_season = [], None
    # Stable same-day order does not leak: each franchise plays at most once per day.
    for g in sorted(games, key=lambda x: (x['gameday'], x['game_id'])):
        season = int(g['season'])
        if last_season is not None and season != last_season:
            for t in elo: elo[t] = 1500 + (elo[t]-1500)*.67
        last_season = season
        h, a = team_code(g['home_team']), team_code(g['away_team'])
        hs, aws = finite(g['home_score']), finite(g['away_score'])
        def profile(t):
            v = list(history[t])
            return {'for': float(np.mean([x[0] for x in v])) if v else 23.,
                    'against': float(np.mean([x[1] for x in v])) if v else 23.,
                    'games': len(v), 'elo': elo[t]}
        hp, ap = profile(h), profile(a)
        venue = 0. if g.get('location', '').lower() == 'neutral' else 1.
        rest = np.clip(finite(g.get('home_rest'), 7)-finite(g.get('away_rest'), 7), -14, 14)/7
        f = [venue, (elo[h]-elo[a])/400, hp['for'], ap['for'], hp['against'], ap['against'], float(rest)]
        if min(hp['games'], ap['games']) >= 4:
            rows.append({'game_id': g['game_id'], 'date': g['gameday'], 'season': season,
                         'x': f, 'margin': hs-aws, 'total': hs+aws})
        expectation = 1/(1+10**(-(elo[h]-elo[a]+55*venue)/400))
        actual = 1. if hs>aws else 0. if hs<aws else .5
        change = 20*(actual-expectation)
        elo[h] += change; elo[a] -= change
        history[h].append((hs, aws)); history[a].append((aws, hs))
    profiles = {}
    for t in TEAMS:
        v = list(history[t])
        profiles[t] = {'for': float(np.mean([x[0] for x in v])) if v else 23.,
                       'against': float(np.mean([x[1] for x in v])) if v else 23.,
                       'games': len(v), 'elo': elo[t]}
    return rows, profiles

def _fit_model(train, calibration, target):
    x = np.asarray([r['x'] for r in train]); y = np.asarray([r[target] for r in train])
    scaler = StandardScaler().fit(x)
    reg = Ridge(alpha=20.).fit(scaler.transform(x), y)
    coef = reg.coef_/scaler.scale_
    intercept = float(reg.intercept_-np.dot(coef, scaler.mean_))
    errors = np.asarray([r[target]-(np.dot(coef, r['x'])+intercept) for r in calibration])
    offset = float(np.mean(errors))
    # Calibration only supplies intercept correction and residual dispersion.
    sd = max(1., float(np.sqrt(np.mean((errors-offset)**2))))
    return {'coefficients': coef.tolist(), 'intercept': intercept+offset, 'sd': sd}

def train(games):
    rows, profiles = build_features(games)
    dates = sorted({r['date'] for r in rows})
    if len(rows)<500 or len(dates)<100: raise ValueError('At least 500 completed games are required to train and hold out data.')
    a, b = dates[int(len(dates)*.75)], dates[int(len(dates)*.875)]
    training = [r for r in rows if r['date']<a]
    calibration = [r for r in rows if a<=r['date']<b]
    testing = [r for r in rows if r['date']>=b]
    models = {target: _fit_model(training, calibration, target) for target in ['margin','total']}
    pred = lambda r, m: float(np.dot(r['x'], m['coefficients'])+m['intercept'])
    margins = np.asarray([pred(r, models['margin']) for r in testing])
    totals = np.asarray([pred(r, models['total']) for r in testing])
    actual = np.asarray([r['margin'] for r in testing]); atotal = np.asarray([r['total'] for r in testing])
    probabilities = norm.sf(.5, loc=margins, scale=models['margin']['sd'])
    y = (actual>0).astype(float)
    base = float(np.mean([r['margin']>0 for r in training]))
    bins = []
    for i in range(10):
        mask = (probabilities>=i/10)&(probabilities<((i+1)/10 if i<9 else 1.00001))
        if mask.any(): bins.append({'predicted':float(probabilities[mask].mean()),'observed':float(y[mask].mean()),'n':int(mask.sum())})
    def period(rs): return {'start':rs[0]['date'],'end':rs[-1]['date'],'games':len(rs)}
    evaluation = {
        'training': period(training), 'calibration':period(calibration), 'test':period(testing),
        'win_brier':float(np.mean((probabilities-y)**2)), 'baseline_brier':float(np.mean((base-y)**2)),
        'win_log_loss':float(-np.mean(y*np.log(np.clip(probabilities,1e-12,1-1e-12))+(1-y)*np.log(np.clip(1-probabilities,1e-12,1-1e-12)))),
        'margin_mae':float(np.mean(np.abs(margins-actual))), 'total_mae':float(np.mean(np.abs(totals-atotal))),
        'margin_80pct_coverage':float(np.mean(np.abs(margins-actual)<=norm.ppf(.9)*models['margin']['sd'])),
        'calibration_bins': bins,
        'method':'Chronological train / calibration / held-out test by game date; rolling features use only prior completed games. Training and calibration coefficients are not refit on test outcomes.'
    }
    return {'features':FEATURES,'models':models,'teams':profiles,'evaluation':evaluation,
            'model_kind':'ridge-normal-v1','lookback_games':10,
            'limitations':['Game scores are approximated by normal distributions; football scoring patterns are not modeled.',
                          'No live injury, roster status, weather, or betting-odds feed is used.',
                          'Player estimates fit a selected historical sample; the game model backtest does not validate player props.']}
