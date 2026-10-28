// Probability engine. Inputs are user assumptions, not live NFL projections.
export const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

export function normalCdf(x, mean = 0, sd = 1) {
  if (!(sd > 0) || !Number.isFinite(x + mean + sd)) throw new Error('Use a positive standard deviation.');
  const z = (x - mean) / sd;
  const a = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * a);
  const tail = Math.exp(-a * a / 2) / Math.sqrt(2 * Math.PI)
    * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return clamp(z >= 0 ? 1 - tail : tail, 0, 1);
}

export const normalPdf = (x, mean, sd) => Math.exp(-0.5 * ((x - mean) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

export function normalEvent(mean, sd, threshold, direction) {
  // NFL results are integer-valued; integrate the corresponding rounded-normal bins.
  const over = 1 - normalCdf(Math.floor(threshold) + 0.5, mean, sd);
  const under = normalCdf(Math.ceil(threshold) - 0.5, mean, sd);
  const push = Number.isInteger(threshold)
    ? normalCdf(threshold + 0.5, mean, sd) - normalCdf(threshold - 0.5, mean, sd)
    : 0;
  const p = direction === 'over' ? over : direction === 'under' ? under : push;
  return { p: clamp(p, 0, 1), push: direction === 'exact' ? 0 : clamp(push, 0, 1),
    lose: clamp(1 - p - (direction === 'exact' ? 0 : push), 0, 1), mean, sd,
    threshold, direction, distribution: 'normal',
    boundary: direction === 'over' ? Math.floor(threshold) + 0.5 : Math.ceil(threshold) - 0.5 };
}

export function poissonPmf(k, rate) {
  if (!(rate >= 0) || !Number.isFinite(rate)) throw new Error('Use a nonnegative event rate.');
  if (k < 0 || !Number.isInteger(k)) return 0;
  if (rate === 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-rate);
  for (let i = 1; i <= k; i++) p *= rate / i;
  return p;
}

export function poissonCdf(k, rate) {
  if (k < 0) return 0;
  let p = Math.exp(-rate), sum = p;
  for (let i = 1; i <= Math.floor(k); i++) { p *= rate / i; sum += p; }
  return clamp(sum, 0, 1);
}

export function poissonEvent(rate, threshold, direction) {
  if (!(rate >= 0 && rate <= 100) || !Number.isFinite(rate)) throw new Error('Expected count must be between 0 and 100.');
  let p;
  if (direction === 'over') p = 1 - poissonCdf(Math.floor(threshold), rate);
  else if (direction === 'under') p = poissonCdf(Math.ceil(threshold) - 1, rate);
  else if (direction === 'atleast') p = 1 - poissonCdf(Math.ceil(threshold) - 1, rate);
  else p = poissonPmf(threshold, rate);
  const push = ['over', 'under'].includes(direction) && Number.isInteger(threshold) ? poissonPmf(threshold, rate) : 0;
  return { p: clamp(p, 0, 1), push, lose: clamp(1 - p - push, 0, 1), mean: rate,
    sd: Math.sqrt(rate), threshold, direction, distribution: 'poisson' };
}

export function parseResults(raw, counts = false) {
  if (!raw.trim()) return [];
  const tokens = raw.trim().split(/[\s,;]+/).filter(Boolean);
  if (tokens.length > 500) throw new Error('Use up to 500 past results.');
  const data = tokens.map(t => {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t)) throw new Error('Enter numbers separated by commas, spaces, or new lines.');
    const n = Number(t);
    if (!Number.isFinite(n) || Math.abs(n) > 10000) throw new Error('Each result must be a finite number between −10,000 and 10,000.');
    if (counts && (n < 0 || !Number.isInteger(n))) throw new Error('Count stats require nonnegative whole numbers.');
    return n;
  });
  return data;
}

export function sampleStats(values) {
  if (!values.length) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = values.length > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1)) : 0;
  return { mean, sd, n: values.length };
}

export function wilson(k, n) {
  if (!n) return null;
  const z = 1.959963984540054, ph = k / n, d = 1 + z * z / n;
  const center = (ph + z * z / (2 * n)) / d;
  const half = z / d * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n));
  return [k === 0 ? 0 : clamp(center - half, 0, 1), k === n ? 1 : clamp(center + half, 0, 1)];
}

