// Historical data is published as versioned, inspectable JSON; no API key is used.
import { sampleStats } from './model.mjs';
const $ = id => document.getElementById(id);
const esc = x => String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const DEFAULT_REMOTE = 'https://raw.githubusercontent.com/aclao89/NFL_Stats/main/gridiron-app/web/data/';

export function gameProjection(model, home, away, scheduled = null) {
  if (home === away) throw new Error('Choose two different teams.');
  const h=model.teams[home],a=model.teams[away];
  if (!h || !a || h.games<4 || a.games<4) throw new Error('Not enough completed team games for this matchup.');
  const rest = scheduled ? Math.max(-14,Math.min(14,scheduled.home_rest-scheduled.away_rest))/7 : 0;
  const x=[scheduled?.neutral?0:1,(h.elo-a.elo)/400,h.for,a.for,h.against,a.against,rest];
  const predict=m=>m.intercept+m.coefficients.reduce((sum,c,i)=>sum+c*x[i],0);
  const margin=predict(model.models.margin),total=predict(model.models.total);
  return {home,away,homeMean:(total+margin)/2,awayMean:(total-margin)/2,
          marginSd:model.models.margin.sd,totalSd:model.models.total.sd};
}

export function selectPlayerSample(player, columns, stat, window=10, season='all') {
  const col=columns.indexOf(stat);
  if(col<0) throw new Error('This stat is not available in the historical data.');
  let rows=player.games.filter(r=>season==='all'||r[0]===Number(season));
  if(window!=='all') rows=rows.slice(-Number(window));
  if(rows.length<3) throw new Error('At least 3 recorded appearances are needed. Widen the season or game window.');
  const values=rows.map(r=>r[col]);
  if(!values.every(Number.isFinite)) throw new Error('Some historical stats are missing. No zero values were invented.');
  return {values,rows,...sampleStats(values),first:rows[0][2],last:rows.at(-1)[2]};
}

async function json(url) {
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(18000)});
  if(!response.ok) throw new Error(`Data source returned ${response.status}.`);
  return response.json();
}

