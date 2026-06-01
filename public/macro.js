// =============================================================
// 宏观监控模块
// =============================================================
window.MacroModule = (function() {
  'use strict';

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : '/api';

  let cachedData = null;

  function trendIcon(trend) {
    return trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  }

  function renderIndicator(key, ind, category) {
    if (!ind || ind.error) {
      return `<div class="indicator-card"><div class="name">${key}</div><div class="value">—<span class="unit"></span></div></div>`;
    }
    const alertClass = ind.alert ? 'alert' : '';
    const alertBadge = ind.alert ? `<span class="alert-badge">⚠️</span>` : '';
    const changeStr = ind.change ? `<div class="change ${ind.trend}">${trendIcon(ind.trend)} ${Math.abs(ind.change)}</div>` : '';
    return `<div class="indicator-card ${alertClass}">${alertBadge}<div class="name">${ind.name}</div><div class="value">${ind.value}<span class="unit">${ind.unit || ''}</span></div>${changeStr}<div class="period">${ind.period || ''}</div></div>`;
  }

  function renderChinaIndicators(data) {
    const china = data.china || {};
    const container = document.getElementById('chinaIndicators');
    if (!container) return;
    container.innerHTML = Object.entries(china).map(([k, v]) => renderIndicator(k, v, 'china')).join('');
  }

  function renderUsIndicators(data) {
    const us = data.us || {};
    const container = document.getElementById('usIndicators');
    if (!container) return;
    container.innerHTML = Object.entries(us).map(([k, v]) => renderIndicator(k, v, 'us')).join('');
  }

  function renderGlobalIndicators(data) {
    const global = data.global || {};
    const container = document.getElementById('globalIndicators');
    if (!container) return;
    container.innerHTML = Object.entries(global).map(([k, v]) => renderIndicator(k, v, 'global')).join('');
  }

  async function load() {
    try {
      const resp = await fetch(API_BASE + '/macro/');
      if (!resp.ok) throw new Error('API error: ' + resp.status);
      const data = await resp.json();
      cachedData = data;
      renderChinaIndicators(data);
      renderUsIndicators(data);
      renderGlobalIndicators(data);
      return data;
    } catch (e) {
      console.error('宏观数据加载失败:', e);
      return cachedData;
    }
  }

  return { load, getCachedData: () => cachedData };
})();
