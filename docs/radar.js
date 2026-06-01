/**
 * =============================================================
 * 风险雷达模块 - Canvas仪表盘 + 四维风险评估
 * =============================================================
 */
window.RadarModule = (function() {
  'use strict';

  let cachedData = null;

  // =============================================================
  // Canvas仪表盘绘制
  // =============================================================

  function drawGauge(canvasId, score, maxScore = 100) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    // 清空
    ctx.clearRect(0, 0, rect.width, rect.height);

    // 背景弧
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.strokeStyle = '#1f2533';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 渐变色弧（根据分数）
    const scoreAngle = startAngle + (score / maxScore) * (endAngle - startAngle);
    
    // 创建渐变
    const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
    gradient.addColorStop(0, '#3ddc97');   // 绿
    gradient.addColorStop(0.5, '#ffb454');  // 黄
    gradient.addColorStop(1, '#ff5c7a');    // 红

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, scoreAngle);
    ctx.strokeStyle = score < 30 ? '#3ddc97' : score < 60 ? '#ffb454' : '#ff5c7a';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 指针
    const needleAngle = startAngle + (score / maxScore) * (endAngle - startAngle);
    const needleLength = radius - 25;
    const needleX = centerX + Math.cos(needleAngle) * needleLength;
    const needleY = centerY + Math.sin(needleAngle) * needleLength;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(needleX, needleY);
    ctx.strokeStyle = '#e8ecf3';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 中心圆
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#e8ecf3';
    ctx.fill();

    // 分数文字
    ctx.fillStyle = '#e8ecf3';
    ctx.font = 'bold 28px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(score), centerX, centerY + 5);

    // 分数标签
    ctx.fillStyle = '#5e677a';
    ctx.font = '10px Inter';
    ctx.fillText('风险指数', centerX, centerY + 22);

    // 等级标签
    let levelLabel = '低风险';
    let levelColor = '#3ddc97';
    if (score >= 60) {
      levelLabel = '高风险';
      levelColor = '#ff5c7a';
    } else if (score >= 30) {
      levelLabel = '中风险';
      levelColor = '#ffb454';
    }
    
    ctx.fillStyle = levelColor;
    ctx.font = 'bold 11px Inter';
    ctx.fillText(levelLabel, centerX, centerY + 38);
  }

  // =============================================================
  // 风险计算
  // =============================================================

  /**
   * 计算市场风险
   */
  function calculateMarketRisk(data) {
    const risks = [];
    
    // 黄金30日波动率
    const volatility = data.indicators?.volatility;
    if (volatility != null) {
      let level = 'low', value = Math.min(volatility * 4, 100), desc = `${volatility.toFixed(1)}%，正常水平`;
      if (volatility > 15) { level = 'high'; desc = `${volatility.toFixed(1)}%，波动加剧`; }
      else if (volatility > 10) { level = 'medium'; desc = `${volatility.toFixed(1)}%，波动适中`; }
      risks.push({ label: '黄金波动率', level, value, desc, benchmark: '近1年45%分位' });
    } else {
      risks.push({ label: '黄金波动率', level: 'unknown', value: 0, desc: '数据暂不可用' });
    }

    // 金油比异常
    if (data.goldOilRatio) {
      const ratio = data.goldOilRatio.value;
      let level = 'low', value = Math.min(ratio * 2, 100), desc = data.goldOilRatio.comment;
      if (ratio > 30) { level = 'high'; value = 80; }
      else if (ratio > 25) { level = 'medium'; value = 55; }
      risks.push({ label: '金油比', level, value, desc, benchmark: '正常区间15-25' });
    }

    // A股波动
    const sh300 = data.marketIndices?.items?.find(i => i.name === '沪深300');
    if (sh300) {
      const pct = Math.abs(sh300.changePct || 0);
      let level = 'low', value = pct * 8, desc = `${sh300.changePct >= 0 ? '↑' : '↓'}${pct.toFixed(2)}%`;
      if (pct > 2) { level = 'high'; value = 75; }
      else if (pct > 1) { level = 'medium'; value = 45; }
      risks.push({ label: 'A股波动', level, value: Math.min(value, 100), desc });
    }

    return risks;
  }

  /**
   * 计算宏观风险
   */
  function calculateMacroRisk(data) {
    const risks = [];

    // TIPS利率方向
    if (data.tips?.value != null) {
      const tips = data.tips.value;
      let level = tips > 2 ? 'high' : tips > 1 ? 'medium' : 'low';
      let value = Math.min(tips * 30, 100);
      risks.push({ label: 'TIPS利率', level, value, desc: `${tips.toFixed(2)}%，${tips > 1 ? '实际利率偏高' : '实际利率正常'}` });
    } else {
      risks.push({ label: 'TIPS利率', level: 'unknown', value: 0, desc: '数据暂不可用' });
    }

    // 美债收益率
    if (data.us10y?.value != null) {
      const us10y = data.us10y.value;
      let level = us10y > 4.5 ? 'high' : us10y > 4 ? 'medium' : 'low';
      let value = Math.min(us10y * 15, 100);
      risks.push({ label: '美债收益率', level, value, desc: `${us10y.toFixed(2)}%，${us10y > 4 ? '利率压力较大' : '利率正常'}` });
    } else {
      risks.push({ label: '美债收益率', level: 'unknown', value: 0, desc: '数据暂不可用' });
    }

    // 美元指数
    const dxy = data.marketIndices?.items?.find(i => i.name === '美元指数');
    if (dxy?.price) {
      const dxyVal = dxy.price;
      let level = dxyVal > 105 ? 'high' : dxyVal > 100 ? 'medium' : 'low';
      let value = Math.min(dxyVal, 100);
      risks.push({ label: '美元指数', level, value, desc: `${dxyVal.toFixed(2)}，${dxyVal > 100 ? '美元偏强' : '美元偏弱'}` });
    }

    return risks;
  }

  /**
   * 计算流动性风险
   */
  function calculateLiquidityRisk(data) {
    const risks = [];

    // ETF持仓变化
    risks.push({ label: 'ETF持仓', level: 'unknown', value: 0, desc: '数据暂不可用' });

    // CFTC净多头极端度
    if (data.cftc?.latest) {
      const pct = data.cftc.extremes?.current_vs_high_pct || 0;
      let level = pct < 10 ? 'high' : pct > 60 ? 'high' : 'low';
      let value = pct < 10 ? 75 : pct > 60 ? 70 : 25;
      let desc = pct < 10 ? '极低水平，反转信号' : pct > 60 ? '拥挤交易风险' : '正常水平';
      risks.push({ label: 'CFTC净多头', level, value, desc });
    } else {
      risks.push({ label: 'CFTC净多头', level: 'unknown', value: 0, desc: '数据暂不可用' });
    }

    return risks;
  }

  /**
   * 计算地缘风险
   */
  function calculateGeopoliticalRisk(calendarData) {
    const risks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    if (calendarData?.events) {
      const upcomingHigh = calendarData.events.filter(e => {
        const eventDate = new Date(e.date);
        return e.importance === 'high' && eventDate >= today && eventDate <= nextWeek;
      });

      const middleEastEvents = calendarData.events.filter(e => 
        (e.event.includes('中东') || e.event.includes('伊朗') || e.event.includes('以色列') || e.event.includes('沙特'))
        && new Date(e.date) >= today
      );

      let level = 'low', value = upcomingHigh.length * 20;
      if (upcomingHigh.length >= 3) { level = 'high'; value = 80; }
      else if (upcomingHigh.length >= 2) { level = 'medium'; value = 55; }
      risks.push({ label: '重大事件', level, value: Math.min(value, 100), desc: `未来7天${upcomingHigh.length}个高重要性事件` });

      level = middleEastEvents.length > 0 ? 'high' : 'low';
      value = middleEastEvents.length > 0 ? 70 : 20;
      risks.push({ label: '中东事件', level, value, desc: middleEastEvents.length > 0 ? '有相关事件' : '暂无中东事件' });
    } else {
      risks.push({ label: '重大事件', level: 'unknown', value: 0, desc: '日历数据暂不可用' });
      risks.push({ label: '中东事件', level: 'unknown', value: 0, desc: '日历数据暂不可用' });
    }

    return risks;
  }

  /**
   * 计算综合风险评分
   */
  function calculateOverallScore(risks) {
    let totalWeight = 0;
    let weightedScore = 0;
    
    const weights = {
      market: 0.3,
      macro: 0.3,
      liquidity: 0.2,
      geopolitical: 0.2
    };

    Object.entries(risks).forEach(([category, items]) => {
      if (items.length === 0) return;
      const avgValue = items.reduce((sum, r) => sum + (r.value || 0), 0) / items.length;
      weightedScore += avgValue * (weights[category] || 0.25);
      totalWeight += weights[category] || 0.25;
    });

    return totalWeight > 0 ? weightedScore / totalWeight * 1.2 : 50; // 调整系数使分数更分散
  }

  // =============================================================
  // 渲染函数
  // =============================================================

  function renderRiskBar(risk) {
    const levelLabels = { low: '低', medium: '中', high: '高', unknown: '待评估' };
    const pct = risk.level === 'unknown' ? 0 : (risk.value || 0);
    
    return `
      <div class="risk-bar">
        <span class="risk-label">${risk.label}</span>
        <div class="risk-bar-track">
          <div class="risk-bar-fill ${risk.level}" style="width:${pct}%"></div>
        </div>
        <span class="risk-value" style="color:var(--${risk.level === 'high' ? 'danger' : risk.level === 'medium' ? 'warn' : risk.level === 'low' ? 'ok' : 'text-2'})">${levelLabels[risk.level] || '—'}</span>
      </div>
      <div class="risk-desc">${risk.desc}${risk.benchmark ? ` · ${risk.benchmark}` : ''}</div>
    `;
  }

  function renderRiskCard(title, risks, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!risks || risks.length === 0) {
      container.innerHTML = '<div class="risk-bar"><span style="color:var(--text-3)">数据加载中...</span></div>';
      return;
    }

    container.innerHTML = risks.map(renderRiskBar).join('');
  }

  // =============================================================
  // 主加载函数
  // =============================================================

  async function load() {
    try {
      // 获取数据
      const [goldUSD, crudeOil, marketIndices, calendarData] = await Promise.all([
        window.ApiProxy.fetchGoldPriceUSD(),
        window.ApiProxy.fetchCrudeOil(),
        window.ApiProxy.fetchMarketIndices(),
        fetch('data/calendar.json').then(r => r.json()).catch(() => null)
      ]);

      // 计算技术指标
      let indicators = null;
      const historyData = await window.ApiProxy.fetchGoldHistory('day', 60);
      if (historyData && historyData.length > 0) {
        indicators = {
          volatility: window.Indicators?.calcVolatility(historyData, 30)
        };
      }

      // 计算金油比
      let goldOilRatio = null;
      if (goldUSD?.price && crudeOil?.price) {
        const ratio = goldUSD.price / crudeOil.price;
        goldOilRatio = {
          value: ratio,
          comment: ratio > 30 ? '危机模式' : ratio < 15 ? '经济过热' : '正常区间'
        };
      }

      // 组装数据
      const data = {
        goldUSD,
        crudeOil,
        marketIndices,
        indicators,
        goldOilRatio,
        tips: null,
        us10y: null,
        cftc: null
      };

      // 计算各类风险
      const marketRisks = calculateMarketRisk(data);
      const macroRisks = calculateMacroRisk(data);
      const liquidityRisks = calculateLiquidityRisk(data);
      const geopoliticalRisks = calculateGeopoliticalRisk(calendarData);

      // 综合评分
      const risks = {
        market: marketRisks,
        macro: macroRisks,
        liquidity: liquidityRisks,
        geopolitical: geopoliticalRisks
      };
      const overallScore = calculateOverallScore(risks);

      cachedData = {
        ...data,
        risks,
        overallScore,
        calendarData
      };

      // 渲染仪表盘
      drawGauge('riskGauge', overallScore);

      // 渲染风险条
      renderRiskCard('市场风险', marketRisks, 'marketRiskBars');
      renderRiskCard('宏观风险', macroRisks, 'macroRiskBars');
      renderRiskCard('流动性风险', liquidityRisks, 'liquidityRiskBars');
      renderRiskCard('地缘风险', geopoliticalRisks, 'geopoliticalRiskBars');

      return cachedData;
    } catch (e) {
      console.error('风险雷达加载失败:', e);
      drawGauge('riskGauge', 50); // 默认中间值
      return null;
    }
  }

  return {
    load,
    getCachedData: () => cachedData,
    drawGauge
  };
})();
