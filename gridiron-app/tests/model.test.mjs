import test from 'node:test';
import assert from 'node:assert/strict';
import { normalCdf, normalEvent, poissonPmf, poissonCdf, poissonEvent, parseResults, sampleStats, historicalRate, wilson, oddsInfo, analyze } from '../web/model.mjs';
const near=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);

test('normal CDF known values and tails',()=>{
  near(normalCdf(0),.5);near(normalCdf(1.96),.9750021049);near(normalCdf(-1.96),.0249978951);near(normalCdf(10),1);near(normalCdf(-10),0);
});
test('integer line divides win, lose, and push; half-point lines have no push',()=>{
  for(const mu of [-20,0,20])for(const sd of [1,13,40])for(const line of [-3.5,0,3,44.5]){
    const o=normalEvent(mu,sd,line,'over'),u=normalEvent(mu,sd,line,'under');
    near(o.p+u.p+o.push,1);near(o.lose,u.p);near(u.lose,o.p);
    if(!Number.isInteger(line))assert.equal(o.push,0);
  }
});
test('negative spread requires a sufficiently large home margin',()=>{
  const g={home:'IND',away:'WAS',homeMean:26,awayMean:23,event:'home_cover',spread:-3.5,total:45.5,marginSd:13,totalSd:14};
  const r=analyze('game',{game:g});near(r.p,1-normalCdf(3.5,3,13));assert.ok(r.p<.5);
  g.spread=3.5;assert.ok(analyze('game',{game:g}).p>.5);
});
test('fair matchup normal approximation distinguishes ties',()=>{
  const state={game:{home:'IND',away:'WAS',homeMean:24,awayMean:24,event:'home_win',spread:-3.5,total:45.5,marginSd:13,totalSd:14}};
  const home=analyze('game',state);state.game.event='away_win';const away=analyze('game',state);
  near(home.p,away.p);near(home.p+away.p+home.push,1);assert.ok(home.push>0);
});
test('Poisson anytime TD and zero-rate special cases',()=>{
  near(poissonEvent(.65,1,'atleast').p,1-Math.exp(-.65),1e-12);
  near(poissonEvent(.65,0,'exact').p,Math.exp(-.65),1e-12);
  assert.equal(poissonEvent(0,1,'atleast').p,0);assert.equal(poissonEvent(0,0,'exact').p,1);
  near(poissonEvent(.65,2,'atleast').p,1-Math.exp(-.65)*(1+.65),1e-12);
});
test('Poisson threshold directions and conservation',()=>{
  for(const rate of [0,.65,5.8,23,80])for(const line of [0,1,5.5,22.5,40]){
    const o=poissonEvent(rate,line,'over'),u=poissonEvent(rate,line,'under');near(o.p+u.p+o.push,1);near(o.lose,u.p);
  }
  near(poissonPmf(2,2),2*Math.exp(-2));near(poissonCdf(1,2),3*Math.exp(-2));
});
test('past results parsed strictly; count data excludes fractions and negatives',()=>{
  assert.deepEqual(parseResults('200, 250; 300\n0'),[200,250,300,0]);assert.deepEqual(parseResults(''),[]);
  assert.throws(()=>parseResults('200, <script>'));assert.throws(()=>parseResults('0,1.5',true));assert.throws(()=>parseResults('-1',true));
  assert.throws(()=>parseResults('1e309'));assert.throws(()=>parseResults(Array(501).fill('1').join(',')));
  const s=sampleStats([200,250,300]);near(s.mean,250);near(s.sd,50);
});
test('observed rate and Wilson bounds include integer-line pushes',()=>{
  const h=historicalRate([0,1,2,2,3],2,'over');assert.equal(h.k,1);assert.equal(h.pushes,2);near(h.rate,.2);
  near(wilson(5,10)[0],.23659309);near(wilson(5,10)[1],.76340691);assert.equal(wilson(0,0),null);
  for(const k of [0,1,10]){const [lo,hi]=wilson(k,10);assert.ok(lo>=0&&hi<=1&&lo<=k/10&&hi>=k/10);}
});
test('odds conversion and expected net return refund pushes',()=>{
  const even=oddsInfo(100,.5);near(even.implied,.5);near(even.ev100,0);
  const negative=oddsInfo(-110,.55,.02);near(negative.decimal,1+100/110);near(negative.settled,.55/.98);
  near(negative.ev100,100*(.55*100/110-.43));
  const pos=oddsInfo(150,.4);near(pos.implied,.4);near(pos.ev100,0);
  assert.throws(()=>oddsInfo(0,.5));assert.throws(()=>oddsInfo(50,.5));
});
test('invalid model inputs are rejected rather than returning a percentage',()=>{
  assert.throws(()=>normalCdf(1,0,0));assert.throws(()=>poissonEvent(-1,1,'atleast'));
  const g={home:'IND',away:'IND',homeMean:26,awayMean:23,marginSd:13,totalSd:14,event:'home_win'};assert.throws(()=>analyze('game',{game:g}));
  assert.throws(()=>analyze('player',{player:{stat:'passing_yards',mean:245,sd:0,line:249.5,adjust:0,direction:'over'}}));
  assert.throws(()=>analyze('td',{td:{rate:NaN,min:1,event:'atleast'}}));
  assert.throws(()=>analyze('player',{player:{stat:'passing_yards',mean:null,sd:40,line:249.5,adjust:0,direction:'over'}}));
  assert.equal(analyze('td',{td:{rate:0,min:NaN,event:'zero'}}).p,1);
});
