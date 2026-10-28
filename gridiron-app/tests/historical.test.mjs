import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gameProjection,selectPlayerSample} from '../web/historical.mjs';
import {analyze} from '../web/model.mjs';

test('all historical matchup projections produce valid probabilities',()=>{
  const model=JSON.parse(readFileSync(new URL('../web/data/models.json',import.meta.url)));
  const teams=Object.keys(model.teams);
  for(const h of teams)for(const a of teams)if(h!==a){
    const g={...gameProjection(model,h,a),event:'home_win',spread:-3.5,total:45.5};
    const r=analyze('game',{game:g});assert.ok(r.p>=0&&r.p<=1);assert.ok(Math.abs(r.p+r.push+r.lose-1)<1e-8);
  }
});
test('player windows and seasons preserve zeros and reject undersized samples',()=>{
  const columns=['season','week','date','team','opponent','rushing_yards','scoring_tds'];
  const player={games:[[2025,1,'2025-09-01','IND','WAS',0,0],[2025,2,'2025-09-08','IND','WAS',-2,0],[2026,1,'2026-09-01','IND','WAS',20,1],[2026,2,'2026-09-08','IND','WAS',40,0],[2026,3,'2026-09-15','IND','WAS',0,0]]};
  const s=selectPlayerSample(player,columns,'scoring_tds',3,'all');assert.deepEqual(s.values,[1,0,0]);assert.equal(s.mean,1/3);
  const yards=selectPlayerSample(player,columns,'rushing_yards','all','all');assert.equal(yards.n,5);assert.equal(yards.values[1],-2);
  assert.throws(()=>selectPlayerSample(player,columns,'rushing_yards',10,'2025'));
});
