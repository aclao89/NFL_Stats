import { analyze, normalEvent, normalPdf, poissonEvent, poissonPmf, poissonCdf, parseResults, sampleStats, historicalRate, oddsInfo, clamp } from './model.mjs';
import { createHistoricalController } from './historical.mjs';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone = x => JSON.parse(JSON.stringify(x));
const percent = p => `${(p * 100).toFixed(1)}%`;
const signed = (x, digits = 1) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(digits)}`;
const fmt = n => Number.isInteger(n) ? String(n) : n.toFixed(1);
const teams = [
  ['ARI','Arizona Cardinals','Cardinals'],['ATL','Atlanta Falcons','Falcons'],['BAL','Baltimore Ravens','Ravens'],['BUF','Buffalo Bills','Bills'],
  ['CAR','Carolina Panthers','Panthers'],['CHI','Chicago Bears','Bears'],['CIN','Cincinnati Bengals','Bengals'],['CLE','Cleveland Browns','Browns'],
  ['DAL','Dallas Cowboys','Cowboys'],['DEN','Denver Broncos','Broncos'],['DET','Detroit Lions','Lions'],['GB','Green Bay Packers','Packers'],
  ['HOU','Houston Texans','Texans'],['IND','Indianapolis Colts','Colts'],['JAX','Jacksonville Jaguars','Jaguars'],['KC','Kansas City Chiefs','Chiefs'],
  ['LV','Las Vegas Raiders','Raiders'],['LAC','Los Angeles Chargers','Chargers'],['LAR','Los Angeles Rams','Rams'],['MIA','Miami Dolphins','Dolphins'],
  ['MIN','Minnesota Vikings','Vikings'],['NE','New England Patriots','Patriots'],['NO','New Orleans Saints','Saints'],['NYG','New York Giants','Giants'],
  ['NYJ','New York Jets','Jets'],['PHI','Philadelphia Eagles','Eagles'],['PIT','Pittsburgh Steelers','Steelers'],['SF','San Francisco 49ers','49ers'],
  ['SEA','Seattle Seahawks','Seahawks'],['TB','Tampa Bay Buccaneers','Buccaneers'],['TEN','Tennessee Titans','Titans'],['WAS','Washington Commanders','Commanders']
];
const team = code => teams.find(t => t[0] === code) ?? [code,code,code];
const statNames = { passing_yards:'Passing yards', rushing_yards:'Rushing yards', receiving_yards:'Receiving yards', receptions:'Receptions', completions:'Completions', passing_tds:'Passing touchdowns' };
const countStats = ['receptions','completions','passing_tds'];
const statExamples = {
  passing_yards:{ mean:245, sd:60, line:249.5 }, rushing_yards:{ mean:72, sd:28, line:69.5 }, receiving_yards:{ mean:65, sd:30, line:64.5 },
  receptions:{ mean:5.8, sd:2.4, line:5.5 }, completions:{ mean:23, sd:5, line:22.5 }, passing_tds:{ mean:1.8, sd:1.1, line:1.5 }
};
const defaults = {
  game:{home:'IND',away:'WAS',event:'home_win',homeMean:26,awayMean:23,spread:-3.5,total:45.5,marginSd:13,totalSd:14},
  player:{name:'Quarterback scenario',stat:'passing_yards',direction:'over',mean:245,sd:60,line:249.5,adjust:0,history:''},
  td:{name:'Scoring scenario',event:'atleast',min:1,rate:.65,history:''},
  samples:{game:true,player:true,td:true}, basis:{game:null,player:null,td:null}, odds:''
};
let state = clone(defaults), mode = 'game', result = null, history = null, historyError = '', toastTimer, historical;
const STORAGE = 'gridiron.scenarios.v1';
let saved = [];
try {
  const data = JSON.parse(localStorage.getItem(STORAGE) || '[]');
  if (Array.isArray(data)) saved = data.filter(x => x && typeof x.id === 'string' && typeof x.title === 'string' && typeof x.subtitle === 'string' && ['game','player','td'].includes(x.mode) && Number.isFinite(x.p) && x.p >= 0 && x.p <= 1 && x.state && x.state.game && x.state.player && x.state.td).slice(0,24);
} catch { /* Browser storage can be unavailable; calculations still work. */ }

for (const code of ['game-home','game-away']) for (const t of teams) {
  const option = document.createElement('option'); option.value = t[0]; option.textContent = t[1]; $(code).append(option);
}
for(const t of teams){const o=document.createElement('option');o.value=t[0];o.textContent=t[0];$('history-team').append(o);}

function notify(message) {
  $('toast').textContent = message; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3200);
}
function persistSaved() {
  try { localStorage.setItem(STORAGE, JSON.stringify(saved)); return true; }
  catch { notify('Browser storage is unavailable. Export your scenarios to keep them.'); return false; }
}

function syncInputs() {
  document.querySelectorAll('[data-field]').forEach(el => { const [section,key] = el.dataset.field.split('.'); el.value = state[section][key]; });
  $('american-odds').value = state.odds;
}
function setMode(next, focus = false) {
  mode = next;
  document.querySelectorAll('[data-mode]').forEach(el => {
    const active = el.dataset.mode === mode; el.setAttribute('aria-selected', String(active)); el.tabIndex = active ? 0 : -1;
    if (active && focus) el.focus();
  });
  document.querySelectorAll('[data-panel]').forEach(el => { el.hidden = el.dataset.panel !== mode; });
  render();
  historical?.onMode();
}

function description(r = result) {
  if (mode === 'game') {
    const g = state.game, home = team(g.home)[2], away = team(g.away)[2];
    const title = {home_win:`${home} to win`,away_win:`${away} to win`,home_cover:`${home} cover ${signed(g.spread)}`,total_over:`Over ${fmt(g.total)} total points`,total_under:`Under ${fmt(g.total)} total points`}[g.event];
    return {title,subtitle:`${g.home} ${fmt(g.homeMean)} · ${g.away} ${fmt(g.awayMean)} projected points`,axis:g.event.startsWith('total')?'PROJECTED GAME TOTAL':`PROJECTED MARGIN · ${g.home} − ${g.away}`,meanLabel:g.event.startsWith('total')?'Expected total':'Expected margin',mean:`${g.event.startsWith('total')?fmt(r.mean):signed(r.mean)} pts`,unit:'pts'};
  }
  if (mode === 'player') {
    const p = state.player;
    return {title:`${p.direction === 'over' ? 'Over' : 'Under'} ${fmt(p.line)} ${statNames[p.stat].toLowerCase()}`,subtitle:`${p.name.trim() || 'Player scenario'} · ${p.adjust ? signed(p.adjust,0)+'% projection adjustment' : 'Your projected average and variability'}`,axis:`PROJECTED ${statNames[p.stat].toUpperCase()}`,meanLabel:'Adjusted average',mean:`${fmt(r.mean)} ${countStats.includes(p.stat)?'':'yds'}`.trim(),unit:countStats.includes(p.stat)?'':'yds'};
  }
  const t = state.td, title = t.event === 'zero' ? 'No touchdowns' : `${t.event === 'exact'?'Exactly':'At least'} ${t.min} touchdown${t.min === 1?'':'s'}`;
  return {title,subtitle:`${t.name.trim() || 'Scoring scenario'} · ${fmt(t.rate)} expected TDs per game`,axis:'PROJECTED TOUCHDOWN COUNT',meanLabel:'Expected touchdowns',mean:fmt(t.rate),unit:'TDs'};
}

function configureForm() {
  $('spread-label').hidden = state.game.event !== 'home_cover';
  $('total-label').hidden = !state.game.event.startsWith('total');
  $('td-min-label').hidden = state.td.event === 'zero';
  $('home-score-label').textContent = `${state.game.home} projected points`;
  $('away-score-label').textContent = `${state.game.away} projected points`;
  const count = countStats.includes(state.player.stat);
  $('player-sd-label').hidden = count;
  $('player-mean').max = count ? '100':'1000'; $('player-line').max = count ? '100':'1000';
  $('player-mean').min = count ? '0':'-1000';
  $('adjust-output').textContent = `${signed(state.player.adjust,0)}%`;
  const isSample = state.samples[mode];
  $('sample-label').textContent = isSample ? 'EXAMPLE SCENARIO':'YOUR SCENARIO';
  $('sample-label').classList.toggle('custom', !isSample);
  $('sample-copy').textContent = isSample ? 'Illustrative projections. Replace these with your own stats; no live NFL data is connected.' : 'Calculated from your inputs. Team and player selection does not retrieve live statistics.';
  if(state.basis?.[mode]){
    $('sample-label').textContent='HISTORICAL BASELINE';$('sample-label').classList.add('custom');
    $('sample-copy').textContent=state.basis[mode].text;
  }
}

function poissonQuantile(q, rate) {
  for (let k = 0; k <= 250; k++) if (poissonCdf(k, rate) >= q) return k;
  return 250;
}
function render() {
  configureForm(); result = null; history = null; historyError = '';
  try { result = analyze(mode,state); }
  catch (e) {
    $('error-state').hidden = false; $('error-text').textContent = e.message;
    $('result-content').hidden = true; $('support-grid').hidden = true;
    $('save-scenario').disabled = true; $('copy-summary').disabled = true;
    $('odds-result').innerHTML = '<p>Correct your scenario inputs to compare a price.</p>'; return;
  }
  $('error-state').hidden = true; $('result-content').hidden = false; $('support-grid').hidden = false;
  $('save-scenario').disabled = false; $('copy-summary').disabled = false;
  const d = description();
  $('results-title').textContent = d.title; $('result-subtitle').textContent = d.subtitle;
  $('model-tag').textContent = result.distribution === 'normal' ? 'NORMAL MODEL':'POISSON MODEL';
  if(state.basis?.[mode])$('model-tag').textContent=result.distribution==='normal'?'FITTED NORMAL':'FITTED POISSON';
  $('prob-value').innerHTML = `${(result.p*100).toFixed(1)}<small>%</small>`;
  $('prob-ring').style.setProperty('--angle',`${result.p*360}deg`);
  $('yes-prob').textContent = percent(result.p); $('no-prob').textContent = percent(result.lose);
  const showPush = result.push > 0;
  $('no-label').textContent = showPush ? 'Opposite outcome':'Outcome does not happen';
  $('push-row').hidden = !showPush; $('push-prob').textContent = percent(result.push);
  $('push-label').textContent = mode === 'game' && ['home_win','away_win'].includes(state.game.event) ? 'Tie (model estimate)':'Push / equals line';
  $('distribution-label').textContent = d.axis; $('metric-mean-label').textContent = d.meanLabel;
  $('metric-mean').textContent = d.mean; $('metric-sd').textContent = fmt(result.sd);
  const range = result.distribution === 'normal' ? [result.mean-1.2815515655*result.sd,result.mean+1.2815515655*result.sd].map(Math.round)
    : [poissonQuantile(.1,result.mean),poissonQuantile(.9,result.mean)];
  $('metric-range').textContent = `${range[0]}–${range[1]}${d.unit?' '+d.unit:''}`;
  $('metric-range-label').textContent = result.distribution === 'normal'?'Central 80% model range':'10th–90th model percentiles';
  renderChart(); renderSensitivity(); renderHistory(); renderOdds();
}

function renderChart() {
  const r = result, width=550, height=158, left=15, right=535, top=16, base=128, rangeW=right-left;
  let body = '', axis='';
  const text = (x,y,label,anchor='middle',color='#8091a5') => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="Segoe UI,Arial,sans-serif" font-size="9">${esc(label)}</text>`;
  if (r.distribution === 'normal') {
    const lo=r.mean-3.3*r.sd, hi=r.mean+3.3*r.sd;
    const sx=x=>left+(x-lo)/(hi-lo)*rangeW, sy=x=>base-normalPdf(x,r.mean,r.sd)/normalPdf(r.mean,r.mean,r.sd)*(base-top);
    const pts=Array.from({length:121},(_,i)=>{const x=lo+(hi-lo)*i/120;return `${sx(x).toFixed(2)},${sy(x).toFixed(2)}`;});
    const area=`M${left},${base} L${pts.join(' L')} L${right},${base} Z`;
    let cutL=left,cutR=right;
    if (r.direction==='over') cutL=clamp(sx(r.boundary),left,right);
    else if (r.direction==='under') cutR=clamp(sx(r.boundary),left,right);
    else {cutL=clamp(sx(r.threshold-.5),left,right);cutR=clamp(sx(r.threshold+.5),left,right);}
    body+=`<defs><clipPath id="event-area"><rect x="${cutL}" y="0" width="${Math.max(0,cutR-cutL)}" height="${base}"/></clipPath></defs>`;
    for(let i=1;i<=3;i++){const y=base-(base-top)*i/3;body+=`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#263442" stroke-dasharray="2 5"/>`;}
    body+=`<path d="${area}" fill="#293e38" opacity=".45"/><path d="${area}" fill="#b7ef59" opacity=".3" clip-path="url(#event-area)"/><path d="M${pts.join(' L')}" fill="none" stroke="#789683" stroke-width="1.8"/><path d="M${pts.join(' L')}" fill="none" stroke="#b7ef59" stroke-width="2" clip-path="url(#event-area)"/>`;
    const boundary=r.direction==='exact'?r.threshold:r.boundary;
    if(boundary>=lo && boundary<=hi){const x=sx(boundary);body+=`<line x1="${x}" y1="8" x2="${x}" y2="${base}" stroke="#a8bf8b" stroke-dasharray="3 4" opacity=".8"/>`;body+=text(clamp(x,70,480),9,`Line ${fmt(r.threshold)}`,'middle','#c5d5b4');}
    else body+=text(boundary<lo?left:right,9,`Line ${fmt(r.threshold)} is outside this range`,boundary<lo?'start':'end','#c5d5b4');
    for(let i=0;i<=4;i++) axis+=text(left+i*rangeW/4,149,String(Math.round(lo+(hi-lo)*i/4)),i===0?'start':i===4?'end':'middle');
  } else {
    const max=Math.max(5,Math.ceil(r.mean+3.5*Math.sqrt(r.mean)+2)), barW=rangeW/(max+1);
    const probs=Array.from({length:max+1},(_,i)=>poissonPmf(i,r.mean)), peak=Math.max(...probs,1e-9);
    for(let i=1;i<=3;i++){const y=base-(base-top)*i/3;body+=`<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#263442" stroke-dasharray="2 5"/>`;}
    probs.forEach((p,k)=>{const selected=r.direction==='over'?k>r.threshold:r.direction==='under'?k<r.threshold:r.direction==='atleast'?k>=r.threshold:k===r.threshold;
      const h=p/peak*(base-top), x=left+k*barW;
      body+=`<rect x="${x+Math.min(3,barW*.15)}" y="${base-h}" width="${barW-Math.min(6,barW*.3)}" height="${h}" rx="2" fill="${selected?'#b7ef59':'#344759'}"><title>${k}: ${percent(p)}</title></rect>`;
      if(max<=14 || k%Math.ceil(max/6)===0 || k===max) axis+=text(x+barW/2,149,String(k));
    });
  }
  body+=`<line x1="${left}" y1="${base}" x2="${right}" y2="${base}" stroke="#364350"/>`;
  $('chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(description().axis)} distribution. The selected outcome has ${percent(r.p)} probability in this model.">${body}${axis}</svg>`;
}

