// =============================================================
// 黄金监控模块
// =============================================================
window.GoldModule = (function() {
  'use strict';

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : '/api';

  let cachedData = null;

  function fmt(n) { return n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('en-US'); }

  function renderPriceCards(data) {
    const prices = data.prices || {};
    const position = data.position || {};
    const usdPrice = prices.usd_per_oz || {};
    const cnyPrice = prices.cny_per_gram || {};

    const usdEl = document.getElementById('goldUsdPrice');
    const usdChangeEl = document.getElementById('goldUsdChange');
    if (usdEl) usdEl.textContent = usdPrice.price ? '$' + usdPrice.price.toFixed(2) : '—';
    if (usdChangeEl && usdPrice.change_pct != null) {
      usdChangeEl.textContent = (usdPrice.change_pct >= 0 ? '↑' : '↓') + Math.abs(usdPrice.change_pct).toFixed(2) + '%';
      usdChangeEl.className = 'delta ' + (usdPrice.change_pct >= 0 ? 'up' : 'down');
    }

    const cnyEl = document.getElementById('goldCnyPrice');
    const cnyChangeEl = document.getElementById('goldCnyChange');
    if (cnyEl) cnyEl.textContent = cnyPrice.price ? '¥' + cnyPrice.price.toFixed(2) : '—';
    if (cnyChangeEl && cnyPrice.change_pct != null) {
      cnyChangeEl.textContent = (cnyPrice.change_pct >= 0 ? '↑' : '↓') + Math.abs(cnyPrice.change_pct).toFixed(2) + '%';
      cnyChangeEl.className = 'delta ' + (cnyPrice.change_pct >= 0 ? 'up' : 'down');
    }

    const mvEl = document.getElementById('goldMarketValue');
    const costEl = document.getElementById('goldCost');
    const pnlEl = document.getElementById('goldPnl');
    if (mvEl) mvEl.textContent = position.market_value ? '¥' + fmt(position.market_value) : '—';
    if (costEl) costEl.textContent = position.total_cost ? '¥' + fmt(position.total_cost) : '—';
    if (pnlEl && position.unrealized_pnl != null) {
      const pnl = position.unrealized_pnl;
      pnlEl.textContent = (pnl >= 0 ? '+' : '') + fmt(pnl) + ' (' + (position.unrealized_pnl_pct || 0).toFixed(2) + '%)';
      pnlEl.className = 'delta ' + (pnl >= 0 ? 'up' : 'down');
    }
  }

  function renderSignals(data) {
    const signals = data.signals || [];
    const summary = data.signals_summary || {};
    const grid = document.getElementById('signalGrid');
    const alertArea = document.getElementById('goldAlertArea');

    if (!grid) return;
    grid.innerHTML = signals.map(s => {
      const cls = s.status === 'green' ? 'green' : s.status === 'yellow' ? 'yellow' : 'gray';
      const txt = s.status === 'green' ? '满足' : s.status === 'yellow' ? '待确认' : '无法确认';
      return `<div class="signal-item"><div class="signal-light ${cls}"></div><span class="signal-name">${s.name}</span><span class="signal-status ${cls}">${txt}</span></div>`;
    }).join('');

    if (alertArea) {
      const greenCount = summary.green_count || 0;
      if (greenCount >= 2) {
        alertArea.innerHTML = `<div class="alert-banner"><span class="alert-icon">⚠️</span><span class="alert-text"><strong>${greenCount}条信号满足</strong> - ${summary.recommendation || '建议加仓'}</span></div>`;
      } else {
        alertArea.innerHTML = `<div class="alert-banner ok"><span class="alert-icon">✓</span><span class="alert-text ok"><strong>${greenCount}条信号满足</strong> - 继续观望</span></div>`;
      }
    }
  }

  function renderKeyLevels(data) {
    const levels = data.key_levels || {};
    const supportEl = document.getElementById('supportLevels');
    const resistEl = document.getElementById('resistanceLevels');
    if (supportEl) supportEl.innerHTML = (levels.support || []).map(v => `<div class="level-item support"><div class="level-label">支撑</div><div class="level-value">${v}</div></div>`).join('');
    if (resistEl) resistEl.innerHTML = (levels.resistance || []).map(v => `<div class="level-item resistance"><div class="level-label">阻力</div><div class="level-value">${v}</div></div>`).join('');
  }

  function renderChart(data) {
    const prices = data.prices || {};
    const usdPrice = prices.usd_per_oz || {};
    const svg = document.getElementById('goldChart');
    if (!svg) return;
    const price = usdPrice.price || 2300;
    const ma200 = usdPrice.ma200 || 2100;
    const baseY = 80;
    const priceY = baseY - (price - 2000) / 100 * 50;
    const maY = baseY - (ma200 - 2000) / 100 * 50;
    svg.innerHTML = `
      <defs><linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#d4a64a;stop-opacity:0.3"/><stop offset="100%" style="stop-color:#d4a64a;stop-opacity:0"/></linearGradient></defs>
      <line x1="0" y1="${baseY}" x2="400" y2="${baseY}" stroke="#1f2533" stroke-dasharray="4,4"/>
      <text x="5" y="${baseY - 5}" fill="#3e4658" font-size="9" font-family="JetBrains Mono">${price}</text>
      <line x1="0" y1="${maY}" x2="400" y2="${maY}" stroke="#7aa2ff" stroke-width="2" opacity="0.7"/>
      <text x="5" y="${maY - 5}" fill="#7aa2ff" font-size="9" font-family="JetBrains Mono">MA200: ${ma200.toFixed(0)}</text>
      <path d="M 0 100 Q 100 85 200 70 T 400 ${priceY}" fill="none" stroke="#d4a64a" stroke-width="2"/>
      <path d="M 0 100 Q 100 85 200 70 T 400 ${priceY} L 400 120 L 0 120 Z" fill="url(#goldGrad)"/>
      <circle cx="380" cy="${priceY}" r="4" fill="#d4a64a"/>
      <text x="200" y="115" fill="${price > ma200 ? '#3ddc97' : '#ff5c7a'}" font-size="10" font-family="JetBrains Mono" text-anchor="middle">${price > ma200 ? '✓ 金价位于MA200上方' : '○ 金价位于MA200下方'}</text>
    `;
  }

  async function load() {
    try {
      const resp = await fetch(API_BASE + '/gold/');
      if (!resp.ok) throw new Error('API error: ' + resp.status);
      const data = await resp.json();
      cachedData = data;
      renderPriceCards(data);
      renderSignals(data);
      renderKeyLevels(data);
      renderChart(data);
      return data;
    } catch (e) {
      console.error('黄金数据加载失败:', e);
      return cachedData;
    }
  }

  return { load, getCachedData: () => cachedData };
})();
