/* ============================================================
   ML ACCURACY vs LUCK — Interactive Logic & Charts
   ============================================================ */

// ─── Utility: seeded pseudo-random (mulberry32) ───
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Utility: Box-Muller normal ───
function normalRandom(mean, sd, rng) {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sd * z;
}

// ─── Utility: clamp ───
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── Utility: quantize to 1/114 steps (0.877 pp) ───
function quantize(v) {
  const step = 100 / 114;
  return Math.round(v / step) * step;
}

// ============================================================
// DATA GENERATION (matches paper statistics)
// ============================================================
function generateSeedData() {
  const rng = mulberry32(42);
  const seeds = [];
  for (let i = 0; i < 50; i++) {
    const rf = quantize(clamp(normalRandom(93.91, 0.86, rng), 92.11, 95.61));
    const dt = quantize(clamp(normalRandom(92.26, 1.17, rng), 89.47, 94.74));
    seeds.push({ seed: i, rf, dt });
  }
  return seeds;
}

function generateSplitData() {
  const rng = mulberry32(100);
  const splits = [];
  for (let j = 0; j < 30; j++) {
    const lr = quantize(clamp(normalRandom(98.25, 1.15, rng), 93.0, 100.0));
    const rf = quantize(clamp(normalRandom(95.76, 1.94, rng), 90.0, 100.0));
    const dt = quantize(clamp(normalRandom(92.40, 2.23, rng), 85.0, 98.0));
    splits.push({ split: 100 + j, lr, rf, dt });
  }
  return splits;
}

function generateGapData() {
  const rng = mulberry32(2026);
  const d1 = [], d2 = [];
  for (let i = 0; i < 1000; i++) {
    // D1: same split — smaller gaps (mean ~0.55, mostly < 3)
    const g1 = Math.abs(normalRandom(0, 0.7, rng));
    d1.push(quantize(clamp(g1, 0, 5)));
    // D2: different splits — bigger gaps
    const g2 = Math.abs(normalRandom(0, 1.8, rng));
    d2.push(quantize(clamp(g2, 0, 8)));
  }
  return { d1, d2 };
}

function generateCIData() {
  const rng = mulberry32(777);
  const points = [];
  const values = [];
  for (let n = 2; n <= 50; n++) {
    values.push(quantize(clamp(normalRandom(93.91, 0.86, rng), 92.0, 96.0)));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
    const hw = 1.96 * sd / Math.sqrt(values.length);
    points.push({ n, hw: Math.round(hw * 1000) / 1000 });
  }
  return points;
}

const seedData = generateSeedData();
const splitData = generateSplitData();
const gapData = generateGapData();
const ciData = generateCIData();

// ============================================================
// CHART.JS GLOBAL DEFAULTS
// ============================================================
Chart.defaults.color = '#9a9ab8';
Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.animation = { duration: 1200, easing: 'easeOutQuart' };

// ============================================================
// CHART 1: Seed Variation (line)
// ============================================================
function createSeedChart() {
  const ctx = document.getElementById('chart-seeds');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: seedData.map(d => d.seed),
      datasets: [
        {
          label: 'Random Forest',
          data: seedData.map(d => d.rf),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.08)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#6366f1',
          borderWidth: 2,
        },
        {
          label: 'Decision Tree',
          data: seedData.map(d => d.dt),
          borderColor: '#fb923c',
          backgroundColor: 'rgba(251,146,60,0.06)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#fb923c',
          borderWidth: 2,
        },
      ],
    },
    options: {
      scales: {
        x: {
          title: { display: true, text: 'Seed', color: '#5e5e80' },
          ticks: { maxTicksLimit: 10 },
          grid: { display: false },
        },
        y: {
          title: { display: true, text: 'Accuracy (%)', color: '#5e5e80' },
          min: 88,
          max: 97,
          ticks: { callback: v => v + '%' },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(14,14,35,0.9)',
          borderColor: 'rgba(99,102,241,0.3)',
          borderWidth: 1,
          titleColor: '#e8e8f0',
          bodyColor: '#9a9ab8',
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      interaction: { mode: 'index', intersect: false },
    },
  });
}