function renderSensitivity() {
  const r=result;
  let variations, help;
  if(mode==='game'){
    const total=state.game.event.startsWith('total'); help=`Move the expected ${total?'total':'home score margin'} by 3 points.`;
    variations=[-3,0,3].map(d=>({label:d===0?'Your baseline':`${total?'Total':'Home margin'} ${signed(d,0)} points`,p:normalEvent(r.mean+d,r.sd,r.threshold,r.direction).p,base:d===0}));
  } else {
    const step=mode==='td'?.2:.1; help=`Change the projected ${mode==='td'?'touchdown rate':'average'} by ${step*100}%. Other assumptions stay the same.`;
    variations=[-step,0,step].map(d=>({label:d===0?'Your baseline':`${mode==='td'?'Rate':'Average'} ${signed(d*100,0)}%`,p:r.distribution==='normal'?normalEvent(r.mean*(1+d),r.sd,r.threshold,r.direction).p:poissonEvent(r.mean*(1+d),r.threshold,r.direction).p,base:d===0}));
  }
  $('sensitivity-help').textContent=help;
  $('sensitivity-rows').innerHTML=variations.map(v=>`<div class="sensitivity-row ${v.base?'baseline':''}"><div class="sensitivity-label"><span>${esc(v.label)}</span><strong>${percent(v.p)}</strong></div><div class="sensitivity-bar"><span style="width:${v.p*100}%"></span></div></div>`).join('');
}

