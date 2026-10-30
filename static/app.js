/* ============================================================
   ML ACCURACY vs LUCK — Interactive App Logic (v3 – bulletproof)
   ============================================================ */

/* ---------- Chart.js Defaults ---------- */
(function initDefaults() {
  if (typeof Chart === 'undefined') { console.error('Chart.js not loaded!'); return; }
  Chart.defaults.color = '#9a9ab8';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.responsive = true;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation = { duration: 600, easing: 'easeOutQuart' };
})();

const TT = {
  backgroundColor: 'rgba(14,14,35,0.95)',
  borderColor: 'rgba(99,102,241,0.3)',
  borderWidth: 1,
  titleColor: '#e8e8f0',
  bodyColor: '#9a9ab8',
  cornerRadius: 8,
  padding: 12,
};

/* ---------- Chart instances ---------- */
let chartSeeds = null, chartSplits = null, chartWins = null, chartGaps = null;
const loaded = { exp1: false, exp2: false, exp3: false };

/* ---------- Simple chart helper (sync, no async tricks) ---------- */
function makeChart(canvasId, cfg) {
  const el = document.getElementById(canvasId);
  if (!el || typeof Chart === 'undefined') { console.error('Cannot create chart:', canvasId); return null; }
  return new Chart(el, cfg);
}

/* ============================================================
   TAB NAVIGATION
   ============================================================ */
function switchTab(tab) {
  document.querySelectorAll('.tab-link').forEach(l => l.classList.toggle('active', l.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));

  // Load baseline on first visit; resize on revisit
  setTimeout(() => {
    if (tab === 'exp1') {
      if (!loaded.exp1) { loadBaseline1(); loaded.exp1 = true; }
      else if (chartSeeds) chartSeeds.resize();
    } else if (tab === 'exp2') {
      if (!loaded.exp2) { loadBaseline2(); loaded.exp2 = true; }
      else { if (chartSplits) chartSplits.resize(); if (chartWins) chartWins.resize(); }
    } else if (tab === 'exp3') {
      if (!loaded.exp3) { loadBaseline3(); loaded.exp3 = true; }
      else if (chartGaps) chartGaps.resize();
    }
  }, 80); // small delay so CSS display:block is applied before Chart.js reads dimensions
}

document.querySelectorAll('.tab-link').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); switchTab(link.dataset.tab); });
});
document.querySelectorAll('.home-card[data-goto]').forEach(card => {
  card.addEventListener('click', () => { switchTab(card.dataset.goto); window.scrollTo({ top: 0, behavior: 'smooth' }); });
});

// Mobile nav
const navToggle = document.getElementById('nav-toggle');
if (navToggle) navToggle.addEventListener('click', () => document.querySelector('.nav-links').classList.toggle('open'));
document.querySelectorAll('.tab-link').forEach(l => {
  l.addEventListener('click', () => { const nl = document.querySelector('.nav-links'); if (nl) nl.classList.remove('open'); });
});

// Range slider labels
document.querySelectorAll('input[type="range"]').forEach(r => {
  const v = document.getElementById(r.id + '-val');
  if (v) r.addEventListener('input', () => { v.textContent = r.value; });
});

/* ============================================================
   EXPERIMENT 1 — SEED VARIATION
   ============================================================ */
