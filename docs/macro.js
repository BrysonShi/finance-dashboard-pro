/**
 * =============================================================
 * 宏观数据模块 - 纯前端版
 * 数据来源：真实API获取，无假数据fallback
 * =============================================================
 */
window.MacroModule = (function() {
  'use strict';

  let cachedData = null;

  // =============================================================
  // 工具函数
  // =============================================================

  function trendIcon(trend) {
    return trend === 'up' ? '↑' : trend === 'down' ? '↓' : '—';
  }

  /**
   * 渲染单个指标卡片（空状态）
   */
  function renderEmptyIndicator(name) {
    return `<div class="indicator-card">
      <div class="name">${name}</div>
      <div class="value">—<span class="unit"></span></div>
      <div class="period">数据加载中...</div>
    </div>`;
  }

  /**
   * 渲染单个指标卡片
   */
  function renderIndicator(ind) {
    if (!ind) {
      return renderEmptyIndicator('—');
    }

    const alertClass = ind.alert ? 'alert' : '';
    const alertBadge = ind.alert ? `<span class="alert-badge">⚠️</span>` : '';
    
    let changeStr = '';
    if (ind.change) {
      changeStr = `<div class="change ${ind.trend || ''}">${trendIcon(ind.trend)} ${ind.change}</div>`;
    } else if (ind.change_pct != null) {
      changeStr = `<div class="change ${ind.change_pct >= 0 ? 'up' : 'down'}">${ind.change_pct >= 0 ? '+' : ''}${ind.change_pct.toFixed(2)}%</div>`;
    }

    const sourceText = ind.source ? `<div class="source">来源: ${ind.source}</div>` : '';

    return `<div class="indicator-card ${alertClass}">
      ${alertBadge}
      <div class="name">${ind.name || '—'}</div>
      <div class="value">${ind.value || '—'}<span class="unit">${ind.unit || ''}</span></div>
      ${changeStr}
      <div class="period">${ind.period || ''}</div>
      ${sourceText}
    </div>`;
  }

  /**
   * 渲染空状态容器
   */
  function renderEmptyContainer(message) {
    return `<div class="empty-state"><div class="icon">📊</div><div class="text">${message || '数据暂不可用'}</div></div>`;
  }

  /**
   * 渲染中国指标
   */
  function renderChinaIndicators(data) {
    const container = document.getElementById('chinaIndicators');
    if (!container) return;

    // 中国宏观指标需要手动更新（官方月度发布）
    // 这里显示可用数据 + 提示
    const indicators = [
      // 实际可获取的数据
      data?.global?.gold,
      // 空状态提示（需手动更新）
      null, null, null, null // CPI/PPI/PMI/M2/LPR
    ].filter(Boolean);

    if (indicators.length === 0) {
      container.innerHTML = `
        <div class="indicator-card">
          <div class="name">说明</div>
          <div class="value" style="font-size:12px;color:var(--text-2)">中国宏观指标（CPI/PPI/PMI/M2/LPR）为月度数据，由国家统计局/央行定期发布。</div>
          <div class="source" style="margin-top:8px">请参考官方发布平台获取最新数据</div>
        </div>
        <div class="indicator-card">
          <div class="name">📍 AU9999 (CNY)</div>
          <div class="value">${data?.global?.gold?.value || '—'}<span class="unit">${data?.global?.gold?.unit || ''}</span></div>
          <div class="period">${data?.global?.gold?.period || ''}</div>
          <div class="source">来源: ${data?.global?.gold?.source || '—'}</div>
        </div>
      `;
    } else {
      container.innerHTML = indicators.map(renderIndicator).join('');
    }
  }

  /**
   * 渲染美国指标
   */
  function renderUsIndicators(data) {
    const container = document.getElementById('usIndicators');
    if (!container) return;

    container.innerHTML = `
      <div class="indicator-card">
        <div class="name">说明</div>
        <div class="value" style="font-size:12px;color:var(--text-2)">美国宏观指标（CPI/PCE/非农/失业率/Fed Rate）由劳工统计局/美联储定期发布。</div>
        <div class="source" style="margin-top:8px">请参考美联储官网获取最新数据</div>
      </div>
      <div class="indicator-card">
        <div class="name">📊 S&P 500</div>
        <div class="value">${data?.market_indices?.items?.find(i => i.name === '标普500')?.price?.toFixed(2) || '—'}<span class="unit"></span></div>
        <div class="period">${data?.market_indices?.items?.find(i => i.name === '标普500')?.updateTime || ''}</div>
        <div class="source">来源: ${data?.market_indices?.items?.find(i => i.name === '标普500')?.source || '—'}</div>
      </div>
      <div class="indicator-card">
        <div class="name">🛢️ WTI原油</div>
        <div class="value">${data?.global?.crude?.price?.toFixed(2) || '—'}<span class="unit">USD/桶</span></div>
        <div class="period">${data?.global?.crude?.updateTime || ''}</div>
        <div class="source">来源: ${data?.global?.crude?.source || '—'}</div>
      </div>
    `;
  }

  /**
   * 渲染全球指标
   */
  function renderGlobalIndicators(data) {
    const container = document.getElementById('globalIndicators');
    if (!container) return;

    const items = [];

    // 黄金
    if (data?.global?.gold) {
      items.push({
        name: '🥇 现货黄金',
        value: data.global.gold.value,
        unit: data.global.gold.unit,
        period: data.global.gold.period,
        trend: data.global.gold.trend,
        change: data.global.gold.change,
        source: data.global.gold.source
      });
    }

    // 原油
    if (data?.global?.crude) {
      items.push({
        name: '🛢️ WTI原油',
        value: data.global.crude.price?.toFixed(2),
        unit: 'USD/桶',
        period: data.global.crude.updateTime,
        trend: data.global.crude.trend,
        change: (data.global.crude.changePct >= 0 ? '+' : '') + data.global.crude.changePct?.toFixed(2) + '%',
        source: data.global.crude.source
      });
    }

    // 汇率
    if (data?.exchange_rates) {
      items.push({
        name: '💱 USD/CNY',
        value: data.exchange_rates.USD_CNY?.toFixed(4),
        unit: '',
        period: data.exchange_rates.last_updated ? new Date(data.exchange_rates.last_updated).toLocaleString('zh-CN') : '',
        source: data.exchange_rates.source
      });
    }

    // A股
    const sh000300 = data?.market_indices?.items?.find(i => i.name === '沪深300');
    if (sh000300) {
      items.push({
        name: '📈 沪深300',
        value: sh000300.price?.toFixed(2),
        unit: '',
        period: sh000300.updateTime,
        trend: sh000300.trend,
        change: (sh000300.changePct >= 0 ? '+' : '') + sh000300.changePct?.toFixed(2) + '%',
        source: sh000300.source
      });
    }

    // 恒生指数
    const hsi = data?.market_indices?.items?.find(i => i.name === '恒生指数');
    if (hsi) {
      items.push({
        name: '📈 恒生指数',
        value: hsi.price?.toFixed(2),
        unit: '',
        period: hsi.updateTime,
        trend: hsi.trend,
        change: (hsi.changePct >= 0 ? '+' : '') + hsi.changePct?.toFixed(2) + '%',
        source: hsi.source
      });
    }

    if (items.length === 0) {
      container.innerHTML = renderEmptyContainer('数据加载中...');
    } else {
      container.innerHTML = items.map(renderIndicator).join('');
    }
  }

  // =============================================================
  // 主加载函数
  // =============================================================

  async function load() {
    try {
      const data = await window.ApiProxy.fetchMacroData();
      
      if (!data) {
        throw new Error('宏观数据获取失败');
      }

      cachedData = data;

      renderChinaIndicators(data);
      renderUsIndicators(data);
      renderGlobalIndicators(data);

      return data;
    } catch (e) {
      console.error('宏观数据加载失败:', e);
      
      // 显示空状态
      ['chinaIndicators', 'usIndicators', 'globalIndicators'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = renderEmptyContainer('数据暂不可用，请稍后重试');
      });
      
      return null;
    }
  }

  return {
    load,
    getCachedData: () => cachedData
  };
})();
