"""Validate snapshot schemas, temporal boundaries, integrity, and numerical outputs."""
import json
import math
from pathlib import Path
import sys

def validate(folder):
    folder=Path(folder)
    load=lambda f: json.loads((folder/f).read_text())
    m=load('manifest.json');model=load('models.json');index=load('player-index.json')
    assert m['schema_version']==1
    assert model['version']==index['version']==m['version']
    assert m['latest_player_date']<=m['latest_game_date']
    e=model['evaluation']
    assert e['training']['end']<e['calibration']['start']<=e['calibration']['end']<e['test']['start']<=e['test']['end']
    assert 0<=e['win_brier']<=1 and 0<=e['baseline_brier']<=1
    for mod in model['models'].values():
        assert len(mod['coefficients'])==len(model['features'])
        assert all(math.isfinite(x) for x in mod['coefficients']+[mod['intercept'],mod['sd']]) and mod['sd']>0
    records=0;ids=set();by_id={p['id']:p for p in index['players']}
    assert len(by_id)==len(index['players'])==m['players']
    for file in sorted(folder.glob('players-*.json')):
        chunk=load(file.name);assert chunk['version']==m['version']
        for pid,p in chunk['players'].items():
            assert pid not in ids;ids.add(pid)
            assert p['metadata']==by_id[pid]
            last='';seen=set()
            for row in p['games']:
                assert len(row)==len(m['row_columns'])
                assert row[2]>=last and row[2]<=m['latest_game_date'];last=row[2]
                key=(row[0],row[1]);assert key not in seen;seen.add(key)
                assert all(isinstance(n,int) for n in row[5:])
                assert all(n>=0 for n in row[8:])
                records+=1
            assert p['metadata']['games']==len(p['games'])
    assert ids==set(by_id) and records==m['player_appearances']
    print(f'Snapshot verified: {m["completed_games"]:,} completed games, {len(ids):,} players, {records:,} recorded appearances; chronological model splits are disjoint.')
    return m

if __name__=='__main__':validate(sys.argv[1] if len(sys.argv)>1 else 'web/data')