export function createHistoricalController({getState,getMode,onApply,onManual,notify}) {
  let manifest=null,model=null,index=[],base='',ready=false,serial=0,chunkCache=new Map();
  let enabled=true,selected={player:'',td:''},season='all',window=10,remoteAvailable=false,resetPlayerLine=true;
  const enabledControl=$('history-auto');
  const controller={
    get enabled(){return enabled&&ready;},
    onMode(){showControls();if(controller.enabled)applyCurrent();},
    onTeams(){ if(controller.enabled){$('history-matchup').value='';applyGame();return true;}return false;},
    onStat(){if(controller.enabled){resetPlayerLine=true;renderPlayers();applyPlayer();return true;}return false;},
    manual(){enabled=false;enabledControl.checked=false;showControls();},
    async reload(){await load();}
  };
  function status(text,warning=false){$('data-message').textContent=text;$('data-message').classList.toggle('data-warning',warning);}
  function showControls(){
    const mode=getMode();$('historical-game-controls').hidden=mode!=='game';$('historical-player-controls').hidden=mode==='game';
    $('history-controls').classList.toggle('manual',!enabled);
    $('history-control-help').textContent=enabled?'Select a matchup or player to fill the projections from recorded NFL results.':'Historical auto-fill is off. Your scenario remains editable; turn it on to load data again.';
    if(ready && mode!=='game')renderPlayers();
  }
  function renderPlayers(){
    const mode=getMode();if(mode==='game')return;
    const q=$('history-search').value.trim().toLowerCase(),team=$('history-team').value,latest=$('history-latest').checked;
    const stat=getState().player.stat;
    const passing=mode==='player'&&['passing_yards','passing_tds','completions'].includes(stat);
    const receiving=mode==='player'&&['receiving_yards','receptions'].includes(stat);
    let players=index.filter(p=>(!passing||p.position==='QB')&&(!receiving||['RB','FB','WR','TE'].includes(p.position))&&(!latest||p.last_season===manifest.latest_player_season)&&(!team||p.team===team)&&(`${p.name} ${p.team}`.toLowerCase().includes(q)));
    const previous=selected[mode];
    $('history-player').replaceChildren();
    for(const p of players){const o=document.createElement('option');o.value=p.id;o.textContent=`${p.name} · ${p.team} ${p.position}`;$('history-player').append(o);}
    if(players.some(p=>p.id===previous))$('history-player').value=previous;
    else if(players.length){const candidate=players.find(p=>p.name===(passing?'Josh Allen':'Jonathan Taylor'))||players[0];$('history-player').value=candidate.id;}
    selected[mode]=$('history-player').value;
    $('history-player').disabled=!players.length;
    if(!players.length){$('history-application-note').textContent='No recorded players match these filters.';if(enabled)onManual(mode);}
  }
  function applyGame(){
    if(!controller.enabled)return;
    try{
      const g=getState().game;
      const fixture=model.upcoming.find(f=>f.home===g.home&&f.away===g.away);
      $('history-matchup').value=fixture?.id||'';
      const payload=gameProjection(model,g.home,g.away,fixture);
      $('history-application-note').textContent=`Team form uses each franchise's last 10 completed regular-season games. ${fixture?'Schedule rest and venue are included.':'Custom matchup: non-neutral venue and equal rest assumed.'}`;
      onApply('game',payload,{kind:'game',source:'nflverse',asOf:manifest.latest_game_date,version:manifest.version,n:manifest.completed_games,
        text:`Historical game model · team form through ${manifest.latest_game_date}`});
    }catch(e){onManual('game');$('history-application-note').textContent=e.message;}
  }
  async function applyPlayer(){
    const mode=getMode();if(mode==='game'||!controller.enabled)return;
    const pid=selected[mode];if(!pid)return;
    const meta=index.find(p=>p.id===pid);if(!meta)return;
    const token=++serial;
    $('history-application-note').textContent='Loading recorded game results…';
    try{
      const key=`${manifest.version}/${meta.team}`;
      if(!chunkCache.has(key))chunkCache.set(key,json(base+`players-${meta.team}.json?version=${manifest.version}`).catch(e=>{chunkCache.delete(key);throw e;}));
      const chunk=await chunkCache.get(key);
      if(token!==serial||mode!==getMode()||pid!==selected[mode]||!enabled)return;
      if(chunk.version!==manifest.version)throw new Error('Data changed during loading. Use Check for updates and try again.');
      const player=chunk.players[pid];if(!player)throw new Error('Player history is missing from this snapshot.');
      const stat=mode==='td'?'scoring_tds':getState().player.stat;
      const s=selectPlayerSample(player,manifest.row_columns,stat,window,season);
      const payload=mode==='td'?{name:meta.name,rate:s.mean,history:s.values.join(', ')}
        :{name:meta.name,mean:s.mean,sd:Math.max(1,s.sd),adjust:0,history:s.values.join(', ')};
      if(mode==='player'&&resetPlayerLine){payload.line=Math.max(0,Math.round(s.mean)-.5);resetPlayerLine=false;}
      $('history-application-note').textContent=`${s.n} recorded appearances · ${s.first} to ${s.last}. ${s.sd===0&&mode==='player'?'SD floor of 1 unit applied to the constant sample. ':''}DNPs are excluded; starting roles and injury availability are not inferred.`;
      onApply(mode,payload,{kind:'player',source:'nflverse',asOf:s.last,version:manifest.version,n:s.n,playerId:pid,
        text:`${meta.name} · ${s.n} recorded appearances · ${s.first}–${s.last}`});
    }catch(e){if(token===serial){onManual(mode);$('history-application-note').textContent=e.message;}}
  }
  function applyCurrent(){if(getMode()==='game')applyGame();else applyPlayer();}

  async function load(initial=false){
    $('data-refresh').disabled=true;status('Checking the latest NFL data…');
    try{
      const candidates=[{base:DEFAULT_REMOTE,remote:true},{base:new URL('./data/',import.meta.url).href,remote:false}];
      if(initial===true)candidates.reverse(); // Render the included snapshot immediately, then check GitHub.
      let loaded=null,lastError;
      for(const source of candidates){
        try{
          if(source.remote){
            const pointer=await json(source.base+'latest.json?check='+Math.floor(Date.now()/60000));
            if(!/^[a-f0-9]{40}$/.test(pointer.commit))throw new Error('Invalid published snapshot reference.');
            source.base=source.base.replace('/main/',`/${pointer.commit}/`);
          }
          const m=await json(source.base+'manifest.json?check='+Math.floor(Date.now()/60000));
          if(m.schema_version!==1)throw new Error('Unsupported data schema.');
          const [models,idx]=await Promise.all([json(source.base+'models.json?version='+m.version),json(source.base+'player-index.json?version='+m.version)]);
          if(models.version!==m.version||idx.version!==m.version)throw new Error('Snapshot versions do not match.');
          loaded={m,models,idx,source};break;
        }catch(e){lastError=e;}
      }
      if(!loaded)throw lastError||new Error('No historical data is available.');
      ({m:manifest,models:model}=loaded);index=loaded.idx.players;base=loaded.source.base;remoteAvailable=loaded.source.remote;ready=true;chunkCache.clear();
      $('data-game-date').textContent=manifest.latest_game_date;
      $('data-player-date').textContent=`${manifest.latest_player_date} · Week ${manifest.latest_player_week}`;
      $('data-coverage').textContent=`${manifest.game_seasons[0]}–${manifest.game_seasons[1]} / ${manifest.player_seasons[0]}–${manifest.player_seasons.at(-1)}`;
      $('data-built-date').textContent=new Date(manifest.generated_at).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
      $('data-source-mode').textContent=remoteAvailable?'Published GitHub data':'Included data snapshot';
      const lag=(Date.now()-Date.parse(manifest.generated_at))/86400000;
      status(`${manifest.completed_games.toLocaleString()} completed games · ${manifest.player_appearances.toLocaleString()} player appearances. ${remoteAvailable?'Latest published repository snapshot loaded.':'GitHub sync is pending; using the included snapshot.'}${lag>7?' This snapshot is more than 7 days old.':''}`,lag>7);
      $('data-warnings').textContent=manifest.warnings.join(' ');$('data-warnings').hidden=!manifest.warnings.length;
      $('history-season').innerHTML='<option value="all">All loaded seasons</option>'+manifest.player_seasons.toReversed().map(y=>`<option value="${y}">${y} season</option>`).join('');
      $('history-season').value=String(season);
      const fixtureSelect=$('history-matchup');fixtureSelect.innerHTML='<option value="">Custom team matchup</option>';
      for(const f of model.upcoming){const o=document.createElement('option');o.value=f.id;o.textContent=`${f.date} · ${f.away} at ${f.home}`;fixtureSelect.append(o);}
      $('history-controls').hidden=false;
      const current=getState().game;
      if(getState().samples.game && model.upcoming.length){const f=model.upcoming[0];onApply('game',{home:f.home,away:f.away},null);}
      showReport();showControls();if(enabled)applyCurrent();
    }catch(e){status(`Historical data could not load: ${e.message} Manual scenarios still work.`,true);}
    finally{$('data-refresh').disabled=false;if(initial===true&&ready)queueMicrotask(()=>load());}
  }
  function showReport(){
    const e=model.evaluation;
    $('model-report-content').innerHTML=`<p class="method-intro">Game estimates use trained score-margin and total regressions, then a normal error model. Player estimates fit your selected historical sample; they are not covered by this game-model backtest.</p><div class="report-stats"><div><span>Win Brier score ↓</span><strong>${e.win_brier.toFixed(3)}</strong></div><div><span>Home-rate baseline ↓</span><strong>${e.baseline_brier.toFixed(3)}</strong></div><div><span>Margin error</span><strong>${e.margin_mae.toFixed(1)} pts</strong></div><div><span>Total error</span><strong>${e.total_mae.toFixed(1)} pts</strong></div></div><h3>Separate time periods</h3><p>Training: ${esc(e.training.start)}–${esc(e.training.end)} (${e.training.games} games).<br>Calibration: ${esc(e.calibration.start)}–${esc(e.calibration.end)} (${e.calibration.games} games).<br>Held-out test: ${esc(e.test.start)}–${esc(e.test.end)} (${e.test.games} games).</p><p>Lower Brier scores indicate better probability accuracy. The baseline always predicts the training-period home-win rate. The test uses later games and is not used to fit coefficients, intercept corrections, or variability.</p><h3>How the historical sample is used</h3><p>Team features are the prior 10 games of scoring and points allowed, Elo difference, venue, and known schedule rest. Features are computed before each game's result is added. Player projections use a simple mean and sample SD of the selected recorded appearances; count stats and scoring touchdowns use a Poisson rate.</p><h3>Coverage and freshness</h3><p>${esc(manifest.sample_definition)}</p><p>Game scores through ${esc(manifest.latest_game_date)}; player stats through ${esc(manifest.latest_player_date)}. Snapshot generated ${esc(manifest.generated_at)}. A newly fetched snapshot does not guarantee the upstream provider has published every recent game.</p><h3>Sources</h3><p>${esc(manifest.attribution)}</p><p><a href="https://github.com/nflverse/nflverse-data" target="_blank" rel="noopener noreferrer">nflverse-data ↗</a> · <a href="https://github.com/nflverse/nfldata" target="_blank" rel="noopener noreferrer">nfldata schedules ↗</a></p>`;
  }
  $('data-refresh').addEventListener('click',load);
  enabledControl.addEventListener('change',()=>{enabled=enabledControl.checked;showControls();if(enabled)applyCurrent();});
  $('history-matchup').addEventListener('change',()=>{
    const f=model?.upcoming.find(x=>x.id===$('history-matchup').value);
    if(f){onApply('game',{home:f.home,away:f.away},null);if(controller.enabled)applyGame();}
  });
  $('history-player').addEventListener('change',()=>{selected[getMode()]=$('history-player').value;applyPlayer();});
  for(const id of ['history-search','history-team','history-latest'])$(id).addEventListener('input',()=>{if(ready){renderPlayers();if(enabled)applyPlayer();}});
  $('history-window').addEventListener('change',()=>{window=$('history-window').value;applyPlayer();});
  $('history-season').addEventListener('change',()=>{season=$('history-season').value;applyPlayer();});
  const report=$('model-report');$('data-model-report').addEventListener('click',()=>report.showModal());$('model-report-close').addEventListener('click',()=>report.close());
  load(true);return controller;
}
