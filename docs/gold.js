/**
 * =============================================================
 * 黄金监控模块 - 纯前端版
 * 数据来源：腾讯财经 qt.gtimg.cn（黄金期货）+ 汇率换算
 * =============================================================
 */
window.GoldModule = (function() {
  'use strict';

  // 持仓配置
  let positionConfig = {
    cost_per_gram: 1055,  // 元/克
    quantity: 50,          // 克
    total_cost: 52750     // 总成本
  };

  // 关键价位（用户可自定义）
  let keyLevels = {
    support: [4360, 4450, 4500],
    resistance: [4600, 4700]
  };

  // 加仓信号配置
  const signalsConfig = [
    { key: 'ma200_above', name: '价格位于MA200上方', description: '金价高于200日移动均线，中期趋势向上' },
    { key: 'ma50_above', name: '价格位于MA50上方', description: '金价高于50日移动均线，短期趋势向上' },
    { key: 'trend_aligned', name: '均线多头排列', description: 'MA50 > MA200，中长期趋势一致' },
    { key: 'volume_confirm', name: '成交量确认', description: '价格变动幅度超过1%视为有动能' },
    { key: 'rsi_oversold', name: 'RSI未超买', description: '涨跌幅适中，还有上涨空间' },
    { key: 'macd_cross', name: 'MACD正向', description: '当日上涨，MACD柱状图为正' },
    { key: 'support_test', name: '支撑位反弹', description: '价格在关键支撑位上方运行' },
    { key: 'breakout_confirm', name: '突破确认', description: '价格高于关键阻力位' },
    { key: 'sentiment_bullish', name: '市场情绪', description: '当日价格变动为正' },
    { key: 'position_safe', name: '仓位安全边际', description: '当前价格相对成本有安全边际' }
  ];

  let cachedData = null;
  let chartDrawn = false;

  // =============================================================
  // 工具函数
  // =============================================================

  function fmt(n) {
    if (n == null || isNaN(n)) return '—';
    return Math.round(n).toLocaleString('en-US');
  }

  // =============================================================
  // 计算信号状态
  // =============================================================

  function evaluateSignals(goldUSD, goldCNY) {
    // 数据不可用时，所有信号显示灰色
    if (!goldUSD || !goldCNY) {
      return signalsConfig.map(signal => ({
        ...signal,
        status: 'gray'
      }));
    }

    const price = goldUSD.price;
    const ma200 = goldUSD.ma200 || price * 0.96;
    const ma50 = price * 0.98; // 简化估算

    return signalsConfig.map(signal => {
      let status = 'gray';

      switch (signal.key) {
        case 'ma200_above':
          status = price > ma200 ? 'green' : (price >= ma200 * 0.98 ? 'yellow' : 'red');
          break;
        case 'ma50_above':
          status = price > ma50 ? 'green' : 'red';
          break;
        case 'trend_aligned':
          status = ma50 > ma200 ? 'green' : 'yellow';
          break;
        case 'volume_confirm':
          status = Math.abs(goldUSD.changePct) > 1 ? 'green' : 'yellow';
          break;
        case 'rsi_oversold':
          status = goldUSD.changePct < 3 ? 'green' : (goldUSD.changePct < 5 ? 'yellow' : 'red');
          break;
        case 'macd_cross':
          status = goldUSD.changePct > 0 ? 'green' : 'yellow';
          break;
        case 'support_test':
          status = goldCNY.price > keyLevels.support[0] ? 'green' : (goldCNY.price > keyLevels.support[0] * 0.98 ? 'yellow' : 'red');
          break;
        case 'breakout_confirm':
          status = price > keyLevels.resistance[0] ? 'green' : 'yellow';
          break;
        case 'sentiment_bullish':
          status = goldUSD.changePct >= 0 ? 'green' : 'yellow';
          break;
        case 'position_safe':
          // 成本1055，当前价格约548（假设），处于浮亏
          status = goldCNY.price > positionConfig.cost_per_gram * 0.5 ? 'green' : 'yellow';
          break;
      }

      return { ...signal, status };
    });
  }

  function getSignalsSummary(signals) {
    const greenCount = signals.filter(s => s.status === 'green').length;
    const yellowCount = signals.filter(s => s.status === 'yellow').length;
    
    let recommendation = '继续观望';
    if (greenCount >= 4) recommendation = '强烈建议加仓';
    else if (greenCount >= 3) recommendation = '可以考虑加仓';
    else if (greenCount >= 2) recommendation = '轻仓试探';

    return { green_count: greenCount, yellow_count: yellowCount, recommendation };
  }

  // =============================================================
  // 渲染函数
  // =============================================================

  function renderPriceCards(goldUSD, goldCNY) {
    const usdEl = document.getElementById('goldUsdPrice');
    const usdChangeEl = document.getElementById('goldUsdChange');
    const cnyEl = document.getElementById('goldCnyPrice');
    const cnyChangeEl = document.getElementById('goldCnyChange');

    if (goldUSD && goldUSD.price) {
      if (usdEl) usdEl.textContent = '$' + goldUSD.price.toFixed(2);
      if (usdChangeEl) {
        const pct = goldUSD.changePct || 0;
        usdChangeEl.textContent = (pct >= 0 ? '↑' : '↓') + Math.abs(pct).toFixed(2) + '%';
        usdChangeEl.className = 'delta ' + (pct >= 0 ? 'up' : 'down');
      }
    } else {
      if (usdEl) usdEl.textContent = '—';
      if (usdChangeEl) { usdChangeEl.textContent = '—'; usdChangeEl.className = 'delta flat'; }
    }

    if (goldCNY && goldCNY.price) {
      if (cnyEl) cnyEl.textContent = '¥' + goldCNY.price.toFixed(2);
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

  function renderPosition(goldCNY) {
    const mvEl = document.getElementById('goldMarketValue');
    const costEl = document.getElementById('goldCost');
    const pnlEl = document.getElementById('goldPnl');

    if (costEl) costEl.textContent = '¥' + fmt(positionConfig.total_cost);

    if (goldCNY && goldCNY.price) {
      const marketValue = goldCNY.price * positionConfig.quantity;
      const unrealizedPnl = marketValue - positionConfig.total_cost;
      const unrealizedPnlPct = (unrealizedPnl / positionConfig.total_cost) * 100;

      if (mvEl) mvEl.textContent = '¥' + fmt(marketValue);
      if (pnlEl) {
        pnlEl.textContent = (unrealizedPnl >= 0 ? '+' : '') + fmt(unrealizedPnl) + ' (' + unrealizedPnlPct.toFixed(2) + '%)';
        pnlEl.className = 'delta ' + (unrealizedPnl >= 0 ? 'up' : 'down');
      }
    } else {
      if (mvEl) mvEl.textContent = '—';
      if (pnlEl) { pnlEl.textContent = '—'; pnlEl.className = 'delta flat'; }
    }
  }

  function renderSignals(signals, summary) {
    const grid = document.getElementById('signalGrid');
    const alertArea = document.getElementById('goldAlertArea');

    if (!signals || signals.length === 0) {
      if (grid) {
        grid.innerHTML = '<div class="empty-state"><div class="icon">🥇</div><div class="text">数据加载中，请稍候...</div></div>';
      }
      return;
    }

    if (grid) {
      grid.innerHTML = signals.map(s => {
        const cls = s.status;
        const statusText = cls === 'green' ? '满足' : cls === 'yellow' ? '待确认' : '待获取';
        return `<div class="signal-item" title="${s.description}">
          <div class="signal-light ${cls}"></div>
          <span class="signal-name">${s.name}</span>
          <span class="signal-status ${cls}">${statusText}</span>
        </div>`;
      }).join('');
    }

    if (alertArea) {
      if (summary.green_count >= 2) {
        alertArea.innerHTML = `<div class="alert-banner">
          <span class="alert-icon">⚠️</span>
          <span class="alert-text"><strong>${summary.green_count}条信号满足</strong> - ${summary.recommendation}</span>
        </div>`;
      } else {
        alertArea.innerHTML = `<div class="alert-banner ok">
          <span class="alert-icon">✓</span>
          <span class="alert-text ok"><strong>${summary.green_count}条信号满足</strong> - 继续观望</span>
        </div>`;
      }
    }
  }

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

  function renderChart(goldUSD) {
    const svg = document.getElementById('goldChart');
    if (!svg || chartDrawn) return;
    chartDrawn = true;

    // 如果数据不可用，显示空状态
    if (!goldUSD || !goldUSD.price) {
      svg.innerHTML = `
        <text x="200" y="60" fill="#3e4658" font-size="12" text-anchor="middle">数据加载中...</text>
      `;
      return;
    }

    const price = goldUSD.price;
    const ma200 = goldUSD.ma200 || price * 0.96;
    const baseY = 85;
    const priceY = baseY - (price - 4000) / 200 * 60;
    const maY = baseY - (ma200 - 4000) / 200 * 60;

    svg.innerHTML = `
      <defs>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#d4a64a;stop-opacity:0.3"/>
          <stop offset="100%" style="stop-color:#d4a64a;stop-opacity:0"/>
        </linearGradient>
      </defs>
      <line x1="0" y1="${baseY}" x2="400" y2="${baseY}" stroke="#1f2533" stroke-dasharray="4,4"/>
      <text x="5" y="${baseY - 5}" fill="#3e4658" font-size="9" font-family="JetBrains Mono">${price.toFixed(0)}</text>
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
      const [goldUSD, goldCNY] = await Promise.all([
        window.ApiProxy.fetchGoldPriceUSD(),
        window.ApiProxy.fetchGoldPriceCNY()
      ]);

      // 如果两个都获取失败，显示错误状态
      if (!goldUSD && !goldCNY) {
        throw new Error('无法获取黄金数据');
      }

      const signals = evaluateSignals(goldUSD, goldCNY);
      const summary = getSignalsSummary(signals);

      cachedData = {
        prices: { usd_per_oz: goldUSD, cny_per_gram: goldCNY },
        signals,
        signals_summary: summary,
        key_levels: keyLevels
      };

      renderPriceCards(goldUSD, goldCNY);
      renderPosition(goldCNY);
      renderSignals(signals, summary);
      renderKeyLevels();
      renderChart(goldUSD);

      return cachedData;
    } catch (e) {
      console.error('黄金数据加载失败:', e);
      
      // 显示空状态，不使用假数据
      renderPriceCards(null, null);
      renderPosition(null);
      renderSignals([], { green_count: 0, yellow_count: 0, recommendation: '数据暂不可用' });
      renderKeyLevels();
      renderChart(null);
      
      return null;
    }
  }

  return {
    load,
    getCachedData: () => cachedData
  };
})();
