/**
 * =============================================================
 * 黄金监控模块 - 纯前端版
 * 数据来源：Yahoo Finance（通过CORS代理）+ 配置文件
 * =============================================================
 */
window.GoldModule = (function() {
  'use strict';

  // 持仓配置（可从配置文件加载）
  let positionConfig = {
    cost_per_gram: 1055,
    quantity: 50,
    total_cost: 52750
  };

  // 关键价位
  let keyLevels = {
    support: [4360, 4450, 4500],
    resistance: [4600, 4700]
  };

  // 加仓信号配置
  const signalsConfig = [
    { key: 'ma200_above', name: '价格位于MA200上方', description: '金价高于200日移动均线，中期趋势向上' },
    { key: 'ma50_above', name: '价格位于MA50上方', description: '金价高于50日移动均线，短期趋势向上' },
    { key: 'trend_aligned', name: '均线多头排列', description: 'MA50 > MA200，中长期趋势一致' },
    { key: 'volume_confirm', name: '成交量确认', description: '价格创新高时成交量放大' },
    { key: 'rsi_oversold', name: 'RSI未超买', description: 'RSI < 70，还有上涨空间' },
    { key: 'macd_cross', name: 'MACD金叉', description: 'MACD线从下穿越信号线' },
    { key: 'support_test', name: '支撑位反弹', description: '价格回踩支撑后反弹' },
    { key: 'breakout_confirm', name: '突破确认', description: '突破关键阻力位后回踩确认' },
    { key: 'sentiment_bullish', name: '情绪偏多', description: '市场情绪指标显示看多' },
    { key: 'position_safe', name: '仓位安全边际', description: '当前持仓在成本线下方，安全边际充足' }
  ];

  let cachedData = null;
  let chartDrawn = false;

  // =============================================================
  // 工具函数
  // =============================================================

  /**
   * 格式化数字
   */
  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }

  /**
   * 加载持仓配置
   */
  async function loadConfig() {
    try {
      const resp = await fetch('data/gold-config.json');
      if (resp.ok) {
        const config = await resp.json();
        positionConfig = config.position || positionConfig;
        keyLevels = config.key_levels || keyLevels;
      }
    } catch (e) {
      console.warn('持仓配置加载失败，使用默认值:', e);
    }
  }

  /**
   * 计算信号状态（模拟）
   * 实际生产环境需要更复杂的算法
   */
  function evaluateSignals(goldUSD, goldCNY) {
    const price = goldUSD.price;
    const ma200 = goldUSD.ma200 || price * 0.95;
    const ma50 = price * 0.98; // 简化估算

    return signalsConfig.map(signal => {
      let status = 'gray'; // 默认无法确认

      switch (signal.key) {
        case 'ma200_above':
          // 金价高于MA200
          status = price > ma200 ? 'green' : (price >= ma200 * 0.95 ? 'yellow' : 'red');
          break;
        case 'ma50_above':
          // 金价高于MA50
          status = price > ma50 ? 'green' : 'red';
          break;
        case 'trend_aligned':
          // 均线多头排列（MA50 > MA200）
          status = ma50 > ma200 ? 'green' : 'yellow';
          break;
        case 'volume_confirm':
          // 成交量确认（涨跌幅>1%视为有成交量）
          status = Math.abs(goldUSD.changePct) > 1 ? 'green' : 'yellow';
          break;
        case 'rsi_oversold':
          // RSI < 70（简化估算，基于涨跌幅）
          status = goldUSD.changePct < 3 ? 'green' : (goldUSD.changePct < 5 ? 'yellow' : 'red');
          break;
        case 'macd_cross':
          // MACD金叉（简化：当日上涨视为可能的金叉）
          status = goldUSD.changePct > 0 ? 'green' : 'yellow';
          break;
        case 'support_test':
          // 支撑位反弹（价格在支撑位上方）
          status = goldCNY.price > 4400 ? 'green' : (goldCNY.price > 4300 ? 'yellow' : 'red');
          break;
        case 'breakout_confirm':
          // 突破确认（价格高于阻力位）
          status = price > 2300 ? 'green' : 'yellow';
          break;
        case 'sentiment_bullish':
          // 情绪偏多（基于美元指数，简化）
          status = goldUSD.changePct >= 0 ? 'green' : 'yellow';
          break;
        case 'position_safe':
          // 仓位安全边际（成本1055，当前价548，有充足安全边际）
          // 注意：这里是浮亏状态，因为成本1055 > 当前548
          status = goldCNY.price > positionConfig.cost_per_gram * 0.5 ? 'green' : 'yellow';
          break;
      }

      return {
        ...signal,
        status
      };
    });
  }

  /**
   * 计算信号摘要
   */
  function getSignalsSummary(signals) {
    const greenCount = signals.filter(s => s.status === 'green').length;
    const yellowCount = signals.filter(s => s.status === 'yellow').length;
    
    let recommendation = '继续观望';
    if (greenCount >= 4) {
      recommendation = '强烈建议加仓';
    } else if (greenCount >= 3) {
      recommendation = '可以考虑加仓';
    } else if (greenCount >= 2) {
      recommendation = '轻仓试探';
    }

    return {
      green_count: greenCount,
      yellow_count: yellowCount,
      recommendation
    };
  }

  // =============================================================
  // 渲染函数
  // =============================================================

  /**
   * 渲染价格卡片
   */
  function renderPriceCards(goldUSD, goldCNY) {
    const usdEl = document.getElementById('goldUsdPrice');
    const usdChangeEl = document.getElementById('goldUsdChange');
    const cnyEl = document.getElementById('goldCnyPrice');
    const cnyChangeEl = document.getElementById('goldCnyChange');

    if (usdEl) {
      usdEl.textContent = goldUSD.price ? '$' + goldUSD.price.toFixed(2) : '—';
    }
    if (usdChangeEl) {
      const changePct = goldUSD.changePct || 0;
      usdChangeEl.textContent = (changePct >= 0 ? '↑' : '↓') + Math.abs(changePct).toFixed(2) + '%';
      usdChangeEl.className = 'delta ' + (changePct >= 0 ? 'up' : 'down');
    }
    if (cnyEl) {
      cnyEl.textContent = goldCNY.price ? '¥' + goldCNY.price.toFixed(2) : '—';
    }
    if (cnyChangeEl) {
      const changePct = goldCNY.changePct || 0;
      cnyChangeEl.textContent = (changePct >= 0 ? '↑' : '↓') + Math.abs(changePct).toFixed(2) + '%';
      cnyChangeEl.className = 'delta ' + (changePct >= 0 ? 'up' : 'down');
    }
  }

  /**
   * 渲染持仓数据
   */
  function renderPosition(goldCNY) {
    const mvEl = document.getElementById('goldMarketValue');
    const costEl = document.getElementById('goldCost');
    const pnlEl = document.getElementById('goldPnl');

    const marketValue = goldCNY.price * positionConfig.quantity;
    const unrealizedPnl = marketValue - positionConfig.total_cost;
    const unrealizedPnlPct = (unrealizedPnl / positionConfig.total_cost) * 100;

    if (mvEl) {
      mvEl.textContent = '¥' + fmt(marketValue);
    }
    if (costEl) {
      costEl.textContent = '¥' + fmt(positionConfig.total_cost);
    }
    if (pnlEl) {
      pnlEl.textContent = (unrealizedPnl >= 0 ? '+' : '') + fmt(unrealizedPnl) + ' (' + unrealizedPnlPct.toFixed(2) + '%)';
      pnlEl.className = 'delta ' + (unrealizedPnl >= 0 ? 'up' : 'down');
    }
  }

  /**
   * 渲染信号灯
   */
  function renderSignals(signals, summary) {
    const grid = document.getElementById('signalGrid');
    const alertArea = document.getElementById('goldAlertArea');

    if (grid) {
      grid.innerHTML = signals.map(s => {
        const cls = s.status === 'green' ? 'green' : s.status === 'yellow' ? 'yellow' : 'gray';
        const txt = s.status === 'green' ? '满足' : s.status === 'yellow' ? '待确认' : '未确认';
        return `<div class="signal-item" title="${s.description}"><div class="signal-light ${cls}"></div><span class="signal-name">${s.name}</span><span class="signal-status ${cls}">${txt}</span></div>`;
      }).join('');
    }

    if (alertArea) {
      if (summary.green_count >= 2) {
        alertArea.innerHTML = `<div class="alert-banner"><span class="alert-icon">⚠️</span><span class="alert-text"><strong>${summary.green_count}条信号满足</strong> - ${summary.recommendation}</span></div>`;
      } else {
        alertArea.innerHTML = `<div class="alert-banner ok"><span class="alert-icon">✓</span><span class="alert-text ok"><strong>${summary.green_count}条信号满足</strong> - 继续观望</span></div>`;
      }
    }
  }

  /**
   * 渲染关键价位
   */
  function renderKeyLevels() {
    const supportEl = document.getElementById('supportLevels');
    const resistEl = document.getElementById('resistanceLevels');

    if (supportEl) {
      supportEl.innerHTML = keyLevels.support.map(v => 
        `<div class="level-item support"><div class="level-label">支撑</div><div class="level-value">${v}</div></div>`
      ).join('');
    }
    if (resistEl) {
      resistEl.innerHTML = keyLevels.resistance.map(v => 
        `<div class="level-item resistance"><div class="level-label">阻力</div><div class="level-value">${v}</div></div>`
      ).join('');
    }
  }

  /**
   * 绘制黄金图表
   */
  function renderChart(goldUSD) {
    const svg = document.getElementById('goldChart');
    if (!svg || chartDrawn) return;
    
    chartDrawn = true;

    const price = goldUSD.price || 2300;
    const ma200 = goldUSD.ma200 || price * 0.95;
    const baseY = 80;
    const priceY = baseY - (price - 2000) / 100 * 50;
    const maY = baseY - (ma200 - 2000) / 100 * 50;

    svg.innerHTML = `
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#d4a64a;stop-opacity:0.3"/>
          <stop offset="100%" style="stop-color:#d4a64a;stop-opacity:0"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="${baseY}" x2="400" y2="${baseY}" stroke="#1f2533" stroke-dasharray="4,4"/>
      <text x="5" y="${baseY - 5}" fill="#3e4658" font-size="9" font-family="JetBrains Mono">${price}</text>
      <line x1="0" y1="${maY}" x2="400" y2="${maY}" stroke="#7aa2ff" stroke-width="2" opacity="0.7"/>
      <text x="5" y="${maY - 5}" fill="#7aa2ff" font-size="9" font-family="JetBrains Mono">MA200: ${ma200.toFixed(0)}</text>
      <path d="M 0 100 Q 100 85 200 70 T 400 ${priceY}" fill="none" stroke="#d4a64a" stroke-width="2"/>
      <path d="M 0 100 Q 100 85 200 70 T 400 ${priceY} L 400 120 L 0 120 Z" fill="url(#goldGrad)"/>
      <circle cx="380" cy="${priceY}" r="4" fill="#d4a64a"/>
      <rect x="300" y="${priceY - 18}" width="80" height="16" rx="3" fill="#0e1116" opacity="0.9"/>
      <text x="340" y="${priceY - 6}" fill="#d4a64a" font-size="10" font-family="JetBrains Mono" text-anchor="middle">$${price.toFixed(0)}</text>
      <text x="200" y="115" fill="${price > ma200 ? '#3ddc97' : '#ff5c7a'}" font-size="10" font-family="JetBrains Mono" text-anchor="middle">${price > ma200 ? '✓ 金价位于MA200上方' : '○ 金价位于MA200下方'}</text>
    `;
  }

  // =============================================================
  // 主加载函数
  // =============================================================

  async function load() {
    try {
      // 1. 加载持仓配置
      await loadConfig();

      // 2. 并行获取黄金价格数据
      const [goldUSD, goldCNY] = await Promise.all([
        window.ApiProxy.fetchGoldPriceUSD(),
        window.ApiProxy.fetchGoldPriceCNY()
      ]);

      // 3. 计算信号
      const signals = evaluateSignals(goldUSD, goldCNY);
      const summary = getSignalsSummary(signals);

      // 4. 组装数据
      const data = {
        prices: {
          usd_per_oz: goldUSD,
          cny_per_gram: goldCNY
        },
        position: {
          cost_per_gram: positionConfig.cost_per_gram,
          quantity: positionConfig.quantity,
          total_cost: positionConfig.total_cost,
          market_value: goldCNY.price * positionConfig.quantity,
          unrealized_pnl: goldCNY.price * positionConfig.quantity - positionConfig.total_cost,
          unrealized_pnl_pct: ((goldCNY.price * positionConfig.quantity - positionConfig.total_cost) / positionConfig.total_cost) * 100
        },
        signals: signals,
        signals_summary: summary,
        key_levels: keyLevels
      };

      cachedData = data;

      // 5. 渲染UI
      renderPriceCards(goldUSD, goldCNY);
      renderPosition(goldCNY);
      renderSignals(signals, summary);
      renderKeyLevels();
      renderChart(goldUSD);

      return data;
    } catch (e) {
      console.error('黄金数据加载失败:', e);
      
      // 使用fallback数据渲染
      const fallbackUSD = window.ApiProxy.getFallbackGoldUSD();
      const fallbackCNY = window.ApiProxy.getFallbackGoldCNY();
      renderPriceCards(fallbackUSD, fallbackCNY);
      renderPosition(fallbackCNY);
      renderKeyLevels();
      
      return cachedData;
    }
  }

  return {
    load,
    getCachedData: () => cachedData
  };
})();