// ============================================================
// CHART 2: Shared Splits (line)
// ============================================================
function createSplitsChart() {
  const ctx = document.getElementById('chart-splits');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: splitData.map(d => `Split ${d.split}`),
      datasets: [
        {
          label: 'Logistic Regression',
          data: splitData.map(d => d.lr),
          borderColor: '#34d399',
          backgroundColor: 'rgba(52,211,153,0.06)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#34d399',
          borderWidth: 2,
        },
        {
          label: 'Random Forest',
          data: splitData.map(d => d.rf),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.06)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#6366f1',
          borderWidth: 2,
        },
        {
          label: 'Decision Tree',
          data: splitData.map(d => d.dt),
          borderColor: '#fb923c',
          backgroundColor: 'rgba(251,146,60,0.06)',
          fill: false,
          tension: 0.3,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#fb923c',
          borderWidth: 2,
        },
      ],
    },
    options: {
      scales: {
        x: {
          title: { display: true, text: 'Split Seed', color: '#5e5e80' },
          ticks: { maxTicksLimit: 10 },
          grid: { display: false },
        },
        y: {
          title: { display: true, text: 'Accuracy (%)', color: '#5e5e80' },
          min: 84,
          max: 101,
          ticks: { callback: v => v + '%' },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(14,14,35,0.9)',
          borderColor: 'rgba(99,102,241,0.3)',
          borderWidth: 1,
          titleColor: '#e8e8f0',
          bodyColor: '#9a9ab8',
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      interaction: { mode: 'index', intersect: false },
    },
  });
}

// ============================================================
// CHART 3: Win Donut
// ============================================================
function createWinsChart() {
  const ctx = document.getElementById('chart-wins');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Logistic Regression', 'Random Forest', 'Decision Tree'],
      datasets: [{
        data: [28, 3, 1],
        backgroundColor: [
          'rgba(52,211,153,0.75)',
          'rgba(99,102,241,0.75)',
          'rgba(251,146,60,0.75)',
        ],
        borderColor: 'rgba(14,14,35,0.8)',
        borderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      cutout: '62%',
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10,
            font: { size: 11 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(14,14,35,0.9)',
          borderColor: 'rgba(99,102,241,0.3)',
          borderWidth: 1,
          titleColor: '#e8e8f0',
          bodyColor: '#9a9ab8',
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.parsed}/30 splits`,
          },
        },
      },
    },
  });
}

// ============================================================
// CHART 4: Gap Distribution (bar)
// ============================================================
function createGapChart() {
  const ctx = document.getElementById('chart-gaps');
  if (!ctx) return;

  // Bin the gaps into 0.5-pp buckets
  const binSize = 0.5;
  const maxBin = 6;
  const bins = [];
  for (let b = 0; b <= maxBin; b += binSize) bins.push(b);

  function histogram(data) {
    const counts = new Array(bins.length).fill(0);
    data.forEach(v => {
      let idx = Math.floor(v / binSize);
      if (idx >= bins.length) idx = bins.length - 1;
      counts[idx]++;
    });
    return counts.map(c => (c / data.length) * 100);
  }

  const d1Hist = histogram(gapData.d1);
  const d2Hist = histogram(gapData.d2);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: bins.map(b => b.toFixed(1) + ' pp'),
      datasets: [
        {
          label: 'D1 Same Split',
          data: d1Hist,
          backgroundColor: 'rgba(34,211,238,0.55)',
          borderColor: 'rgba(34,211,238,0.8)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.85,
          categoryPercentage: 0.7,
        },
        {
          label: 'D2 Different Splits',
          data: d2Hist,
          backgroundColor: 'rgba(251,113,133,0.5)',
          borderColor: 'rgba(251,113,133,0.8)',
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.85,
          categoryPercentage: 0.7,
        },
      ],
    },
    options: {
      scales: {
        x: {
          title: { display: true, text: 'Absolute Gap', color: '#5e5e80' },
          grid: { display: false },
        },
        y: {
          title: { display: true, text: '% of Pairs', color: '#5e5e80' },
          ticks: { callback: v => v + '%' },
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(14,14,35,0.9)',
          borderColor: 'rgba(99,102,241,0.3)',
          borderWidth: 1,
          titleColor: '#e8e8f0',
          bodyColor: '#9a9ab8',
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`,
          },
        },
      },
      interaction: { mode: 'index', intersect: false },
    },
  });
}

