/**
 * =============================================================
 * 技术指标计算模块
 * 从K线数据前端计算MA/RSI/MACD等指标
 * =============================================================
 */
window.Indicators = (function() {
  'use strict';

  // =============================================================
  // 工具函数
  // =============================================================

  /**
   * 计算简单移动平均线 (SMA)
   * @param {Array} data - K线数据 [{close}, ...]
   * @param {number} period - 周期
   * @returns {Array} - 移动平均线数组
   */
  function calcMA(data, period) {
    if (!data || data.length < period) return [];
    
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      result.push({
        index: i,
        value: sum / period,
        date: data[i].date
      });
    }
    return result;
  }

  /**
   * 计算指数移动平均线 (EMA)
   * @param {Array} data - K线数据
   * @param {number} period - 周期
   * @returns {Array}
   */
  function calcEMA(data, period) {
    if (!data || data.length < period) return [];
    
    const multiplier = 2 / (period + 1);
    const result = [];
    
    // 初始SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].close;
    }
    let ema = sum / period;
    
    for (let i = period - 1; i < data.length; i++) {
      if (i === period - 1) {
        result.push({ index: i, value: ema, date: data[i].date });
      } else {
        ema = (data[i].close - ema) * multiplier + ema;
        result.push({ index: i, value: ema, date: data[i].date });
      }
    }
    return result;
  }

  /**
   * 计算RSI (相对强弱指数)
   * @param {Array} data - K线数据
   * @param {number} period - 周期，默认14
   * @returns {Array}
   */
  function calcRSI(data, period = 14) {
    if (!data || data.length < period + 1) return [];
    
    const result = [];
    let gains = [];
    let losses = [];
    
    // 计算涨跌
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    
    // 初始平均
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      let rsi;
      if (avgLoss === 0) {
        rsi = 100;
      } else {
        const rs = avgGain / avgLoss;
        rsi = 100 - (100 / (1 + rs));
      }
      
      result.push({
        index: i + 1,
        value: rsi,
        date: data[i + 1].date,
        overbought: rsi > 70,
        oversold: rsi < 30
      });
    }
    return result;
  }

  /**
   * 计算MACD
   * @param {Array} data - K线数据
   * @param {number} fastPeriod - 快线周期，默认12
   * @param {number} slowPeriod - 慢线周期，默认26
   * @param {number} signalPeriod - 信号线周期，默认9
   * @returns {Object} - { dif: [], dea: [], macd: [] }
   */
  function calcMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (!data || data.length < slowPeriod) return { dif: [], dea: [], macd: [] };
    
    const emaFast = calcEMA(data, fastPeriod);
    const emaSlow = calcEMA(data, slowPeriod);
    
    // 计算DIF
    const dif = [];
    const offset = slowPeriod - fastPeriod;
    for (let i = 0; i < emaSlow.length; i++) {
      const fastIndex = i + offset;
      if (fastIndex < emaFast.length) {
        dif.push({
          index: emaSlow[i].index,
          value: emaFast[fastIndex].value - emaSlow[i].value,
          date: emaSlow[i].date
        });
      }
    }
    
    // 计算DEA (信号线)
    const signalMultiplier = 2 / (signalPeriod + 1);
    const dea = [];
    
    for (let i = signalPeriod - 1; i < dif.length; i++) {
      if (i === signalPeriod - 1) {
        let sum = 0;
        for (let j = 0; j < signalPeriod; j++) {
          sum += dif[i - j].value;
        }
        dea.push({ index: dif[i].index, value: sum / signalPeriod, date: dif[i].date });
      } else {
        const prevDea = dea[dea.length - 1].value;
        const newDea = (dif[i].value - prevDea) * signalMultiplier + prevDea;
        dea.push({ index: dif[i].index, value: newDea, date: dif[i].date });
      }
    }
    
    // 计算MACD柱 (DIF - DEA) * 2
    const macd = [];
    for (let i = 0; i < dea.length; i++) {
      const difIndex = i + (dif.length - dea.length);
      if (difIndex >= 0 && difIndex < dif.length) {
        macd.push({
          index: dea[i].index,
          value: (dif[difIndex].value - dea[i].value) * 2,
          date: dea[i].date,
          histogram: dif[difIndex].value - dea[i].value // 用于判断金叉死叉
        });
      }
    }
    
    return { dif, dea, macd };
  }

  /**
   * 计算历史波动率
   * @param {Array} data - K线数据
   * @param {number} days - 计算周期
   * @returns {number} - 年化波动率 (%)
   */
  function calcVolatility(data, days = 30) {
    if (!data || data.length < days + 1) return null;
    
    const returns = [];
    const sliceData = data.slice(-days - 1);
    
    for (let i = 1; i < sliceData.length; i++) {
      const ret = Math.log(sliceData[i].close / sliceData[i - 1].close);
      returns.push(ret);
    }
    
    // 计算标准差
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    // 年化 (假设252交易日)
    const annualizedVol = stdDev * Math.sqrt(252) * 100;
    return annualizedVol;
  }

  /**
   * 检测RSI底背离
   * @param {Array} data - K线数据
   * @param {Array} rsi - RSI数据
   * @returns {boolean}
   */
  function detectRSIDivergence(data, rsi) {
    if (!data || !rsi || rsi.length < 20) return false;
    
    const recentRSI = rsi.slice(-20);
    const recentData = data.slice(-20);
    
    // 简化检测：RSI从超卖区回升且价格创新低
    const lowestRSI = Math.min(...recentRSI.map(r => r.value));
    const lowestPriceIdx = recentData.reduce((minIdx, p, i, arr) => 
      arr[i].close < arr[minIdx].close ? i : minIdx, 0);
    
    // RSI是否在超卖区
    if (lowestRSI > 30) return false;
    
    // 价格是否创新低（相对于前30天）
    const prevData = data.slice(-50, -20);
    const lowestPrice = Math.min(...prevData.map(d => d.close));
    
    // 简化判断
    return recentData[recentData.length - 1].close < lowestPrice * 1.02;
  }

  /**
   * 计算布林带
   * @param {Array} data - K线数据
   * @param {number} period - 周期，默认20
   * @param {number} stdDev - 标准差倍数，默认2
   * @returns {Array}
   */
  function calcBollingerBands(data, period = 20, stdDev = 2) {
    if (!data || data.length < period) return [];
    
    const ma = calcMA(data, period);
    const result = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((sum, d) => sum + d.close, 0) / period;
      const squaredDiffs = slice.map(d => Math.pow(d.close - mean, 2));
      const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
      const sd = Math.sqrt(variance);
      
      result.push({
        index: i,
        date: data[i].date,
        upper: mean + stdDev * sd,
        middle: mean,
        lower: mean - stdDev * sd
      });
    }
    return result;
  }

  // =============================================================
  // 公开接口
  // =============================================================
  return {
    calcMA,
    calcEMA,
    calcRSI,
    calcMACD,
    calcVolatility,
    calcBollingerBands,
    detectRSIDivergence
  };
})();
