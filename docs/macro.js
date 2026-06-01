/**
 * =============================================================
 * 宏观数据模块 - 核心驱动指标展示
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

  // =============================================================
  // 渲染函数
  // =============================================================

  function renderIndicator(ind) {
    if (!ind) {
      return `<div class="indicator-card">
        <div class="name">—</div>
        <div class="value">—<span class="unit"></span></div>
        <div class="period">数据暂不可用</div>
      </div>`;
    }

    const alertClass = ind.alert ? 'alert' : '';
    const alertBadge = ind.alert ? `<span class="alert-badge">⚠️</span>` : '';
    
    let changeStr = '';
    if (ind.change_pct != null) {
      changeStr = `<div class="change ${ind.change_pct >= 0 ? 'up' : 'down'}">${ind.change_pct >= 0 ? '+' : ''}${ind.change_pct.toFixed(2)}%</div>`;
    }

    return `<div class="indicator-card ${alertClass}">
      ${alertBadge}
      <div class="name">${ind.name || '—'}</div>
      <div class="value">${ind.value || '—'}<span class="unit">${ind.unit || ''}</span></div>
      ${changeStr}
      <div class="period">${ind.period || ''}</div>
    </div>`;
  }

  /**
   * 渲染核心驱动指标
   */
  function renderCoreDrivers(data) {
    const container = document.getElementById('coreDrivers');
    if (!container) return;

    const items = [];

    // 5年期TIPS实际利率（最重要，放最前面）
    items.push({
      name: '5Y TIPS实际利率',
      value: data.tips?.value || '—',
      unit: '%',
      period: data.tips?.period || '',
      change_pct: data.tips?.change,
      alert: data.tips?.value > 2,
      note: 'TIPS↑ → 黄金↓（负相关）'
    });

    // 10年期美债收益率
    items.push({
      name: '10Y美债收益率',
      value: data.us10y?.value || '—',
      unit: '%',
      period: data.us10y?.period || '',
      change_pct: data.us10y?.change,
      alert: data.us10y?.value > 4.5,
      note: '美债↑ → 黄金承压'
    });

    // 美元指数
    const dxy = data.marketIndices?.items?.find(i => i.name === '美元指数');
    if (dxy) {
      items.push({
        name: '美元指数 DXY',
        value: dxy.price?.toFixed(2) || '—',
        unit: '',
        period: dxy.source || '',
        change_pct: dxy.changePct,
        note: 'DXY↑ → 黄金↓（负相关）'
      });
    }

    // 黄金
    if (data.goldUSD) {
      items.push({
        name: '现货黄金',
        value: data.goldUSD.price?.toFixed(2) || '—',
        unit: 'USD/oz',
        period: data.goldUSD.lastUpdated || '',
        change_pct: data.goldUSD.changePct,
        note: '避险需求定价锚'
      });
    }

    container.innerHTML = items.map(renderIndicator).join('');
  }

  /**
   * 渲染央行购金
   */
  function renderCentralBankGold(data) {
    const container = document.getElementById('centralBankGold');
    if (!container || !data) {
      if (container) container.innerHTML = '<div class="empty-state"><div class="text">数据暂不可用</div></div>';
      return;
    }

    let html = `
      <div class="cb-card">
        <div class="cb-header">
          <span>2025全年央行购金</span>
          <span class="cb-value">${data.total_2025}吨</span>
        </div>
        <div class="cb-note">同比2024年(${data.total_2024}吨)有所下降，但仍处历史高位</div>
      </div>
    `;

    html += '<div class="cb-list">';
    data.countries.forEach(c => {
      const impactColor = c.impact === '利好' ? 'var(--ok)' : c.impact === '利空' ? 'var(--danger)' : 'var(--text-2)';
      html += `
        <div class="cb-item">
          <div class="cb-country">${c.name}</div>
          <div class="cb-data">
            <span>连续${c.consecutive_months}月增持</span>
            <span class="cb-tonnes">约${c.latest_monthly_tonnes}吨/月</span>
          </div>
          <div class="cb-impact" style="color:${impactColor}">${c.impact}</div>
        </div>
      `;
    });
    html += '</div>';

    container.innerHTML = html;
  }

  /**
   * 渲染CFTC持仓
   */
  function renderCFTC(data) {
    const container = document.getElementById('cftcData');
    if (!container || !data) {
      if (container) container.innerHTML = '<div class="empty-state"><div class="text">数据暂不可用</div></div>';
      return;
    }

    const latest = data.history[0];
    const prev = data.history[1];
    const change = latest.change_tonnes;
    const changeClass = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

    // 判断极端程度
    const pctOfHigh = data.extremes?.current_vs_high_pct || 0;
    let extremeLabel = '正常';
    let extremeColor = 'var(--text-2)';
    if (pctOfHigh < 10) {
      extremeLabel = '反转信号';
      extremeColor = 'var(--ok)';
    } else if (pctOfHigh > 60) {
      extremeLabel = '拥挤交易';
      extremeColor = 'var(--danger)';
    }

    container.innerHTML = `
      <div class="cftc-card">
        <div class="cftc-main">
          <div class="cftc-value">${(latest.net_long_tonnes || 0).toFixed(1)}吨</div>
          <div class="cftc-label">管理基金净多头（最新）</div>
        </div>
        <div class="cftc-change ${changeClass}">
          ${change > 0 ? '+' : ''}${change.toFixed(1)}吨/周
        </div>
      </div>
      <div class="cftc-meta">
        <span>占持仓量 <strong>${latest.pct_of_open_interest?.toFixed(1)}%</strong></span>
        <span style="color:${extremeColor}">${extremeLabel}（历史高点${pctOfHigh?.toFixed(1)}%）</span>
      </div>
      <div class="cftc-note">${data.extremes?.interpretation || ''}</div>
    `;
  }

  /**
   * 渲染黄金ETF
   */
  function renderGoldETF() {
    const container = document.getElementById('goldETF');
    if (!container) return;
    
    // ETF数据暂不可用
    container.innerHTML = `
      <div class="indicator-card">
        <div class="name">SPDR黄金ETF (GLD)</div>
        <div class="value">—<span class="unit">吨</span></div>
        <div class="period">数据暂不可用</div>
      </div>
      <div class="indicator-card">
        <div class="name">iShares黄金ETF (IAU)</div>
        <div class="value">—<span class="unit">吨</span></div>
        <div class="period">数据暂不可用</div>
      </div>
    `;
  }

  // =============================================================
  // 主加载函数
  // =============================================================

  async function load() {
    try {
      const [goldUSD, crudeOil, marketIndices, rates, cbData, cftcData] = await Promise.all([
        window.ApiProxy.fetchGoldPriceUSD(),
        window.ApiProxy.fetchCrudeOil(),
        window.ApiProxy.fetchMarketIndices(),
        window.ApiProxy.fetchExchangeRates(),
        fetch('data/central-bank-gold.json').then(r => r.json()).catch(() => null),
        fetch('data/cftc.json').then(r => r.json()).catch(() => null)
      ]);

      const data = {
        goldUSD,
        crudeOil,
        marketIndices,
        rates,
        tips: null, // TIPS数据暂无接口
        us10y: null, // 美债数据暂无接口
        cbData,
        cftcData
      };

      cachedData = data;

      // 渲染
      renderCoreDrivers(data);
      renderCentralBankGold(cbData);
      renderCFTC(cftcData);
      renderGoldETF();

      return data;
    } catch (e) {
      console.error('宏观数据加载失败:', e);
      return null;
    }
  }

  return {
    load,
    getCachedData: () => cachedData
  };
})();