// ============================================================
// CHART 5: CI Half-Width
// ============================================================
function createCIChart() {
  const ctx = document.getElementById('chart-ci');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ciData.map(d => d.n),
      datasets: [{
        label: 'CI Half-Width (pp)',
        data: ciData.map(d => d.hw),
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168,85,247,0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: '#a855f7',
        borderWidth: 2,
      }],
    },
    options: {
      scales: {
        x: {
          title: { display: true, text: 'Number of Seeds', color: '#5e5e80' },
          ticks: { maxTicksLimit: 10 },
          grid: { display: false },
        },
        y: {
          title: { display: true, text: 'Half-Width (pp)', color: '#5e5e80' },
          min: 0,
        },
      },
      plugins: {
        tooltip: {
          backgroundColor: 'rgba(14,14,35,0.9)',
          borderColor: 'rgba(168,85,247,0.3)',
          borderWidth: 1,
          titleColor: '#e8e8f0',
          bodyColor: '#9a9ab8',
          cornerRadius: 8,
          padding: 12,
          callbacks: {
            title: items => `${items[0].parsed.x} seeds`,
            label: ctx => `Half-width: ${ctx.parsed.y.toFixed(3)} pp`,
          },
        },
        annotation: {
          annotations: {
            threshold: {
              type: 'line',
              yMin: 0.5,
              yMax: 0.5,
              borderColor: 'rgba(251,191,36,0.4)',
              borderDash: [6, 4],
              borderWidth: 1,
            },
          },
        },
      },
    },
  });
}

// ============================================================
// PARTICLE CANVAS
// ============================================================
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h;
  const particles = [];
  const N = 80;

  function resize() {
    w = canvas.width = canvas.offsetWidth;
    h = canvas.height = canvas.offsetHeight;
  }

  function create() {
    particles.length = 0;
    for (let i = 0; i < N; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(99,102,241,${0.1 * (1 - dist / 150)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    // Draw particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(129,140,248,0.5)';
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  resize();
  create();
  draw();
  window.addEventListener('resize', () => { resize(); create(); });
}

// ============================================================
// SCROLL REVEAL
// ============================================================
function initReveal() {
  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.delay || 0);
          setTimeout(() => entry.target.classList.add('visible'), delay);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  reveals.forEach(el => observer.observe(el));
}

// ============================================================
// ANIMATED COUNTERS
// ============================================================
function animateCounters() {
  const counters = document.querySelectorAll('.hero-stat-value[data-target], .counter[data-target]');
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.animated) return;
        el.dataset.animated = '1';
        const target = parseFloat(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        const isInt = Number.isInteger(target);
        const duration = 1800;
        const start = performance.now();

        function tick(now) {
          const t = Math.min((now - start) / duration, 1);
          // easeOutExpo
          const ease = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          const current = target * ease;
          el.textContent = (isInt ? Math.round(current) : current.toFixed(1)) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach(c => observer.observe(c));
}

// ============================================================
// RE METER ANIMATION
// ============================================================
function animateREMeter() {
  const fill = document.querySelector('.re-meter-fill');
  if (!fill) return;
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          fill.classList.add('animated');
        }
      });
    },
    { threshold: 0.3 }
  );
  observer.observe(fill);
}

// ============================================================
// NAV SCROLL EFFECT & ACTIVE LINK
// ============================================================
function initNav() {
  const nav = document.getElementById('main-nav');
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 50);

    // Active link
    let current = '';
    sections.forEach(sec => {
      const top = sec.offsetTop - 120;
      if (window.scrollY >= top) current = sec.id;
    });
    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  });

  // Mobile toggle
  const toggle = document.getElementById('nav-toggle');
  const links = document.querySelector('.nav-links');
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });
  navLinks.forEach(link => {
    link.addEventListener('click', () => links.classList.remove('open'));
  });
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initReveal();
  animateCounters();
  initNav();

  // Delay chart creation slightly for smooth page load
  setTimeout(() => {
    createSeedChart();
    createSplitsChart();
    createWinsChart();
    createGapChart();
    createCIChart();
    animateREMeter();
  }, 400);
});