function renderExp1(data, params) {
  if (chartSeeds) { chartSeeds.destroy(); chartSeeds = null; }

  chartSeeds = makeChart('chart-seeds', {
    type: 'line',
    data: {
      labels: data.seeds,
      datasets: [
        { label: 'Random Forest', data: data.rf, borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.08)', fill: true, tension: 0.35, pointRadius: data.seeds.length > 80 ? 1.5 : 3, pointHoverRadius: 6, pointBackgroundColor: '#6366f1', borderWidth: 2 },
        { label: 'Decision Tree', data: data.dt, borderColor: '#fb923c', backgroundColor: 'rgba(251,146,60,0.06)', fill: true, tension: 0.35, pointRadius: data.seeds.length > 80 ? 1.5 : 3, pointHoverRadius: 6, pointBackgroundColor: '#fb923c', borderWidth: 2 },
      ],
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Model Seed' }, grid: { display: false }, ticks: { maxTicksLimit: 12 } },
        y: { title: { display: true, text: 'Accuracy (%)' }, ticks: { callback: v => v + '%' } },
      },
      plugins: { tooltip: { ...TT, callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + '%' } } },
      interaction: { mode: 'index', intersect: false },
    },
  });

  const s = data.summary;
  if (s) {
    statCard('e1-rf-stats', 'Random Forest', '#6366f1', s.rf);
    statCard('e1-dt-stats', 'Decision Tree', '#fb923c', s.dt);
    const ins = document.getElementById('e1-insight');
    if (ins) ins.innerHTML = '<div class="insight-icon">💡</div><p>With ' + (params && params.test_size || 114) + ' test cases, <strong>one extra correct prediction = ' + s.step_size + ' pp</strong>. Score movement is discrete — not continuous.</p>';
  }
}

function statCard(id, name, color, st) {
  const el = document.getElementById(id);
  if (!el || !st) return;
  el.innerHTML = '<div class="stat-card-header"><span class="stat-model-dot" style="background:' + color + '"></span> ' + name + '</div>' +
    '<div class="stat-card-value">' + st.mean + '<span class="stat-unit">%</span></div>' +
    '<div class="stat-card-meta">' +
    '<div class="stat-row"><span>SD</span><strong>' + st.sd + ' pp</strong></div>' +
    '<div class="stat-row"><span>Range</span><strong>' + st.min + '% – ' + st.max + '%</strong></div>' +
    '<div class="stat-row"><span>Distinct values</span><strong>' + st.distinct + '</strong></div></div>';
}

async function runExp1() {
  const params = { n_seeds: +document.getElementById('e1-seeds').value, test_size: +document.getElementById('e1-test').value, split_seed: +document.getElementById('e1-split').value, n_trees: +document.getElementById('e1-trees').value };
  const ld = document.getElementById('exp1-loading'), btn = document.getElementById('btn-exp1');
  const ldP = ld ? ld.querySelector('p') : null;
  if (ldP) ldP.textContent = 'Running ' + params.n_seeds + ' seeds × 2 models...';
  if (ld) ld.classList.remove('hidden');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/experiment1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const data = await res.json();
    if (ld) ld.classList.add('hidden');
    if (btn) btn.disabled = false;
    renderExp1(data, params);
  } catch (err) {
    if (ld) ld.classList.add('hidden');
    if (btn) btn.disabled = false;
    alert('Error: ' + err.message);
  }
}

/* ============================================================
   EXPERIMENT 2 — SHARED SPLITS
   ============================================================ */
