"""Download nflverse data, train the game baseline, and atomically publish JSON."""
import argparse
from collections import defaultdict
import csv
from datetime import datetime, timezone, date
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import tempfile
import time
import urllib.error
import urllib.request

from .training import train, team_code, finite, TEAMS

SCHEDULE_URL = 'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv'
PLAYER_URL = 'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{season}.csv.gz'
STAT_COLUMNS = ['passing_yards','rushing_yards','receiving_yards','receptions','completions','passing_tds','scoring_tds']
ROW_COLUMNS = ['season','week','date','team','opponent']+STAT_COLUMNS

def download(url, cache_path=None, use_cache=False):
    if use_cache and cache_path and cache_path.exists(): return cache_path.read_bytes()
    last = None
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Gridiron-NFL-Stats/2.0 (+https://github.com/aclao89/NFL_Stats)'})
            with urllib.request.urlopen(req,timeout=45) as r:
                data=r.read(40_000_001)
            if len(data)>40_000_000: raise ValueError('Upstream file exceeded the download size limit.')
            if not data: raise ValueError('Upstream returned an empty file.')
            if cache_path:
                cache_path.parent.mkdir(parents=True,exist_ok=True)
                cache_path.write_bytes(data)
            return data
        except urllib.error.HTTPError as e:
            if e.code==404: raise
            last=e
        except (OSError,TimeoutError) as e: last=e
        if attempt<2: time.sleep(attempt+1)
    raise RuntimeError(f'Cannot retrieve {url}: {last}')

def read_csv(raw, compressed=False):
    text=(gzip.decompress(raw) if compressed else raw).decode('utf-8-sig')
    return list(csv.DictReader(io.StringIO(text)))

def select_games(rows,start,today):
    required={'game_id','season','game_type','gameday','home_team','away_team','home_score','away_score'}
    if not rows or not required.issubset(rows[0]): raise ValueError('Schedule schema changed; previous snapshot has been preserved.')
    seen=set(); completed=[]; upcoming=[]
    for r in rows:
        if int(r['season'])<start or r['game_type']!='REG':continue
        key=r['game_id']
        if key in seen:raise ValueError(f'Duplicate schedule game: {key}')
        seen.add(key)
        if team_code(r['home_team']) not in TEAMS or team_code(r['away_team']) not in TEAMS:continue
        if r['home_score']!='' and r['away_score']!='' and r['gameday']<=today:
            scores=[finite(r[k],float('nan')) for k in ('home_score','away_score')]
            if not all(0<=x<=100 and int(x)==x for x in scores):raise ValueError(f'Invalid final score: {key}')
            completed.append(r)
        elif r['gameday']>=today and (date.fromisoformat(r['gameday'])-date.fromisoformat(today)).days<=28:
            upcoming.append({'id':key,'season':int(r['season']),'week':int(r['week']),'date':r['gameday'],
                             'home':team_code(r['home_team']),'away':team_code(r['away_team']),
                             'home_rest':finite(r.get('home_rest'),7),'away_rest':finite(r.get('away_rest'),7),
                             'neutral':r.get('location','').lower()=='neutral'})
    if not completed:raise ValueError('No completed games were received.')
    return sorted(completed,key=lambda r:(r['gameday'],r['game_id'])), sorted(upcoming,key=lambda r:(r['date'],r['id']))

def normalize_players(rows,games_by_id,season):
    required={'player_id','player_display_name','position','season','week','season_type','game_id','passing_yards','rushing_yards','receiving_yards','receptions','completions','passing_tds','rushing_tds','receiving_tds'}
    if not rows or not required.issubset(rows[0]):raise ValueError(f'Player stats schema changed for {season}; previous snapshot is intact.')
    result=[];seen=set()
    for r in rows:
        if r['season_type']!='REG' or r['position'] not in ['QB','RB','FB','WR','TE']:continue
        game=games_by_id.get(r['game_id'])
        # Only records joined to an already completed game may enter an estimate.
        if game is None:continue
        key=(r['player_id'],r['game_id'])
        if key in seen:raise ValueError(f'Duplicate player-game record: {key}')
        seen.add(key)
        t=team_code(r.get('team') or r.get('recent_team') or '')
        h,a=team_code(game['home_team']),team_code(game['away_team'])
        if t not in (h,a):raise ValueError(f'Player team does not match schedule: {key}')
        opp=a if t==h else h
        values=[]
        for col in STAT_COLUMNS[:-1]:
            raw=r.get(col,'')
            if raw=='': raise ValueError(f'Missing {col} in recorded player-game {key}; not replaced by a fabricated zero.')
            n=finite(raw,float('nan'))
            if not (-1000<=n<=1000) or n!=int(n):raise ValueError(f'Invalid {col}: {key}')
            if col in ['receptions','completions','passing_tds'] and n<0:raise ValueError(f'Negative count in {col}: {key}')
            values.append(int(n))
        # Deliberately disjoint categories; do not double-count defensive/fumble TD fields.
        td=sum(int(finite(r[k])) for k in ['rushing_tds','receiving_tds'])
        row=[int(r['season']),int(r['week']),game['gameday'],t,opp]+values+[td]
        result.append((r['player_id'],r['player_display_name'],r['position'],row))
    return result

def write_json(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n')

def refresh(output,start_season=2015,player_start=2021,through=None,cache=None,force=False):
    now=datetime.now(timezone.utc)
    today=now.date().isoformat()
    through=through or (now.year if now.month>=3 else now.year-1)
    if not (1999<=start_season<=player_start<=through<=now.year):raise ValueError('Choose ordered seasons from 1999 through the current year.')
    output=Path(output).resolve();cache=Path(cache or '.cache/gridiron').resolve()
    raw=download(SCHEDULE_URL)
    games,upcoming=select_games(read_csv(raw),start_season,today)
    games=[g for g in games if int(g['season'])<=through]
    games_by_id={g['game_id']:g for g in games}
    sources=[{'url':SCHEDULE_URL,'sha256':hashlib.sha256(raw).hexdigest()}]
    player_records=[];available=[];warnings=[]
    for season in range(player_start,through+1):
        url=PLAYER_URL.format(season=season)
        try:
            payload=download(url,cache/f'players-{season}.csv.gz',use_cache=not force and season<through-1)
        except urllib.error.HTTPError as e:
            if e.code==404 and season==through:
                warnings.append(f'{season} player stats are not yet published; no current-season rows were invented.');continue
            raise
        rows=normalize_players(read_csv(payload,True),games_by_id,season)
        if not rows:raise ValueError(f'No usable player rows in {season}.')
        player_records.extend(rows);available.append(season)
        sources.append({'url':url,'sha256':hashlib.sha256(payload).hexdigest()})
        print(f'Player season {season}: {len(rows):,} recorded offensive appearances',flush=True)
    if not player_records:raise ValueError('No player statistics were loaded.')
    model=train(games)
    digest=hashlib.sha256(json.dumps(sources,sort_keys=True).encode()).hexdigest()[:16]
    version=now.strftime('%Y%m%dT%H%M%SZ')+'-'+digest
    model.update({'version':version,'as_of':max(g['gameday'] for g in games),'upcoming':upcoming})
    grouped=defaultdict(list);meta={}
    for pid,name,pos,row in player_records:
        grouped[pid].append(row);meta[pid]=(name,pos)
    chunks=defaultdict(dict);index=[]
    for pid,history in grouped.items():
        history.sort(key=lambda r:(r[2],r[0],r[1]))
        last=history[-1];name,pos=meta[pid]
        item={'id':pid,'name':name,'position':pos,'team':last[3],'last_date':last[2], 'last_season':last[0], 'games':len(history)}
        index.append(item);chunks[last[3]][pid]={'metadata':item,'games':history}
    # Each dataset advertises its own coverage; source publication can lag completed games.
    latest_player=max(r[3][2] for r in player_records)
    latest_season=max(available)
    latest_week=max(r[3][1] for r in player_records if r[3][0]==latest_season)
    if latest_player<model['as_of']:warnings.append(f'Player stats currently end {latest_player}; completed game scores end {model["as_of"]}.')
    manifest={'schema_version':1,'version':version,'generated_at':now.isoformat(),'game_seasons':[start_season,through],
              'player_seasons':available,'completed_games':len(games),'player_appearances':len(player_records),'players':len(index),
              'latest_game_date':model['as_of'],'latest_player_date':latest_player,'latest_player_season':latest_season,'latest_player_week':latest_week,
              'row_columns':ROW_COLUMNS,'warnings':warnings,'sources':sources,
              'scoring_td_scope':'Rushing + receiving touchdowns only; excludes passing, return, defensive, and fumble-recovery touchdowns.',
              'attribution':'Data: nflverse / nflverse-data and nfldata (Lee Sharpe), CC BY 4.0. App derives cleaned histories, rolling features, and statistical estimates.',
              'sample_definition':'Recorded regular-season QB/RB/FB/WR/TE appearances joined to completed schedules. Source-recorded zero stats are retained. DNPs and appearances without a source record are not inferred as zero; no starting-role or injury availability is assumed.'}
    output.parent.mkdir(parents=True,exist_ok=True)
    stage=Path(tempfile.mkdtemp(prefix='.gridiron-build-',dir=output.parent))
    previous=output.with_name(output.name+'.previous')
    try:
        write_json(stage/'models.json',model)
        write_json(stage/'player-index.json',{'version':version,'players':sorted(index,key=lambda p:p['name'])})
        for t,players in chunks.items():write_json(stage/f'players-{t}.json',{'version':version,'players':players})
        write_json(stage/'manifest.json',manifest)
        if previous.exists():shutil.rmtree(previous)
        if output.exists():os.replace(output,previous)
        try:os.replace(stage,output)
        except BaseException:
            if previous.exists():os.replace(previous,output)
            raise
        if previous.exists():shutil.rmtree(previous)
    finally:
        if stage.exists():shutil.rmtree(stage)
    print(json.dumps({'version':version,'games':len(games),'player_rows':len(player_records),'latest_game':model['as_of'],
                      'latest_player':latest_player,'test_brier':model['evaluation']['win_brier'],'output':str(output)}),flush=True)
    return manifest,model

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',default='web/data');p.add_argument('--start-season',type=int,default=2015)
    p.add_argument('--player-start',type=int,default=2021);p.add_argument('--through',type=int)
    p.add_argument('--cache',default='.cache/gridiron');p.add_argument('--force',action='store_true')
    a=p.parse_args();refresh(a.output,a.start_season,a.player_start,a.through,a.cache,a.force)

if __name__=='__main__':main()
