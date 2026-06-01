/**
 * =============================================================
 * 宏观数据模块 V3 - 核心驱动指标展示
 * 从 data/macro-data.json 读取宏观数据
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

  // 黄金关系说明
  const GOLD_RELATIONS = {
    tips_5y: { text: 'TIPS↑ → 黄金↓（负相关，黄金定价核心锚）', direction: 'inverse' },
    us10y: { text: '美债↑ → 黄金承压（机会成本上升）', direction: 'inverse' },
    dxy: { text: 'DXY↑ → 黄金↓（负相关，美元走强压制）', direction: 'inverse' },
    cpi_cn: { text: 'CPI↑ → 黄金↑（通胀避险需求）', direction: 'positive' },
    ppi_cn: { text: 'PPI↑ → 工业需求回暖，间接利好黄金', direction: 'positive' },
    pmi_mfg: { text: 'PMI>50 → 经济扩张，利好黄金需求', direction: 'positive' },
    m2_growth: { text: 'M2↑ → 货币宽松，黄金受益', direction: 'positive' },
    lpr_1y: { text: 'LPR↓ → 宽松信号，利好黄金', direction: 'positive' },
    cpi_us: { text: 'CPI↑ → 黄金↑（抗通胀需求）', direction: 'positive' },
    pce: { text: 'PCE↑ → Fed加息预期，黄金承压', direction: 'inverse' },
    nonfarm: { text: '非农↑ → 经济强劲，黄金吸引力下降', direction: 'inverse' },
    unemployment: { text: '失业率↑ → 经济疲弱，避险需求上升', direction: 'positive' },
    fed_rate: { text: 'Fed加息↑ → 黄金承压（机会成本）', direction: 'inverse' },
    brent: { text: '油价↑ → 通胀预期上升，黄金受益', direction: 'positive' },
    vix: { text: 'VIX↑ → 恐慌情绪，避险买盘增加', direction: 'positive' },
    gold: { text: '黄金为最终避险资产', direction: 'neutral' }
  };

  // =============================================================
  // 渲染函数
  // =============================================================

  function renderIndicator(ind, key) {
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

    const goldRelation = GOLD_RELATIONS[key]?.text || '';
    const goldRelationHtml = goldRelation ? `<div class="gold-relation">📌 ${goldRelation}</div>` : '';

    return `<div class="indicator-card ${alertClass}">
      ${alertBadge}
      <div class="name">${ind.name || '—'}</div>
      <div class="value">${ind.value || '—'}<span class="unit">${ind.unit || ''}</span></div>
      ${changeStr}
      <div class="period">${ind.period || ''} ${ind.source ? '· ' + ind.source : ''}</div>
      ${goldRelationHtml}
    </div>`;
  }

  /**
   * 渲染核心驱动指标 - V3版本
   */
  function renderCoreDrivers(data) {
    const container = document.getElementById('coreDrivers');
    if (!container) return;

    const items = [];

    // 从macro-data.json读取数据
    const macro = data.macroData || {};

    // 5年期TIPS实际利率（最重要）
    if (macro.global?.tips_5y) {
      const tips = macro.global.tips_5y;
      items.push({
        key: 'tips_5y',
        data: {
          name: '5Y TIPS实际利率',
          value: tips.value,
          unit: tips.unit,
          period: tips.period,
          source: tips.source,
          alert: parseFloat(tips.value) > 2
        }
      });
    }

    // 10年期美债收益率
    if (macro.global?.us10y) {
      const us10y = macro.global.us10y;
      items.push({
        key: 'us10y',
        data: {
          name: '10Y美债收益率',
          value: us10y.value,
          unit: us10y.unit,
          period: us10y.period,
          source: us10y.source,
          alert: parseFloat(us10y.value) > 4.5
        }
      });
    }

    // 美元指数
    if (macro.global?.dxy) {
      const dxy = macro.global.dxy;
      items.push({
        key: 'dxy',
        data: {
          name: '美元指数 DXY',
          value: dxy.value,
          unit: dxy.unit,
          period: dxy.period,
          source: dxy.source,
          alert: parseFloat(dxy.value) > 105
        }
      });
    }

    // 中国CPI
    if (macro.china?.cpi) {
      const cpi = macro.china.cpi;
      items.push({
        key: 'cpi_cn',
        data: {
          name: '中国CPI',
          value: cpi.value,
          unit: cpi.unit,
          period: cpi.period,
          source: cpi.source
        }
      });
    }

    // 中国PPI
    if (macro.china?.ppi) {
      const ppi = macro.china.ppi;
      items.push({
        key: 'ppi_cn',
        data: {
          name: '中国PPI',
          value: ppi.value,
          unit: ppi.unit,
          period: ppi.period,
          source: ppi.source
        }
      });
    }

    // 中国PMI
    if (macro.china?.pmi_mfg) {
      const pmi = macro.china.pmi_mfg;
      items.push({
        key: 'pmi_mfg',
        data: {
          name: '中国制造业PMI',
          value: pmi.value,
          unit: pmi.unit,
          period: pmi.period,
          source: pmi.source,
          alert: parseFloat(pmi.value) < 50
        }
      });
    }

    // M2增速
    if (macro.china?.m2_growth) {
      const m2 = macro.china.m2_growth;
      items.push({
        key: 'm2_growth',
        data: {
          name: '中国M2增速',
          value: m2.value,
          unit: m2.unit,
          period: m2.period,
          source: m2.source
        }
      });
    }

    // LPR
    if (macro.china?.lpr_1y) {
      const lpr = macro.china.lpr_1y;
      items.push({
        key: 'lpr_1y',
        data: {
          name: '1年期LPR',
          value: lpr.value,
          unit: lpr.unit,
          period: lpr.period,
          source: lpr.source
        }
      });
    }

    // 美国CPI
    if (macro.us?.cpi) {
      const cpi = macro.us.cpi;
      items.push({
        key: 'cpi_us',
        data: {
          name: '美国CPI',
          value: cpi.value,
          unit: cpi.unit,
          period: cpi.period,
          source: cpi.source,
          alert: parseFloat(cpi.value) > 3.5
        }
      });
    }

    // 核心PCE
    if (macro.us?.core_pce) {
      const pce = macro.us.core_pce;
      items.push({
        key: 'pce',
        data: {
          name: '美国核心PCE',
          value: pce.value,
          unit: pce.unit,
          period: pce.period,
          source: pce.source,
          alert: parseFloat(pce.value) > 2.5
        }
      });
    }

    // 非农就业
    if (macro.us?.nonfarm) {
      const nonfarm = macro.us.nonfarm;
      items.push({
        key: 'nonfarm',
        data: {
          name: '美国非农就业',
          value: nonfarm.value,
          unit: nonfarm.unit,
          period: nonfarm.period,
          source: nonfarm.source
        }
      });
    }

    // 失业率
    if (macro.us?.unemployment) {
      const ur = macro.us.unemployment;
      items.push({
        key: 'unemployment',
        data: {
          name: '美国失业率',
          value: ur.value,
          unit: ur.unit,
          period: ur.period,
          source: ur.source
        }
      });
    }

    // Fed利率
    if (macro.us?.fed_rate) {
      const fed = macro.us.fed_rate;
      items.push({
        key: 'fed_rate',
        data: {
          name: '美联储联邦基金利率',
          value: fed.value,
          unit: fed.unit,
          period: fed.period,
          source: fed.source
        }
      });
    }

    // 布伦特原油
    if (macro.global?.brent) {
      const brent = macro.global.brent;
      items.push({
        key: 'brent',
        data: {
          name: '布伦特原油',
          value: brent.value,
          unit: brent.unit,
          period: brent.period,
          source: brent.source
        }
      });
    }

    // VIX
    if (macro.global?.vix) {
      const vix = macro.global.vix;
      items.push({
        key: 'vix',
        data: {
          name: 'VIX恐慌指数',
          value: vix.value,
          unit: vix.unit,
          period: vix.period,
          source: vix.source,
          alert: parseFloat(vix.value) > 25
        }
      });
    }

    container.innerHTML = items.map(item => renderIndicator(item.data, item.key)).join('');
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
      const [goldUSD, crudeOil, marketIndices, rates, cbData, cftcData, macroData] = await Promise.all([
        window.ApiProxy.fetchGoldPriceUSD(),
        window.ApiProxy.fetchCrudeOil(),
        window.ApiProxy.fetchMarketIndices(),
        window.ApiProxy.fetchExchangeRates(),
        fetch('data/central-bank-gold.json').then(r => r.json()).catch(() => null),
        fetch('data/cftc.json').then(r => r.json()).catch(() => null),
        fetch('data/macro-data.json').then(r => r.json()).catch(() => null)
      ]);

      const data = {
        goldUSD,
        crudeOil,
        marketIndices,
        rates,
        tips: macroData?.global?.tips_5y,
        us10y: macroData?.global?.us10y,
        cbData,
        cftcData,
        macroData
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