function renderHistory() {
  const container=$('history-result');
  if(mode==='game') {container.innerHTML='<h3>Your evidence goes here.</h3><p>Past player results can be checked in the Player stats and Touchdowns tabs.</p><span class="outline-pill">PROJECTION-BASED ESTIMATE</span>';return;}
  try {
    const values=parseResults(state[mode].history,mode==='td'||countStats.includes(state.player.stat));
    history=historicalRate(values,result.threshold,result.direction);
  } catch(e){historyError=e.message;container.innerHTML=`<h3>Check your past results.</h3><p class="negative">${esc(e.message)}</p>`;return;}
  if(!history){container.innerHTML='<h3>Your evidence goes here.</h3><p>Paste past results to compare the model estimate with an observed hit rate.</p><span class="outline-pill">NO HISTORY ENTERED</span>';return;}
  const [lo,hi]=history.interval;
  container.innerHTML=`<div class="history-large">${(history.rate*100).toFixed(1)}<small>% hit rate</small></div><div class="history-detail">${history.k} of ${history.n} ${state.basis?.[mode]?'recorded appearances':'entered games'}${history.pushes?` · ${history.pushes} push${history.pushes===1?'':'es'}`:''}</div><div class="interval-bar"><span class="interval" style="left:${lo*100}%;width:${(hi-lo)*100}%"></span><span class="point" style="left:${history.rate*100}%"></span></div><p class="interval-note">95% historical interval: ${percent(lo)}–${percent(hi)}</p><p class="interval-note">${history.n<10?'Small sample. ':''}Describes past results; this is not a validated prediction.</p>`;
}

