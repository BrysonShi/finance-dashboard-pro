/**
 * =============================================================
 * 黄金监控模块 - 黄金决策看板核心
 * 数据来源：腾讯财经 qt.gtimg.cn（黄金期货）+ 汇率换算
 * =============================================================
 */
window.GoldModule = (function() {
  'use strict';

  // 关键价位配置
  const KEY_LEVELS = {
    support: [4360, 4450, 4500],
    resistance: [4600, 4700]
  };

  // 加仓信号配置（与财经日历10条规则对齐）
  const SIGNALS_CONFIG = [
    { 
      key: 'ma200_test', 
      name: '金价测试MA200(4360)企稳', 
      description: '现货黄金测试4360美元（200日均线）企稳反弹',
      autoJudge: true // 可自动判断
    },
    { 
      key: 'au9999_950', 
      name: 'AU9999跌破950元/克', 
      description: '国内金价调整至950元/克以下',
      autoJudge: true
    },
    { 
      key: 'rsi_oversold_div', 
      name: 'RSI超卖+底背离', 
      description: 'RSI进入超卖区(<30)后出现底背离',
      autoJudge: true
    },
    { 
      key: 'price_reclaim_4500', 
      name: '金价重新站上4500美元', 
      description: '金价重新站上4500美元且确认支撑',
      autoJudge: true
    },
    { 
      key: 'us10y_retreat', 
      name: '美债收益率回落>20bp', 
      description: '10年期美债收益率从高点回落超过20个基点',
      autoJudge: false // 需人工判断
    },
    { 
      key: 'dxy_below_98', 
      name: '美元指数跌破98', 
      description: 'DXY美元指数跌破98关口',
      autoJudge: true
    },
    { 
      key: 'fed_dovish', 
      name: '美联储释放偏鸽信号', 
      description: 'FOMC会议或官员讲话释放降息预期',
      autoJudge: false
    },
    { 
      key: 'geopolitical_calm', 
      name: '中东局势缓和但黄金未跟跌', 
      description: '地缘风险缓和，但黄金未跟随下跌',
      autoJudge: false
    },
    { 
      key: 'etf_inflow', 
      name: '黄金ETF连续3日净流入', 
      description: 'SPDR等黄金ETF连续3个交易日录得净流入',
      autoJudge: false
    },
    { 
      key: 'cftc_netlong_recover', 
      name: 'COMEX管理基金净多头回升', 
      description: 'CFTC报告显示管理基金净多头持仓回升',
      autoJudge: false
    }
  ];

  let cachedData = null;
  let chartInstance = null;

  // =============================================================
  // 工具函数
  // =============================================================

  function fmt(n, decimals = 2) {
    if (n == null || isNaN(n)) return '—';
    return n.toFixed(decimals);
  }

  // =============================================================
  // 数据处理
  // =============================================================

  /**
   * 评估加仓信号状态
   */
  function evaluateSignals(data) {
    const signals = SIGNALS_CONFIG.map(signal => {
      let status = 'gray'; // 默认：数据不足
      let detail = '需实时数据判断';

      switch (signal.key) {
        case 'ma200_test':
          // MA200 ≈ 4360，检查当前价格是否接近
          if (data.goldUSD?.price) {
            const price = data.goldUSD.price;
            if (price >= 4360 && price <= 4450) {
              status = 'yellow'; // 在MA200附近
              detail = `当前$${fmt(price)}，接近MA200`;
            } else if (price > 4450) {
              status = 'green'; // 在MA200上方企稳
              detail = `当前$${fmt(price)}，高于MA200`;
            } else {
              status = 'red'; // 跌破MA200
              detail = `当前$${fmt(price)}，低于MA200`;
            }
          }
          break;

        case 'au9999_950':
          // 检查AU9999是否跌破950
          if (data.goldCNY?.price) {
            const price = data.goldCNY.price;
            if (price < 950) {
              status = 'green'; // 跌破950是买入信号
              detail = `当前¥${fmt(price)}，已跌破950`;
            } else {
              status = 'red';
              detail = `当前¥${fmt(price)}，高于950`;
            }
          }
          break;

        case 'rsi_oversold_div':
          // 需要RSI数据，这里标记为待确认
          if (data.indicators?.rsi) {
            const rsi = data.indicators.rsi;
            if (rsi < 30) {
              status = 'yellow';
              detail = `RSI=${fmt(rsi,0)}，已进入超卖区`;
            } else if (rsi < 50) {
              status = 'yellow';
              detail = `RSI=${fmt(rsi,0)}，偏弱区域`;
            } else {
              status = 'red';
              detail = `RSI=${fmt(rsi,0)}，不在超卖区`;
            }
          }
          break;

        case 'price_reclaim_4500':
          if (data.goldUSD?.price) {
            const price = data.goldUSD.price;
            if (price >= 4500) {
              status = 'green';
              detail = `当前$${fmt(price)}，已站上4500`;
            } else {
              status = 'red';
              detail = `当前$${fmt(price)}，未到4500`;
            }
          }
          break;

        case 'us10y_retreat':
          // 需人工判断
          status = 'yellow';
          detail = '需查看美债收益率数据';
          break;

        case 'dxy_below_98':
          if (data.marketIndices) {
            const dxy = data.marketIndices.items?.find(i => i.name === '美元指数');
            if (dxy?.price) {
              if (dxy.price < 98) {
                status = 'green';
                detail = `DXY=${fmt(dxy.price)}，已跌破98`;
              } else {
                status = 'red';
                detail = `DXY=${fmt(dxy.price)}，高于98`;
              }
            }
          }
          break;

        case 'fed_dovish':
          // 需人工判断
          status = 'yellow';
          detail = '需关注FOMC信号';
          break;

        case 'geopolitical_calm':
          // 需人工判断
          status = 'yellow';
          detail = '需观察地缘局势';
          break;

        case 'etf_inflow':
          // 数据难获取
          status = 'yellow';
          detail = 'ETF数据暂不可用';
          break;

        case 'cftc_netlong_recover':
          // 使用内置CFTC数据
          if (data.cftc?.latest) {
            const latest = data.cftc.latest;
            const prev = data.cftc.previous;
            if (latest.change_contracts > 0) {
              status = 'green';
              detail = `净多头增加${fmt(latest.change_tonnes)}吨`;
            } else {
              status = 'red';
              detail = `净多头减少${fmt(Math.abs(latest.change_tonnes))}吨`;
            }
          }
          break;
      }

      return {
        ...signal,
        status,
        detail
      };
    });

    return signals;
  }

  /**
   * 获取信号汇总
   */
  function getSignalsSummary(signals) {
    const greenCount = signals.filter(s => s.status === 'green').length;
    const yellowCount = signals.filter(s => s.status === 'yellow').length;
    const redCount = signals.filter(s => s.status === 'red').length;
    
    let description;
    if (greenCount >= 7) {
      description = '偏多信号较强';
    } else if (greenCount >= 5) {
      description = '偏多';
    } else if (greenCount >= 3) {
      description = '偏多观望';
    } else {
      description = '信号不足';
    }

    return {
      green_count: greenCount,
      yellow_count: yellowCount,
      red_count: redCount,
      description: `${greenCount}/10条信号触发，${description}`
    };
  }

  /**
   * 计算金油比
   */
  function calcGoldOilRatio(goldUSD, crudeOil) {
    if (!goldUSD?.price || !crudeOil?.price) return null;
    
    const ratio = goldUSD.price / crudeOil.price;
    let status = 'normal';
    let comment = '正常区间(15-25)';
    
    if (ratio > 30) {
      status = 'crisis';
      comment = '危机模式 (>30)';
    } else if (ratio < 15) {
      status = 'overheat';
      comment = '经济过热 (<15)';
    }
    
    // 计算历史分位数（简化：假设正常区间15-30）
    const percentile = Math.min(Math.max((ratio - 15) / 15 * 50, 0), 100);
    
    return {
      value: ratio,
      status,
      comment,
      percentile: fmt(percentile),
      gold_price: goldUSD.price,
      oil_price: crudeOil.price
    };
  }

  // =============================================================
  // Canvas 图表渲染
  // =============================================================

  /**
   * 绘制金价走势图
   */
  function drawGoldChart(canvasId, data) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // 设置Canvas尺寸
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 60, bottom: 30, left: 10 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // 清空画布
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, width, height);
    
    if (!data || data.length === 0) {
      ctx.fillStyle = '#5e677a';
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText('数据加载中...', width / 2, height / 2);
      return;
    }

    // 计算价格范围
    const prices = data.map(d => d.close);
    const minPrice = Math.min(...prices) * 0.98;
    const maxPrice = Math.max(...prices) * 1.02;
    const priceRange = maxPrice - minPrice;
    
    // 绘制网格线
    ctx.strokeStyle = '#1f2533';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      // Y轴标签
      const price = maxPrice - (priceRange / 4) * i;
      ctx.fillStyle = '#5e677a';
      ctx.font = '10px JetBrains Mono';
      ctx.textAlign = 'right';
      ctx.fillText('$' + Math.round(price), width - 5, y + 3);
    }

    // 绘制关键价位线
    const drawLevelLine = (price, color, label) => {
      const y = padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
      if (y >= padding.top && y <= height - padding.bottom) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = color;
        ctx.font = '9px JetBrains Mono';
        ctx.textAlign = 'left';
        ctx.fillText(label, padding.left + 5, y - 3);
      }
    };

    // 支撑位和阻力位
    KEY_LEVELS.support.forEach(level => {
      if (level >= minPrice && level <= maxPrice) {
        drawLevelLine(level, '#3ddc97', level.toString());
      }
    });
    KEY_LEVELS.resistance.forEach(level => {
      if (level >= minPrice && level <= maxPrice) {
        drawLevelLine(level, '#ff5c7a', level.toString());
      }
    });

    // 计算MA200
    const ma200 = window.Indicators?.calcMA(data, 200) || [];
    
    // 绘制MA200线
    if (ma200.length > 0) {
      ctx.strokeStyle = '#7aa2ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      
      let started = false;
      ma200.forEach((point, i) => {
        const dataIndex = point.index;
        if (dataIndex >= 0 && dataIndex < data.length) {
          const x = padding.left + (dataIndex / (data.length - 1)) * chartWidth;
          const y = padding.top + chartHeight - ((point.value - minPrice) / priceRange) * chartHeight;
          
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 绘制金价面积图
    ctx.beginPath();
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, 'rgba(212, 166, 74, 0.3)');
    gradient.addColorStop(1, 'rgba(212, 166, 74, 0)');
    
    // 价格线
    data.forEach((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((d.close - minPrice) / priceRange) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // 闭合面积
    const lastX = padding.left + chartWidth;
    const bottomY = height - padding.bottom;
    ctx.lineTo(lastX, bottomY);
    ctx.lineTo(padding.left, bottomY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // 重新画价格线
    ctx.beginPath();
    ctx.strokeStyle = '#d4a64a';
    ctx.lineWidth = 2;
    data.forEach((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((d.close - minPrice) / priceRange) * chartHeight;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 绘制当前价格标注
    const lastPrice = data[data.length - 1].close;
    const lastY = padding.top + chartHeight - ((lastPrice - minPrice) / priceRange) * chartHeight;
    
    ctx.beginPath();
    ctx.arc(width - padding.right - 5, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#d4a64a';
    ctx.fill();

    // 价格标签
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(width - padding.right - 5, lastY - 10, 55, 20);
    ctx.strokeStyle = '#d4a64a';
    ctx.strokeRect(width - padding.right - 5, lastY - 10, 55, 20);
    
    ctx.fillStyle = '#d4a64a';
    ctx.font = 'bold 10px JetBrains Mono';
    ctx.textAlign = 'center';
    ctx.fillText('$' + Math.round(lastPrice), width - padding.right + 22, lastY + 4);

    // X轴日期标签
    ctx.fillStyle = '#5e677a';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'center';
    const dateLabels = [0, Math.floor(data.length / 2), data.length - 1];
    dateLabels.forEach(idx => {
      if (data[idx]) {
        const x = padding.left + (idx / (data.length - 1)) * chartWidth;
        const dateStr = data[idx].date?.substring(2, 10) || '';
        ctx.fillText(dateStr, x, height - 8);
      }
    });
  }

  // =============================================================
  // 渲染函数
  // =============================================================

  function renderPriceCards(goldUSD, goldCNY) {
    // USD价格
    const usdEl = document.getElementById('goldUsdPrice');
    const usdChangeEl = document.getElementById('goldUsdChange');
    
    if (goldUSD && goldUSD.price) {
      if (usdEl) usdEl.textContent = '$' + fmt(goldUSD.price);
      if (usdChangeEl) {
        const pct = goldUSD.changePct || 0;
        usdChangeEl.textContent = (pct >= 0 ? '↑' : '↓') + Math.abs(pct).toFixed(2) + '%';
        usdChangeEl.className = 'delta ' + (pct >= 0 ? 'up' : 'down');
      }
    } else {
      if (usdEl) usdEl.textContent = '—';
      if (usdChangeEl) { usdChangeEl.textContent = '—'; usdChangeEl.className = 'delta flat'; }
    }

    // CNY价格
    const cnyEl = document.getElementById('goldCnyPrice');
    const cnyChangeEl = document.getElementById('goldCnyChange');
    
    if (goldCNY && goldCNY.price) {
      if (cnyEl) cnyEl.textContent = '¥' + fmt(goldCNY.price);
      if (cnyChangeEl) {
        const pct = goldCNY.changePct || 0;
        cnyChangeEl.textContent = (pct >= 0 ? '↑' : '↓') + Math.abs(pct).toFixed(2) + '%';
        cnyChangeEl.className = 'delta ' + (pct >= 0 ? 'up' : 'down');
      }
    } else {
      if (cnyEl) cnyEl.textContent = '—';
      if (cnyChangeEl) { cnyChangeEl.textContent = '—'; cnyChangeEl.className = 'delta flat'; }
    }
  }

  function renderKeyLevels() {
    const supportEl = document.getElementById('supportLevels');
    const resistEl = document.getElementById('resistanceLevels');

    if (supportEl) {
      supportEl.innerHTML = KEY_LEVELS.support.map(v => 
        `<div class="level-item support"><div class="level-label">支撑</div><div class="level-value">${v}</div></div>`
      ).join('');
    }
    if (resistEl) {
      resistEl.innerHTML = KEY_LEVELS.resistance.map(v => 
        `<div class="level-item resistance"><div class="level-label">阻力</div><div class="level-value">${v}</div></div>`
      ).join('');
    }
  }

  function renderSignals(signals, summary) {
    const grid = document.getElementById('signalGrid');
    const summaryEl = document.getElementById('signalSummary');

    if (!signals || signals.length === 0) {
      if (grid) {
        grid.innerHTML = '<div class="empty-state"><div class="icon">🥇</div><div class="text">数据加载中...</div></div>';
      }
      return;
    }

    if (grid) {
      grid.innerHTML = signals.map(s => {
        const cls = s.status;
        const statusText = {
          green: '满足',
          yellow: '待确认',
          red: '未满足',
          gray: '数据不足'
        }[cls] || '—';
        return `<div class="signal-item" title="${s.description}\n${s.detail}">
          <div class="signal-light ${cls}"></div>
          <span class="signal-name">${s.name}</span>
          <span class="signal-status ${cls}">${statusText}</span>
        </div>`;
      }).join('');
    }

    if (summaryEl) {
      summaryEl.textContent = summary.description;
    }
  }

  function renderGoldOilRatio(ratio) {
    const el = document.getElementById('goldOilRatio');
    if (!el || !ratio) {
      if (el) el.innerHTML = '<span style="color:var(--text-2)">暂不可用</span>';
      return;
    }

    const statusClass = {
      normal: '',
      crisis: 'style="color:var(--danger)"',
      overheat: 'style="color:var(--warn)"'
    }[ratio.status] || '';

    el.innerHTML = `
      <span class="num" ${statusClass}>${fmt(ratio.value, 1)}</span>
      <span style="color:var(--text-2);font-size:11px"> (金/油比 ${ratio.comment})</span>
    `;
  }

  function renderSeasonality(data) {
    const el = document.getElementById('seasonalityInfo');
    if (!el || !data) return;

    const monthNames = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
    const currentMonth = new Date().getMonth() + 1;
    const monthData = data.months.find(m => m.month === currentMonth);
    
    if (monthData) {
      el.innerHTML = `<strong>${monthNames[currentMonth-1]}</strong>历史：${monthData.up}涨${monthData.down}跌，中位数${monthData.median_pct >= 0 ? '+' : ''}${monthData.median_pct}%`;
    }
  }

  function renderExchangeHedge(goldUSD, goldCNY, rates) {
    const el = document.getElementById('exchangeHedge');
    if (!el || !goldUSD || !goldCNY || !rates) return;

    // 简化：显示汇率对冲说明
    el.innerHTML = `<span style="color:var(--text-2)">USD/CNY=${fmt(rates.USD_CNY, 4)} · 美元走强时，人民币贬值会部分对冲金价涨幅</span>`;
  }

  // =============================================================
  // 主加载函数
  // =============================================================

  async function load() {
    try {
      // 并行获取所有数据
      const [goldUSD, goldCNY, crudeOil, historyData, marketIndices, seasonality, cftcData] = await Promise.all([
        window.ApiProxy.fetchGoldPriceUSD(),
        window.ApiProxy.fetchGoldPriceCNY(),
        window.ApiProxy.fetchCrudeOil(),
        window.ApiProxy.fetchGoldHistory('day', 250),
        window.ApiProxy.fetchMarketIndices(),
        fetch('data/seasonality.json').then(r => r.json()).catch(() => null),
        fetch('data/cftc.json').then(r => r.json()).catch(() => null)
      ]);

      // 计算技术指标
      let indicators = null;
      if (historyData && historyData.length > 0) {
        indicators = {
          ma200: window.Indicators?.calcMA(historyData, 200)?.pop()?.value,
          ma50: window.Indicators?.calcMA(historyData, 50)?.pop()?.value,
          rsi: window.Indicators?.calcRSI(historyData, 14)?.pop()?.value,
          volatility: window.Indicators?.calcVolatility(historyData, 30)
        };
      }

      // 组装数据
      const data = {
        goldUSD,
        goldCNY,
        crudeOil,
        history: historyData,
        marketIndices,
        indicators,
        seasonality,
        cftc: cftcData ? {
          latest: cftcData.history[0],
          previous: cftcData.history[1]
        } : null
      };

      cachedData = data;

      // 渲染
      renderPriceCards(goldUSD, goldCNY);
      renderKeyLevels();
      
      // 绘制图表
      if (historyData && historyData.length > 0) {
        drawGoldChart('goldChart', historyData);
      }

      // 评估信号
      const signals = evaluateSignals(data);
      const summary = getSignalsSummary(signals);
      renderSignals(signals, summary);

      // 金油比
      const ratio = calcGoldOilRatio(goldUSD, crudeOil);
      renderGoldOilRatio(ratio);

      // 季节性
      renderSeasonality(seasonality);

      // 汇率对冲
      const rates = await window.ApiProxy.fetchExchangeRates();
      renderExchangeHedge(goldUSD, goldCNY, rates);

      // 技术面Tab数据
      window._goldTechData = {
        indicators,
        history: historyData
      };

      return cachedData;
    } catch (e) {
      console.error('黄金数据加载失败:', e);
      renderPriceCards(null, null);
      renderSignals([], { description: '数据加载失败' });
      renderKeyLevels();
      return null;
    }
  }

  return {
    load,
    getCachedData: () => cachedData,
    drawGoldChart
  };
})();