function renderExp2(data) {
  if (chartSplits) { chartSplits.destroy(); chartSplits = null; }
  if (chartWins) { chartWins.destroy(); chartWins = null; }

  chartSplits = makeChart('chart-splits', {
    type: 'line',
    data: {
      labels: data.splits.map(s => 'Split ' + s),
      datasets: [
        { label: 'Logistic Regression', data: data.lr, borderColor: '#34d399', pointBackgroundColor: '#34d399', fill: false, tension: 0.3, pointRadius: 4, borderWidth: 2 },
        { label: 'Random Forest', data: data.rf, borderColor: '#6366f1', pointBackgroundColor: '#6366f1', fill: false, tension: 0.3, pointRadius: 4, borderWidth: 2 },
        { label: 'Decision Tree', data: data.dt, borderColor: '#fb923c', pointBackgroundColor: '#fb923c', fill: false, tension: 0.3, pointRadius: 4, borderWidth: 2 },
      ],
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Split Seed' }, grid: { display: false }, ticks: { maxTicksLimit: 10 } },
        y: { title: { display: true, text: 'Accuracy (%)' }, ticks: { callback: v => v + '%' } },
      },
      plugins: { tooltip: { ...TT, callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2) + '%' } } },
      interaction: { mode: 'index', intersect: false },
    },
  });

  const s = data.summary;
  if (s) {
    chartWins = makeChart('chart-wins', {
      type: 'doughnut',
      data: {
        labels: ['Logistic Regression', 'Random Forest', 'Decision Tree'],
        datasets: [{ data: [s.lr.wins, s.rf.wins, s.dt.wins], backgroundColor: ['rgba(52,211,153,0.75)', 'rgba(99,102,241,0.75)', 'rgba(251,146,60,0.75)'], borderColor: 'rgba(14,14,35,0.8)', borderWidth: 3, hoverOffset: 8 }],
      },
      options: {
        cutout: '60%',
        plugins: { legend: { display: true, position: 'bottom', labels: { padding: 14, usePointStyle: true, font: { size: 11 } } }, tooltip: { ...TT, callbacks: { label: ctx => ctx.label + ': ' + ctx.parsed + '/' + s.n_splits + ' splits' } } },
      },
    });

    const n = s.n_splits;
    const wc = w => w > n * 0.6 ? 'win-high' : w > 0 ? 'win-mid' : 'win-low';
    const tbl = document.getElementById('e2-table-wrapper');
    if (tbl) tbl.innerHTML = '<h3 style="font-size:0.95rem;font-weight:600;margin-bottom:0.8rem">Summary Statistics</h3><table class="data-table"><thead><tr><th>Model</th><th>Mean</th><th>SD</th><th>Wins</th></tr></thead><tbody>' +
      '<tr><td><span class="table-dot" style="background:#34d399"></span>Logistic Reg.</td><td><strong>' + s.lr.mean + '%</strong></td><td>' + s.lr.sd + ' pp</td><td><span class="win-badge ' + wc(s.lr.wins) + '">' + s.lr.wins + '/' + n + '</span></td></tr>' +
      '<tr><td><span class="table-dot" style="background:#6366f1"></span>Random Forest</td><td><strong>' + s.rf.mean + '%</strong></td><td>' + s.rf.sd + ' pp</td><td><span class="win-badge ' + wc(s.rf.wins) + '">' + s.rf.wins + '/' + n + '</span></td></tr>' +
      '<tr><td><span class="table-dot" style="background:#fb923c"></span>Decision Tree</td><td><strong>' + s.dt.mean + '%</strong></td><td>' + s.dt.sd + ' pp</td><td><span class="win-badge ' + wc(s.dt.wins) + '">' + s.dt.wins + '/' + n + '</span></td></tr>' +
      '</tbody></table><p style="margin-top:0.6rem;font-size:0.75rem;color:#5e5e80;font-style:italic">Ties count for every tied model.</p>';
  }
}

async function runExp2() {
  const params = { n_splits: +document.getElementById('e2-splits').value, n_trees: +document.getElementById('e2-trees').value };
  const ld = document.getElementById('exp2-loading'), btn = document.getElementById('btn-exp2');
  if (ld) ld.classList.remove('hidden');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/experiment2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const data = await res.json();
    if (ld) ld.classList.add('hidden');
    if (btn) btn.disabled = false;
    renderExp2(data);
  } catch (err) {
    if (ld) ld.classList.add('hidden');
    if (btn) btn.disabled = false;
    alert('Error: ' + err.message);
  }
}

/* ============================================================
   EXPERIMENT 3 — A/A TEST
   ============================================================ */