export function historicalRate(values, threshold, direction) {
  if (!values.length) return null;
  const predicate = direction === 'over' ? x => x > threshold : direction === 'under' ? x => x < threshold
    : direction === 'atleast' ? x => x >= threshold : x => x === threshold;
  const k = values.filter(predicate).length;
  const pushes = ['over', 'under'].includes(direction) ? values.filter(x => x === threshold).length : 0;
  return { k, n: values.length, rate: k / values.length, pushes, interval: wilson(k, values.length) };
}

export function oddsInfo(american, p, push = 0) {
  if (!Number.isFinite(american) || Math.abs(american) < 100 || Math.abs(american) > 100000) throw new Error('Use American odds of −100 or lower, or +100 or higher.');
  const decimal = american > 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american);
  const implied = 1 / decimal;
  const settled = push >= 1 ? null : p / (1 - push);
  return { decimal, implied, settled, edge: settled === null ? null : settled - implied,
    ev100: 100 * (p * (decimal - 1) - Math.max(0, 1 - p - push)) };
}

export function analyze(mode, state) {
  if (mode === 'game') {
    const g = state.game;
    if (g.home === g.away) throw new Error('Select two different teams.');
    if (![g.homeMean,g.awayMean].every(Number.isFinite) || !(g.homeMean >= 0 && g.homeMean <= 100 && g.awayMean >= 0 && g.awayMean <= 100)) throw new Error('Projected team scores must be between 0 and 100.');
    if (![g.marginSd,g.totalSd].every(Number.isFinite) || !(g.marginSd > 0 && g.totalSd > 0 && g.marginSd <= 100 && g.totalSd <= 100)) throw new Error('Variability must be greater than 0 and at most 100.');
    const totalEvent = ['total_over', 'total_under'].includes(g.event);
    const mean = totalEvent ? g.homeMean + g.awayMean : g.homeMean - g.awayMean;
    let threshold = 0, direction = 'over';
    if (g.event === 'away_win') direction = 'under';
    if (g.event === 'home_cover') threshold = -g.spread;
    if (totalEvent) { threshold = g.total; direction = g.event === 'total_over' ? 'over' : 'under'; }
    if (!Number.isFinite(threshold) || Math.abs(threshold) > 200) throw new Error('Use a line between −200 and 200.');
    return normalEvent(mean, totalEvent ? g.totalSd : g.marginSd, threshold, direction);
  }
  if (mode === 'player') {
    const s = state.player;
    const counts = ['receptions', 'completions', 'passing_tds'].includes(s.stat);
    if (!Number.isFinite(s.mean) || !(s.mean >= (counts ? 0 : -1000) && s.mean <= (counts ? 100 : 1000))) throw new Error(counts ? 'Projected count must be between 0 and 100.' : 'Projected yards must be between −1,000 and 1,000.');
    if (!Number.isFinite(s.line) || !(s.line >= 0 && s.line <= (counts ? 100 : 1000))) throw new Error('Enter a nonnegative threshold within the supported range.');
    if (!Number.isFinite(s.adjust) || s.adjust < -50 || s.adjust > 50) throw new Error('Use a projection adjustment between −50% and +50%.');
    const mean = s.mean * (1 + s.adjust / 100);
    if (counts) return poissonEvent(mean, s.line, s.direction);
    if (!(s.sd > 0 && s.sd <= 1000)) throw new Error('Standard deviation must be greater than 0 and at most 1,000.');
    return normalEvent(mean, s.sd, s.line, s.direction);
  }
  const s = state.td;
  if (!Number.isFinite(s.rate) || !(s.rate >= 0 && s.rate <= 20)) throw new Error('Expected touchdowns must be between 0 and 20.');
  if (s.event !== 'zero' && !(s.min >= 1 && s.min <= 10 && Number.isInteger(s.min))) throw new Error('Choose a whole-number touchdown threshold from 1 to 10.');
  return poissonEvent(s.rate, s.event === 'zero' ? 0 : s.min, s.event === 'zero' ? 'exact' : s.event);
}