function renderOdds() {
  const raw=$('american-odds').value.trim(); state.odds=raw;
  if(!raw){$('odds-result').innerHTML='<p>Enter a price to compare its break-even probability with your model.</p>';return;}
  if(!result){$('odds-result').innerHTML='<p>Correct your scenario inputs first.</p>';return;}
  try {
    const odds=oddsInfo(Number(raw),result.p,result.push);
    $('odds-result').innerHTML=`<div class="odds-grid"><div><span>Break-even chance</span><strong>${percent(odds.implied)}</strong></div><div><span>Model edge, after pushes</span><strong class="${odds.edge>=0?'positive':'negative'}">${odds.edge===null?'—':signed(odds.edge*100)+' pp'}</strong></div><div><span>Expected net / $100</span><strong class="${odds.ev100>=0?'positive':'negative'}">${odds.ev100>=0?'+$':'−$'}${Math.abs(odds.ev100).toFixed(2)}</strong></div></div>`;
  } catch(e){$('odds-result').innerHTML=`<p class="negative">${esc(e.message)}</p>`;}
}

function fitHistory(which) {
  const message=$(which+'-history-message'); message.classList.remove('error');
  try {
    const values=parseResults(state[which].history,which==='td'||countStats.includes(state.player.stat));
    if(values.length<3) throw new Error('Enter at least 3 comparable game results, including zero-result games.');
    const stats=sampleStats(values), counts=which==='td'||countStats.includes(state.player.stat);
    if(!counts && stats.sd===0) throw new Error('These results have zero variation. Enter a positive SD manually.');
    if(which==='td') state.td.rate=stats.mean;
    else {state.player.mean=stats.mean;state.player.adjust=0;if(!counts)state.player.sd=stats.sd;}
    state.samples[which]=false;syncInputs();render();
    if(!result)throw new Error($('error-text').textContent);
    message.textContent=`Projection set from ${stats.n} games: average ${stats.mean.toFixed(2)}${!counts?', sample SD '+stats.sd.toFixed(2):''}. Edit it to reflect the next matchup.`;
  } catch(e){message.classList.add('error');message.textContent=e.message;}
}

