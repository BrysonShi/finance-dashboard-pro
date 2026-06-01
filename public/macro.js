/**
 * =============================================================
 * 宏观数据模块 - 纯前端版
 * 数据来源：open.er-api.com（汇率）、预置数据（其他宏观指标）
 * =============================================================
 */
window.MacroModule = (function() {
  'use strict';

  let cachedData = null;

  // =============================================================
  // 工具函数
  // =============================================================

  function trendIcon(trend) {
    return trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  }

  /**
   * 渲染单个指标卡片
   */
  function renderIndicator(key, ind) {
    if (!ind || ind.error) {
      return `<div class="indicator-card">
        <div class="name">${key}</div>
        <div class="value">—<span class="unit"></span></div>
        <div class="period">数据加载失败</div>
      </div>`;
    }

    const alertClass = ind.alert ? 'alert' : '';
    const alertBadge = ind.alert ? `<span class="alert-badge">⚠️</span>` : '';
    
    let changeStr = '';
    if (ind.change) {
      changeStr = `<div class="change ${ind.trend || ''}">${trendIcon(ind.trend)} ${ind.change}</div>`;
    } else if (ind.change_pct != null) {
      changeStr = `<div class="change ${ind.change_pct >= 0 ? 'up' : 'down'}">${ind.change_pct >= 0 ? '+' : ''}${ind.change_pct.toFixed(2)}%</div>`;
    }

    const sourceText = ind.source ? `<div class="period" style="margin-top:4px;font-size:9px;color:var(--text-3)">来源: ${ind.source}</div>` : '';

    return `<div class="indicator-card ${alertClass}">
      ${alertBadge}
      <div class="name">${ind.name}</div>
      <div class="value">${ind.value}<span class="unit">${ind.unit || ''}</span></div>
      ${changeStr}
      <div class="period">${ind.period || ''}</div>
      ${sourceText}
    </div>`;
  }

  /**
   * 渲染中国指标
   */
  function renderChinaIndicators(data) {
    const china = data.china || {};
    const container = document.getElementById('chinaIndicators');
    if (!container) return;
    container.innerHTML = Object.entries(china).map(([k, v]) => renderIndicator(k, v)).join('');
  }

  /**
   * 渲染美国指标
   */
  function renderUsIndicators(data) {
    const us = data.us || {};
    const container = document.getElementById('usIndicators');
    if (!container) return;
    container.innerHTML = Object.entries(us).map(([k, v]) => renderIndicator(k, v)).join('');
  }

  /**
   * 渲染全球指标
   */
  function renderGlobalIndicators(data) {
    const global = data.global || {};
    const container = document.getElementById('globalIndicators');
    if (!container) return;
    container.innerHTML = Object.entries(global).map(([k, v]) => renderIndicator(k, v)).join('');
  }

  /**
   * 渲染更新时间
   */
  function renderUpdateTime(data) {
    const updateEl = document.getElementById('lastUpdate');
    if (updateEl && data.updated_at) {
      try {
        const date = new Date(data.updated_at);
        updateEl.textContent = '更新: ' + date.toLocaleTimeString('zh-CN');
      } catch (e) {
        updateEl.textContent = '更新: —';
      }
    }
  }

  // =============================================================
  // 主加载函数
  // =============================================================

  async function load() {
    try {
      const data = await window.ApiProxy.fetchMacroData();
      cachedData = data;

      renderChinaIndicators(data);
      renderUsIndicators(data);
      renderGlobalIndicators(data);
      renderUpdateTime(data);

      return data;
    } catch (e) {
      console.error('宏观数据加载失败:', e);
      
      // 使用fallback数据渲染
      const fallbackData = window.ApiProxy.getFallbackMacroData();
      renderChinaIndicators(fallbackData);
      renderUsIndicators(fallbackData);
      renderGlobalIndicators(fallbackData);
      
      return fallbackData;
    }
  }

  return {
    load,
    getCachedData: () => cachedData
  };
})();
