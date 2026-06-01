/**
 * =============================================================
 * 风险雷达模块 V3 - Canvas仪表盘 + 四维风险评估
 * 从 macro-data.json 读取数据
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
    const macro = data.macroData || {};
    
    // 黄金30日波动率
    const volatility = data.indicators?.volatility;
    if (volatility != null) {
      let level = 'low', value = Math.min(volatility * 4, 100), desc = `${volatility.toFixed(1)}%，正常水平`;
      let action = '暂无特殊操作建议';
      if (volatility > 15) { 
        level = 'high'; 
        value = 75; 
        desc = `${volatility.toFixed(1)}%，波动加剧`;
        action = '降低仓位，避免追涨杀跌';
      }
      else if (volatility > 10) { 
        level = 'medium'; 
        value = 50; 
        desc = `${volatility.toFixed(1)}%，波动适中`;
        action = '控制仓位，做好止损准备';
      }
      risks.push({ label: '黄金波动率', level, value, desc, action, benchmark: '近1年45%分位' });
    } else {
      risks.push({ label: '黄金波动率', level: 'unknown', value: 0, desc: '数据暂不可用', action: '—' });
    }

    // VIX恐慌指数
    const vix = macro.global?.vix?.value;
    if (vix != null) {
      const vixNum = parseFloat(vix);
      let level = vixNum > 30 ? 'high' : vixNum > 20 ? 'medium' : 'low';
      let value = Math.min(vixNum * 2, 100);
      let action = '观望为主';
      if (vixNum > 30) {
        action = '增加黄金配置避险';
      } else if (vixNum > 20) {
        action = '适当配置黄金';
      }
      risks.push({ label: 'VIX恐慌指数', level, value, desc: `${vixNum}（${level === 'high' ? '恐慌' : level === 'medium' ? '谨慎' : '正常'}）`, action, benchmark: '正常<20' });
    }

    // 金油比异常
    if (data.goldOilRatio) {
      const ratio = data.goldOilRatio.value;
      let level = 'low', value = Math.min(ratio * 2, 100), desc = data.goldOilRatio.comment;
      let action = '正常经济环境';
      if (ratio > 30) { level = 'high'; value = 80; action = '危机预警，关注黄金'; }
      else if (ratio > 25) { level = 'medium'; value = 55; action = '保持关注'; }
      risks.push({ label: '金油比', level, value, desc, action, benchmark: '正常区间15-25' });
    }

    return risks;
  }

  /**
   * 计算宏观风险
   */
  function calculateMacroRisk(data) {
    const risks = [];
    const macro = data.macroData || {};

    // TIPS利率方向
    const tips = macro.global?.tips_5y?.value;
    if (tips != null) {
      const tipsNum = parseFloat(tips);
      let level = tipsNum > 2 ? 'high' : tipsNum > 1 ? 'medium' : 'low';
      let value = Math.min(tipsNum * 30, 100);
      let action = '实际利率正常，黄金有支撑';
      if (tipsNum > 2) {
        action = '实际利率偏高，黄金承压';
      } else if (tipsNum > 1) {
        action = '实际利率偏高，谨慎持有';
      }
      risks.push({ label: 'TIPS利率', level, value, desc: `${tipsNum.toFixed(2)}%，${tipsNum > 1 ? '实际利率偏高' : '实际利率正常'}`, action, benchmark: '<1%正常' });
    } else {
      risks.push({ label: 'TIPS利率', level: 'unknown', value: 0, desc: '数据暂不可用', action: '—' });
    }

    // 美债收益率
    const us10y = macro.global?.us10y?.value;
    if (us10y != null) {
      const us10yNum = parseFloat(us10y);
      let level = us10yNum > 4.5 ? 'high' : us10yNum > 4 ? 'medium' : 'low';
      let value = Math.min(us10yNum * 15, 100);
      let action = '美债收益率正常';
      if (us10yNum > 4.5) {
        action = '美债收益率偏高，黄金承压';
      } else if (us10yNum > 4) {
        action = '关注美债走势';
      }
      risks.push({ label: '美债收益率', level, value, desc: `${us10yNum.toFixed(2)}%，${us10yNum > 4 ? '利率压力较大' : '利率正常'}`, action, benchmark: '<4%正常' });
    }

    // 美元指数
    const dxy = macro.global?.dxy?.value;
    if (dxy != null) {
      const dxyNum = parseFloat(dxy);
      let level = dxyNum > 105 ? 'high' : dxyNum > 100 ? 'medium' : 'low';
      let value = Math.min(dxyNum, 100);
      let action = '美元偏弱，黄金受益';
      if (dxyNum > 105) {
        action = '美元强势，黄金承压';
      } else if (dxyNum > 100) {
        action = '美元偏强，压制黄金';
      }
      risks.push({ label: '美元指数DXY', level, value, desc: `${dxyNum}，${dxyNum > 100 ? '美元偏强' : '美元偏弱'}`, action, benchmark: '<100偏弱' });
    }

    // 美国CPI
    const cpi = macro.us?.cpi?.value;
    if (cpi != null) {
      const cpiNum = parseFloat(cpi);
      let level = cpiNum > 4 ? 'high' : cpiNum > 3 ? 'medium' : 'low';
      let value = Math.min(cpiNum * 15, 100);
      let action = '通胀温和，利于黄金';
      if (cpiNum > 4) {
        action = '通胀偏高，降息预期降低';
      } else if (cpiNum > 3) {
        action = '通胀压力，关注美联储';
      }
      risks.push({ label: '美国CPI', level, value, desc: `${cpiNum}%同比`, action, benchmark: '<3%正常' });
    }

    return risks;
  }

  /**
   * 计算流动性风险
   */
  function calculateLiquidityRisk(data) {
    const risks = [];


    // CFTC净多头极端度
    if (data.cftc?.latest) {
      const pct = data.cftc.extremes?.current_vs_high_pct || 0;
      let level = pct < 10 ? 'high' : pct > 60 ? 'high' : 'low';
      let value = pct < 10 ? 75 : pct > 60 ? 70 : 25;
      let action = pct < 10 ? '极低水平，可能是反向信号' : pct > 60 ? '拥挤交易，注意反转风险' : '正常水平';
      risks.push({ label: 'CFTC净多头', level, value, desc: `历史高点${pct.toFixed(1)}%`, action, benchmark: '<10%极低' });
    } else {
      risks.push({ label: 'CFTC净多头', level: 'unknown', value: 0, desc: '数据暂不可用', action: '—' });
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
        (e.event.includes('中东') || e.event.includes('伊朗') || e.event.includes('以色列') || e.event.includes('沙特') || e.event.includes('FOMC'))
        && new Date(e.date) >= today
      );

      let level = 'low', value = upcomingHigh.length * 20;
      let action = '暂无重大风险事件';
      if (upcomingHigh.length >= 3) { level = 'high'; value = 80; action = '密集风险事件，保持警惕'; }
      else if (upcomingHigh.length >= 2) { level = 'medium'; value = 55; action = '关注重要事件'; }
      risks.push({ label: '本周高重要性', level, value: Math.min(value, 100), desc: `${upcomingHigh.length}个高重要性事件`, action, benchmark: '未来7天' });

      level = middleEastEvents.length > 0 ? 'high' : 'low';
      value = middleEastEvents.length > 0 ? 70 : 20;
      action = middleEastEvents.length > 0 ? '地缘风险升温' : '暂无中东相关事件';
      risks.push({ label: '地缘相关事件', level, value, desc: middleEastEvents.length > 0 ? `${middleEastEvents.length}个相关事件` : '暂无', action, benchmark: '—' });
    } else {
      risks.push({ label: '重大事件', level: 'unknown', value: 0, desc: '日历数据暂不可用', action: '—' });
      risks.push({ label: '中东事件', level: 'unknown', value: 0, desc: '日历数据暂不可用', action: '—' });
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

    return totalWeight > 0 ? weightedScore / totalWeight * 1.2 : 50;
  }

  // =============================================================
  // 渲染函数
  // =============================================================

  function renderRiskBar(risk) {
    const levelLabels = { low: '低', medium: '中', high: '高', unknown: '待评估' };
    const pct = risk.level === 'unknown' ? 0 : (risk.value || 0);
    const color = risk.level === 'high' ? 'var(--danger)' : risk.level === 'medium' ? 'var(--warn)' : risk.level === 'low' ? 'var(--ok)' : 'var(--text-2)';
    
    return `
      <div class="risk-bar">
        <span class="risk-label">${risk.label}</span>
        <div class="risk-bar-track">
          <div class="risk-bar-fill ${risk.level}" style="width:${pct}%"></div>
        </div>
        <span class="risk-value" style="color:${color}">${levelLabels[risk.level] || '—'}</span>
      </div>
      <div class="risk-desc">${risk.desc}${risk.benchmark ? ` · ${risk.benchmark}` : ''}</div>
      ${risk.action ? `<div class="risk-action">💡 ${risk.action}</div>` : ''}
    `;
  }

  function renderRiskCard(title, risks, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!risks || risks.length === 0) {
      container.innerHTML = '<div class="risk-bar"><span style="color:var(--text-3)">部分数据待补充</span></div>';
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
      const [goldUSD, crudeOil, marketIndices, calendarData, macroData] = await Promise.all([
        window.ApiProxy.fetchGoldPriceUSD(),
        window.ApiProxy.fetchCrudeOil(),
        window.ApiProxy.fetchMarketIndices(),
        fetch('data/calendar.json').then(r => r.json()).catch(() => null),
        fetch('data/macro-data.json').then(r => r.json()).catch(() => null)
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

      // 获取CFTC数据
      let cftcData = null;
      try {
        cftcData = await fetch('data/cftc.json').then(r => r.json());
      } catch (e) {
        console.warn('CFTC数据加载失败:', e);
      }

      // 组装数据
      const data = {
        goldUSD,
        crudeOil,
        marketIndices,
        indicators,
        goldOilRatio,
        tips: macroData?.global?.tips_5y,
        us10y: macroData?.global?.us10y,
        cftc: cftcData ? { latest: cftcData.history[0], extremes: cftcData.extremes } : null,
        macroData
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
      drawGauge('riskGauge', 50);
      return null;
    }
  }

  return {
    load,
    getCachedData: () => cachedData,
    drawGauge
  };
})();
