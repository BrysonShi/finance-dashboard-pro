/**
 * =============================================================
 * 风险雷达模块 - 动态风险评估
 * 根据实时市场数据计算风险等级
 * =============================================================
 */
window.RadarModule = (function() {
  'use strict';

  let cachedData = null;

  // =============================================================
  // 风险评估函数
  // =============================================================

  /**
   * 计算市场风险
   * - VIX > 25 = 高风险
   * - VIX > 18 = 中风险
   * - 金价波动率
   * - DXY变化（暂无数据时标记为未知）
   */
  function calculateMarketRisk(indices) {
    const items = indices?.items || [];
    
    // 查找各指数
    const gold = items.find(i => i.name?.includes('黄金'));
    const crude = items.find(i => i.name?.includes('原油'));
    const sh300 = items.find(i => i.name === '沪深300');
    const hsi = items.find(i => i.name === '恒生指数');
    const sp500 = items.find(i => i.name === '标普500');

    // 市场风险评估
    const risks = [];

    // 1. A股市场风险（基于沪深300涨跌）
    if (sh300) {
      const pct = Math.abs(sh300.changePct || 0);
      let level = 'low', value = pct * 10;
      if (pct > 2) { level = 'high'; value = 80; }
      else if (pct > 1) { level = 'medium'; value = 50; }
      else { level = 'low'; value = 25; }
      risks.push({ label: 'A股波动', level, value: Math.min(value, 100), description: `沪深300 ${sh300.changePct >= 0 ? '↑' : '↓'}${Math.abs(sh300.changePct).toFixed(2)}%` });
    } else {
      risks.push({ label: 'A股波动', level: 'unknown', value: 0, description: '数据待获取' });
    }

    // 2. 黄金波动风险
    if (gold) {
      const pct = Math.abs(gold.changePct || 0);
      let level = 'low', value = pct * 15;
      if (pct > 2) { level = 'high'; value = 75; }
      else if (pct > 1) { level = 'medium'; value = 45; }
      else { level = 'low'; value = 20; }
      risks.push({ label: '黄金波动', level, value: Math.min(value, 100), description: `${gold.changePct >= 0 ? '↑' : '↓'}${Math.abs(gold.changePct).toFixed(2)}%` });
    } else {
      risks.push({ label: '黄金波动', level: 'unknown', value: 0, description: '数据待获取' });
    }

    // 3. 原油市场风险
    if (crude) {
      const pct = Math.abs(crude.changePct || 0);
      let level = 'low', value = pct * 12;
      if (pct > 4) { level = 'high'; value = 70; }
      else if (pct > 2) { level = 'medium'; value = 40; }
      else { level = 'low'; value = 20; }
      risks.push({ label: '原油波动', level, value: Math.min(value, 100), description: `${crude.changePct >= 0 ? '↑' : '↓'}${Math.abs(crude.changePct).toFixed(2)}%` });
    } else {
      risks.push({ label: '原油波动', level: 'unknown', value: 0, description: '数据待获取' });
    }

    return risks;
  }

  /**
   * 计算宏观风险
   * - CPI > 3% = 高通胀风险（暂无数据时标记为未知）
   * - 美债收益率 > 4.5% = 高利率风险（暂无数据）
   * - 基于市场整体趋势
   */
  function calculateMacroRisk(indices) {
    const items = indices?.items || [];
    const risks = [];

    // 基于市场综合判断
    let avgChange = 0;
    let count = 0;
    items.forEach(item => {
      if (item.changePct != null) {
        avgChange += item.changePct;
        count++;
      }
    });
    if (count > 0) avgChange /= count;

    // 综合市场情绪
    let level = 'medium', value = 50;
    if (avgChange > 0.5) { level = 'low'; value = 25; }
    else if (avgChange > 0.2) { level = 'medium'; value = 45; }
    else if (avgChange < -0.5) { level = 'high'; value = 75; }
    else if (avgChange < -0.2) { level = 'medium'; value = 55; }
    
    risks.push({ label: '市场情绪', level, value, description: `综合涨跌 ${avgChange >= 0 ? '+' : ''}${avgChange.toFixed(2)}%` });

    // 通胀风险（无数据）
    risks.push({ label: '通胀风险', level: 'unknown', value: 0, description: '需参考CPI数据' });

    // 利率风险（无数据）
    risks.push({ label: '利率风险', level: 'unknown', value: 0, description: '需参考美债数据' });

    return risks;
  }

  /**
   * 计算流动性风险
   * 基于黄金和原油的成交量/价格稳定性
   */
  function calculateLiquidityRisk(indices) {
    const items = indices?.items || [];
    const risks = [];

    // 黄金流动性（基于价格变动幅度）
    const gold = items.find(i => i.name?.includes('黄金'));
    if (gold) {
      const volatility = Math.abs(gold.changePct || 0);
      // 波动大可能意味着流动性紧张
      let level = 'low', value = volatility * 8;
      if (volatility > 3) { level = 'high'; value = 70; }
      else if (volatility > 1.5) { level = 'medium'; value = 40; }
      risks.push({ label: '贵金属流动性', level, value: Math.min(value, 100), description: '正常' });
    } else {
      risks.push({ label: '贵金属流动性', level: 'unknown', value: 0, description: '数据待获取' });
    }

    // 原油流动性
    const crude = items.find(i => i.name?.includes('原油'));
    if (crude) {
      const volatility = Math.abs(crude.changePct || 0);
      let level = 'low', value = volatility * 8;
      if (volatility > 5) { level = 'high'; value = 70; }
      else if (volatility > 2) { level = 'medium'; value = 40; }
      risks.push({ label: '能源流动性', level, value: Math.min(value, 100), description: '正常' });
    } else {
      risks.push({ label: '能源流动性', level: 'unknown', value: 0, description: '数据待获取' });
    }

    // 股票市场流动性（基于A股变化）
    const sh300 = items.find(i => i.name === '沪深300');
    if (sh300) {
      const volatility = Math.abs(sh300.changePct || 0);
      let level = 'low', value = volatility * 10;
      if (volatility > 3) { level = 'high'; value = 75; }
      else if (volatility > 1.5) { level = 'medium'; value = 45; }
      risks.push({ label: 'A股流动性', level, value: Math.min(value, 100), description: '正常' });
    } else {
      risks.push({ label: 'A股流动性', level: 'unknown', value: 0, description: '数据待获取' });
    }

    return risks;
  }

  /**
   * 计算地缘风险
   * 基于财经日历中的重大事件
   */
  function calculateGeopoliticalRisk(calendarEvents) {
    const risks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!calendarEvents || calendarEvents.length === 0) {
      risks.push({ label: '重大事件', level: 'unknown', value: 0, description: '日历数据待获取' });
      risks.push({ label: '央行决议', level: 'unknown', value: 0, description: '数据待获取' });
      risks.push({ label: '数据发布', level: 'unknown', value: 0, description: '数据待获取' });
      return risks;
    }

    // 未来7天高重要性事件
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const upcomingHigh = calendarEvents.filter(e => {
      const eventDate = new Date(e.date);
      return e.importance === 'high' && eventDate >= today && eventDate <= nextWeek;
    });

    const fOMC = calendarEvents.filter(e => 
      e.importance === 'high' && 
      (e.event.includes('FOMC') || e.event.includes('美联储') || e.event.includes('利率决议')) &&
      new Date(e.date) >= today
    );

    // 基于事件数量评估风险
    let level = 'low', value = upcomingHigh.length * 15;
    if (upcomingHigh.length >= 3) { level = 'high'; value = 75; }
    else if (upcomingHigh.length >= 2) { level = 'medium'; value = 50; }
    risks.push({ label: '重大事件', level, value: Math.min(value, 100), description: `未来7天${upcomingHigh.length}个高重要性事件` });

    // 央行决议
    risks.push({ label: '央行决议', level: fOMC.length > 0 ? 'high' : 'low', value: fOMC.length > 0 ? 70 : 20, description: fOMC.length > 0 ? '近期有FOMC会议' : '近期无央行会议' });

    // 经济数据发布
    const dataEvents = calendarEvents.filter(e =>
      (e.event.includes('CPI') || e.event.includes('非农') || e.event.includes('GDP') || e.event.includes('PMI')) &&
      new Date(e.date) >= today && new Date(e.date) <= nextWeek
    );
    let dataLevel = 'low', dataValue = dataEvents.length * 12;
    if (dataEvents.length >= 3) { dataLevel = 'high'; dataValue = 70; }
    else if (dataEvents.length >= 2) { dataLevel = 'medium'; dataValue = 45; }
    risks.push({ label: '数据发布', level: dataLevel, value: Math.min(dataValue, 100), description: `近期${dataEvents.length}个重要数据` });

    return risks;
  }

  // =============================================================
  // 渲染函数
  // =============================================================

  /**
   * 渲染风险条
   */
  function renderRiskBar(risk) {
    const levelLabels = { low: '低', medium: '中', high: '高', unknown: '待评估' };
    const pct = risk.level === 'unknown' ? 0 : (risk.value || 0);
    
    return `
      <div class="risk-bar">
        <span class="risk-label">${risk.label}</span>
        <div class="risk-bar-track">
          <div class="risk-bar-fill ${risk.level}" style="width:${pct}%"></div>
        </div>
        <span class="risk-value">${levelLabels[risk.level] || '—'}</span>
      </div>
    `;
  }

  /**
   * 渲染风险卡片
   */
  function renderRiskCard(title, risks, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!risks || risks.length === 0) {
      container.innerHTML = '<div class="loading">数据加载中...</div>';
      return;
    }

    container.innerHTML = risks.map(renderRiskBar).join('');
  }

  // =============================================================
  // 主加载函数
  // =============================================================

  async function load() {
    try {
      // 并行获取所有数据
      const [indices, calendarData] = await Promise.all([
        window.ApiProxy.fetchMarketIndices(),
        fetch('data/calendar.json').then(r => r.json()).catch(() => null)
      ]);

      // 计算各类风险
      const marketRisks = calculateMarketRisk(indices);
      const macroRisks = calculateMacroRisk(indices);
      const liquidityRisks = calculateLiquidityRisk(indices);
      const geopoliticalRisks = calculateGeopoliticalRisk(calendarData?.events);

      cachedData = {
        market: marketRisks,
        macro: macroRisks,
        liquidity: liquidityRisks,
        geopolitical: geopoliticalRisks,
        updated_at: new Date().toISOString()
      };

      // 渲染
      renderRiskCard('市场风险', marketRisks, 'marketRiskBars');
      renderRiskCard('宏观风险', macroRisks, 'macroRiskBars');
      renderRiskCard('流动性风险', liquidityRisks, 'liquidityRiskBars');
      renderRiskCard('地缘风险', geopoliticalRisks, 'geopoliticalRiskBars');

      return cachedData;
    } catch (e) {
      console.error('风险雷达加载失败:', e);
      
      // 显示空状态
      const emptyState = '<div class="risk-bar"><span class="risk-label">—</span><div class="risk-bar-track"><div class="risk-bar-fill unknown" style="width:0%"></div></div><span class="risk-value">待评估</span></div>';
      ['marketRiskBars', 'macroRiskBars', 'liquidityRiskBars', 'geopoliticalRiskBars'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = emptyState;
      });
      
      return null;
    }
  }

  return {
    load,
    getCachedData: () => cachedData
  };
})();