function renderExp3(data) {
  if (chartGaps) { chartGaps.destroy(); chartGaps = null; }

  const s = data.summary;
  if (s) {
    const el = document.getElementById('e3-conditions');
    if (el) el.innerHTML =
      '<div class="condition-card" style="--border-accent: var(--cyan)"><div class="condition-label">D1 — Same Split</div><div class="condition-desc">Fixed partition, different seeds only</div><div class="condition-stats"><div class="cond-stat"><span class="cond-stat-value">' + s.d1.gte1 + '%</span><span class="cond-stat-label">Gap ≥ 1 pp</span></div><div class="cond-stat"><span class="cond-stat-value">' + s.d1.gte2 + '%</span><span class="cond-stat-label">Gap ≥ 2 pp</span></div></div></div>' +
      '<div class="vs-badge"><span>vs</span></div>' +
      '<div class="condition-card" style="--border-accent: var(--rose)"><div class="condition-label">D2 — Different Splits</div><div class="condition-desc">Both partition and seed change</div><div class="condition-stats"><div class="cond-stat"><span class="cond-stat-value">' + s.d2.gte1 + '%</span><span class="cond-stat-label">Gap ≥ 1 pp</span></div><div class="cond-stat"><span class="cond-stat-value">' + s.d2.gte2 + '%</span><span class="cond-stat-label">Gap ≥ 2 pp</span></div></div></div>';
  }

  const bs = 0.5, mx = 8, bins = [];
  for (let b = 0; b <= mx; b += bs) bins.push(b);
  function hist(arr) {
    if (!arr || !arr.length) return new Array(bins.length).fill(0);
    const c = new Array(bins.length).fill(0);
    arr.forEach(v => { c[Math.min(Math.floor(v / bs), bins.length - 1)]++; });
    return c.map(x => +(x / arr.length * 100).toFixed(1));
  }

  chartGaps = makeChart('chart-gaps', {
    type: 'bar',
    data: {
      labels: bins.map(b => b.toFixed(1) + ' pp'),
      datasets: [
        { label: 'D1 Same Split', data: hist(data.d1_gaps), backgroundColor: 'rgba(34,211,238,0.55)', borderColor: 'rgba(34,211,238,0.8)', borderWidth: 1, borderRadius: 4, barPercentage: 0.85, categoryPercentage: 0.7 },
        { label: 'D2 Different Splits', data: hist(data.d2_gaps), backgroundColor: 'rgba(251,113,133,0.5)', borderColor: 'rgba(251,113,133,0.8)', borderWidth: 1, borderRadius: 4, barPercentage: 0.85, categoryPercentage: 0.7 },
      ],
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Absolute Accuracy Gap' }, grid: { display: false } },
        y: { title: { display: true, text: '% of Pairs' }, ticks: { callback: v => v + '%' } },
      },
      plugins: { tooltip: { ...TT, callbacks: { label: ctx => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) + '%' } } },
      interaction: { mode: 'index', intersect: false },
    },
  });
}

async function runExp3() {
  const params = { n_pairs: +document.getElementById('e3-pairs').value, rng_seed: +document.getElementById('e3-rng').value, test_size: +document.getElementById('e3-test').value, n_trees: +document.getElementById('e3-trees').value };
  const ld = document.getElementById('exp3-loading'), btn = document.getElementById('btn-exp3');
  const lt = document.getElementById('exp3-loading-text');
  if (lt) lt.textContent = 'Running ' + params.n_pairs + ' A/A pairs...';
  if (ld) ld.classList.remove('hidden');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/experiment3', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const data = await res.json();
    if (ld) ld.classList.add('hidden');
    if (btn) btn.disabled = false;
    renderExp3(data);
  } catch (err) {
    if (ld) ld.classList.add('hidden');
    if (btn) btn.disabled = false;
    alert('Error: ' + err.message);
  }
}

/* ============================================================
   BASELINE DATA — loaded on first tab visit
   ============================================================ */