function renderSaved() {
  $('nav-count').textContent=String(saved.length);$('export-scenarios').disabled=!saved.length;
  if(!saved.length){$('saved-list').innerHTML='<div class="empty-notebook"><span aria-hidden="true">▤</span><div><h3>Your first scenario starts above.</h3><p>Saved scenarios stay in this browser. Reload one to explore a different assumption.</p></div></div>';return;}
  $('saved-list').innerHTML=saved.map(s=>`<article class="saved-card"><div class="saved-card-top"><span class="saved-card-kind">${({game:'GAME OUTCOME',player:'PLAYER STAT',td:'TOUCHDOWNS'})[s.mode]}${s.sample?' · EXAMPLE':''}</span><button class="icon-button" data-remove="${esc(s.id)}" aria-label="Remove ${esc(s.title)}">×</button></div><h3>${esc(s.title)}</h3><p>${esc(s.subtitle)}</p><div class="saved-card-bottom"><strong>${percent(s.p)}</strong><button class="secondary-button" data-load="${esc(s.id)}">Reload inputs ↗</button></div><div class="saved-time">${esc(new Date(s.time).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))} · ${s.distribution==='normal'?'Normal':'Poisson'} model</div></article>`).join('');
}

document.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('input',()=>{
  const [section,key]=el.dataset.field.split('.');
  state[section][key]=['number','range'].includes(el.type)?(el.value.trim()===''?NaN:Number(el.value)):el.value;
  state.samples[section]=false;
  if(section==='game'&&['home','away'].includes(key)&&historical?.onTeams())return;
  if(section==='player'&&key==='stat'&&historical?.enabled){
    state.player.mean=NaN;syncInputs();historical.onStat();render();return;
  }
  const overrides={game:['homeMean','awayMean','marginSd','totalSd'],player:['name','mean','sd','history'],td:['name','rate','history']};
  if(overrides[section].includes(key)){historical?.manual();state.basis[section]=null;}
  if(section==='player'&&key==='stat'){
    state.basis.player=null;
    Object.assign(state.player,statExamples[state.player.stat],{adjust:0,history:''});state.samples.player=true;
    $('player-history-message').textContent='';syncInputs();notify('Example projections loaded for this stat. Replace them with your own.');
  }
  if(key==='history')$(section+'-history-message').textContent='';
  render();
}));
$('scenario-form').addEventListener('submit',e=>e.preventDefault());
document.querySelectorAll('[data-mode]').forEach(el=>el.addEventListener('click',()=>setMode(el.dataset.mode)));
document.querySelector('.tablist').addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();const modes=['game','player','td'],index=modes.indexOf(mode);
  const next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;setMode(modes[next],true);
});
$('reset-example').addEventListener('click',()=>{historical?.manual();state[mode]=clone(defaults[mode]);state.samples[mode]=true;state.basis[mode]=null;state.odds='';$('american-odds').value='';if(mode!=='game')$(mode+'-history-message').textContent='';syncInputs();render();notify('Example loaded. All numbers are illustrative.');});
$('fit-player').addEventListener('click',()=>fitHistory('player'));
$('fit-td').addEventListener('click',()=>fitHistory('td'));
$('american-odds').addEventListener('input',renderOdds);
$('save-scenario').addEventListener('click',()=>{
  if(!result)return;
  if(historyError){notify('Correct your past results before saving.');return;}
  if(saved.length>=24){notify('You have 24 saved scenarios. Export or remove one before saving another.');return;}
  const d=description(),s={id:globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2),mode,state:clone(state),p:result.p,push:result.push,distribution:result.distribution,title:d.title,subtitle:d.subtitle,sample:state.samples[mode],time:new Date().toISOString(),history:history?clone(history):null};
  saved.unshift(s);const persisted=persistSaved();renderSaved();if(persisted)notify('Scenario saved to your notebook.');
});
$('saved-list').addEventListener('click',e=>{
  const load=e.target.closest('[data-load]'),remove=e.target.closest('[data-remove]');
  if(remove){saved=saved.filter(s=>s.id!==remove.dataset.remove);persistSaved();renderSaved();return;}
  if(load){const item=saved.find(s=>s.id===load.dataset.load);if(!item)return;
    try {const next=clone(item.state);next.samples??=clone(defaults.samples);next.basis??=clone(defaults.basis);analyze(item.mode,next);historical?.manual();state=next;syncInputs();setMode(item.mode);document.querySelector('.workspace-top').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});notify('Saved inputs restored.');}
    catch {notify('This saved scenario could not be loaded.');}
  }
});
function csvCell(value){let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
$('export-scenarios').addEventListener('click',()=>{
  const rows=[['Saved at','Prediction type','Outcome','Inputs summary','Probability %','Push %','Model','Example inputs','Historical hits','Historical games','Raw inputs JSON']];
  saved.forEach(s=>rows.push([s.time,s.mode,s.title,s.subtitle,(s.p*100).toFixed(4),(s.push*100).toFixed(4),s.distribution,s.sample?'Yes':'No',s.history?.k??'',s.history?.n??'',JSON.stringify(s.state)]));
  const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gridiron-scenarios-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Scenario CSV exported.');
});
$('copy-summary').addEventListener('click',async()=>{
  if(!result)return;
  const d=description(),text=`${d.title}: ${percent(result.p)} model probability. ${d.subtitle}. ${result.distribution==='normal'?'Normal':'Poisson'} model. ${result.push?'Tie/push: '+percent(result.push)+'. ':''}Basis: ${state.basis?.[mode]?.text||'manual assumptions'}. No live injury or availability feed.`;
  try{await navigator.clipboard.writeText(text);notify('Result copied.');}catch{notify('Clipboard access is unavailable in this browser. Save or export the scenario instead.');}
});
const dialog=$('method-dialog');
for(const id of ['method-open','method-footer'])$(id).addEventListener('click',()=>dialog.showModal());
$('method-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});
syncInputs();renderSaved();setMode('game');
historical=createHistoricalController({
  getState:()=>state,getMode:()=>mode,notify,
  onApply:(which,payload,basis)=>{const values=Object.fromEntries(Object.entries(payload).map(([k,v])=>[k,typeof v==='number'?Math.round(v*100)/100:v]));Object.assign(state[which],values);state.samples[which]=false;state.basis[which]=basis;syncInputs();if(mode===which)render();},
  onManual:which=>{state.basis[which]=null;if(which==='player')state.player.mean=NaN;if(which==='td')state.td.rate=NaN;syncInputs();if(mode===which)render();}
});