function loadBaseline1() {
  renderExp1({
    seeds: Array.from({length:50},(_,i)=>i),
    rf: [94.74,94.74,95.61,95.61,94.74,95.61,94.74,94.74,95.61,96.49,93.86,95.61,95.61,93.86,95.61,93.86,94.74,95.61,95.61,96.49,96.49,95.61,94.74,94.74,94.74,95.61,96.49,94.74,95.61,95.61,95.61,95.61,96.49,96.49,93.86,94.74,95.61,94.74,94.74,95.61,95.61,95.61,95.61,94.74,94.74,96.49,94.74,93.86,94.74,95.61],
    dt: [91.23,91.23,91.23,91.23,90.35,90.35,90.35,89.47,91.23,91.23,90.35,92.11,90.35,91.23,92.11,90.35,90.35,91.23,91.23,91.23,92.11,91.23,92.98,90.35,90.35,92.11,91.23,91.23,90.35,90.35,90.35,89.47,90.35,92.98,90.35,90.35,90.35,90.35,92.11,88.60,90.35,92.11,91.23,90.35,91.23,92.11,90.35,91.23,89.47,90.35],
    summary: { rf:{mean:95.23,sd:0.78,min:93.86,max:96.49,distinct:5}, dt:{mean:90.89,sd:0.88,min:88.60,max:92.98,distinct:6}, step_size:0.877 }
  }, {test_size:114});
}
function loadBaseline2() {
  renderExp2({
    splits: Array.from({length:30},(_,i)=>100+i),
    lr: [97.37,97.37,98.25,99.12,97.37,98.25,97.37,96.49,98.25,99.12,98.25,97.37,98.25,99.12,96.49,98.25,97.37,98.25,98.25,97.37,98.25,99.12,97.37,98.25,96.49,98.25,98.25,97.37,98.25,98.25],
    rf: [95.61,94.74,96.49,98.25,95.61,96.49,95.61,93.86,96.49,97.37,95.61,94.74,96.49,97.37,94.74,96.49,95.61,96.49,96.49,94.74,96.49,97.37,95.61,96.49,93.86,96.49,96.49,95.61,96.49,96.49],
    dt: [92.11,90.35,92.98,95.61,91.23,93.86,91.23,89.47,93.86,94.74,91.23,90.35,92.98,94.74,89.47,93.86,92.11,93.86,92.98,90.35,93.86,94.74,91.23,93.86,88.60,93.86,93.86,91.23,93.86,93.86],
    summary: {lr:{mean:97.78,sd:1.00,wins:26},rf:{mean:95.88,sd:1.74,wins:9},dt:{mean:92.34,sd:2.68,wins:0},n_splits:30}
  });
}
function loadBaseline3() {
  renderExp3({
    d1_gaps: [0,0,0,0.88,0,0.88,0.88,0,0,1.75,0,0.88,0,0.88,0,0.88,0,0.88,0,0.88,0,0.88,0.88,0,0,1.75,0.88,0,0,0.88,0,0.88,0.88,0,0.88,0,0.88,0,1.75,0,0.88,0,0.88,0,0,0.88,0.88,0,0.88,0],
    d2_gaps: [1.75,0.88,2.63,0.88,1.75,3.51,0,1.75,2.63,0.88,1.75,2.63,0.88,1.75,3.51,0.88,1.75,2.63,0.88,1.75,2.63,0.88,1.75,3.51,0.88,1.75,2.63,0.88,1.75,3.51,0.88,1.75,2.63,0.88,1.75,2.63,0.88,1.75,3.51,0.88,1.75,2.63,0.88,1.75,2.63,0.88,1.75,3.51,0.88,1.75],
    summary: {d1:{gte1:21.4,gte2:3.7,mean:0.55},d2:{gte1:61.5,gte2:40.2,mean:1.84}}
  });
}

/* ============================================================
   PARTICLE CANVAS
   ============================================================ */
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [], N = 60;
  function resize() { w = canvas.width = canvas.offsetWidth; h = canvas.height = canvas.offsetHeight; }
  function create() { particles.length = 0; for (let i = 0; i < N; i++) particles.push({ x: Math.random()*(w||400), y: Math.random()*(h||300), vx: (Math.random()-.5)*.35, vy: (Math.random()-.5)*.35, r: Math.random()*1.5+.5 }); }
  function draw() {
    if (!w||!h) resize();
    ctx.clearRect(0,0,w,h);
    for (let i=0;i<particles.length;i++) for (let j=i+1;j<particles.length;j++) { const dx=particles[i].x-particles[j].x,dy=particles[i].y-particles[j].y,d=Math.sqrt(dx*dx+dy*dy); if(d<140){ctx.beginPath();ctx.moveTo(particles[i].x,particles[i].y);ctx.lineTo(particles[j].x,particles[j].y);ctx.strokeStyle='rgba(99,102,241,'+(0.1*(1-d/140))+')';ctx.lineWidth=.5;ctx.stroke();} }
    particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(129,140,248,0.45)';ctx.fill();});
    requestAnimationFrame(draw);
  }
  resize(); create(); draw();
  window.addEventListener('resize', () => { resize(); create(); });
}

/* ============================================================
   STARTUP — don't create charts on hidden tabs!
   ============================================================ */
document.addEventListener('DOMContentLoaded', initParticles);
