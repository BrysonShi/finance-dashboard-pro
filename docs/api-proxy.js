/**
 * =============================================================
 * API Proxy 模块 - 统一的数据获取入口
 * 数据源：
 *   - 汇率: open.er-api.com (CORS支持)
 *   - 黄金/原油/美股: 腾讯财经 qt.gtimg.cn (JSONP)
 *   - A股/港股: 新浪财经 hq.sinajs.cn (JSONP)
 *   - 黄金K线: web.ifzq.gtimg.cn
 * =============================================================
 */
window.ApiProxy = (function() {
  'use strict';

  // =============================================================
  // 常量配置
  // =============================================================
  const CACHE_PREFIX = 'fdp_';
  const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  const TIMEOUT = 10000; // 10秒超时

  // =============================================================
  // 工具函数
  // =============================================================

  function getCache(key) {
    try {
      const cached = localStorage.getItem(CACHE_PREFIX + key);
      if (!cached) return null;
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return data;
    } catch (e) {
      return null;
    }
  }

  function setCache(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('缓存设置失败:', e);
    }
  }

  function fetchWithTimeout(url, options = {}) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('请求超时')), TIMEOUT);
      fetch(url, options)
        .then(resp => {
          clearTimeout(timeoutId);
          resolve(resp);
        })
        .catch(err => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
  }

  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_' + Date.now() + '_' + Math.random().toString(36).substr(2);
      const script = document.createElement('script');
      
      const timeoutId = setTimeout(() => {
        delete window[callbackName];
        if (script.parentNode) document.head.removeChild(script);
        reject(new Error('JSONP请求超时'));
      }, TIMEOUT);

      window[callbackName] = function(data) {
        clearTimeout(timeoutId);
        delete window[callbackName];
        if (script.parentNode) document.head.removeChild(script);
        resolve(data);
      };

      const separator = url.includes('?') ? '&' : '?';
      script.src = url + separator + 'callback=' + callbackName;
      script.onerror = () => {
        clearTimeout(timeoutId);
        delete window[callbackName];
        if (script.parentNode) document.head.removeChild(script);
        reject(new Error('JSONP请求失败'));
      };
      document.head.appendChild(script);
    });
  }

  // =============================================================
  // 汇率数据
  // =============================================================

  /**
   * 获取汇率数据
   */
  async function fetchExchangeRates() {
    const cacheKey = 'exchange_rates';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD');
      const json = await resp.json();
      
      if (json.result !== 'success') {
        throw new Error('汇率API返回失败');
      }

      const rates = {
        USD_CNY: json.rates?.CNY || 7.24,
        USD_HKD: json.rates?.HKD || 7.78,
        USD_JPY: json.rates?.JPY || 157,
        EUR_USD: 1 / json.rates?.EUR || 1.08,
        GBP_USD: 1 / json.rates?.GBP || 1.27,
        last_updated: json.time_last_update_utc || new Date().toISOString(),
        source: 'exchangerate-api.com'
      };
      
      setCache(cacheKey, rates);
      return rates;
    } catch (e) {
      console.error('汇率获取失败:', e);
      return null;
    }
  }

  // =============================================================
  // 黄金数据
  // =============================================================

  /**
   * 获取黄金价格（USD/盎司）
   * 源: 腾讯财经纽约黄金期货 hf_GC
   */
  async function fetchGoldPriceUSD() {
    const cacheKey = 'gold_usd';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetchWithTimeout('https://qt.gtimg.cn/q=hf_GC', {
        headers: { 'Accept': 'text/plain' }
      });
      const buffer = await resp.arrayBuffer();
      const decoder = new TextDecoder('gbk');
      const text = decoder.decode(buffer);
      
      // 解析: v_hf_GC="价格,涨跌,昨收,今开,最高,最低,时间,..."
      const match = text.match(/v_hf_GC="([^"]+)"/);
      if (!match) throw new Error('无法解析黄金数据');

      const fields = match[1].split(',');
      const price = parseFloat(fields[0]);
      const change = parseFloat(fields[1]);
      const prevClose = parseFloat(fields[2]);
      const high = parseFloat(fields[4]);
      const low = parseFloat(fields[5]);
      const updateTime = fields[6] + ' ' + fields[12];

      if (isNaN(price)) throw new Error('价格无效');

      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const data = {
        price: price,
        prevClose: prevClose,
        change: change,
        changePct: changePct,
        high: high,
        low: low,
        currency: 'USD',
        unit: 'oz',
        lastUpdated: updateTime,
        source: '腾讯财经'
      };

      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.error('黄金USD价格获取失败:', e);
      return null;
    }
  }

  /**
   * 获取黄金价格（CNY/克）
   */
  async function fetchGoldPriceCNY() {
    const cacheKey = 'gold_cny';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      const [goldUSD, rates] = await Promise.all([
        fetchGoldPriceUSD(),
        fetchExchangeRates()
      ]);

      if (!goldUSD || !rates) return null;

      // USD/盎司 -> CNY/克 (1盎司=31.1035克)
      const pricePerGramUSD = goldUSD.price / 31.1035;
      const pricePerGramCNY = pricePerGramUSD * rates.USD_CNY;

      const data = {
        price: pricePerGramCNY,
        changePct: goldUSD.changePct,
        currency: 'CNY',
        unit: 'gram',
        lastUpdated: goldUSD.lastUpdated,
        source: '腾讯财经/汇率换算'
      };

      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.error('黄金CNY价格获取失败:', e);
      return null;
    }
  }

  /**
   * 获取黄金历史K线数据
   * @param {string} period - 'day'(日K) 或 'week'(周K)
   * @param {number} count - 数据条数
   */
  async function fetchGoldHistory(period = 'day', count = 250) {
    const cacheKey = `gold_history_${period}_${count}`;
    const cached = getCache(cacheKey);
    if (cached && cached.length > 0) return cached;

    try {
      // 使用黄金ETF sh518880 的K线（期货代码hf_GC不支持此接口）
      // ETF价格与金价高度正相关，技术指标有效
      const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh518880,${period},,,${count},qfq`;
      console.log('[ApiProxy] 请求K线:', url);
      const resp = await fetchWithTimeout(url);
      
      if (!resp.ok) {
        throw new Error('HTTP ' + resp.status);
      }
      
      const json = await resp.json();
      console.log('[ApiProxy] K线返回code:', json.code, 'data keys:', json.data ? Object.keys(json.data) : 'null');
      
      const etfData = json.data?.sh518880;
      if (!etfData) {
        throw new Error('K线数据返回异常: 无sh518880');
      }

      // 日K在qfqday，周K在qfqweek
      let klineKey = period === 'week' ? 'qfqweek' : 'qfqday';
      let klineData = etfData[klineKey] || [];
      console.log('[ApiProxy] K线条数:', klineData.length, 'key:', klineKey);
      
      if (klineData.length === 0) {
        // 尝试备用key
        klineKey = 'day';
        klineData = etfData[klineKey] || [];
        console.log('[ApiProxy] 尝试备用key:', klineKey, '条数:', klineData.length);
      }
      
      // 解析K线数据 [日期, 开, 收, 高, 低, 量]
      const data = klineData.map(item => ({
        date: item[0],
        open: parseFloat(item[1]),
        close: parseFloat(item[2]),
        high: parseFloat(item[3]),
        low: parseFloat(item[4]),
        volume: parseFloat(item[5]) || 0
      })).filter(d => !isNaN(d.close));

      if (data.length === 0) {
        console.warn('[ApiProxy] K线解析后为空，原始数据:', JSON.stringify(klineData.slice(0,2)));
      }
      
      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.error('[ApiProxy] 黄金K线获取失败:', e.message);
      return null;
    }
  }

  // =============================================================
  // 原油数据
  // =============================================================

  /**
   * 获取WTI原油价格
   */
  async function fetchCrudeOil() {
    const cacheKey = 'crude_oil';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      const resp = await fetchWithTimeout('https://qt.gtimg.cn/q=hf_CL', {
        headers: { 'Accept': 'text/plain' }
      });
      const buffer = await resp.arrayBuffer();
      const decoder = new TextDecoder('gbk');
      const text = decoder.decode(buffer);
      
      const match = text.match(/v_hf_CL="([^"]+)"/);
      if (!match) throw new Error('无法解析原油数据');

      const fields = match[1].split(',');
      const price = parseFloat(fields[0]);
      const change = parseFloat(fields[1]);
      const prevClose = parseFloat(fields[2]);
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const data = {
        price: price,
        change: change,
        changePct: changePct,
        currency: 'USD',
        unit: 'barrel',
        lastUpdated: fields[6] + ' ' + fields[12],
        source: '腾讯财经'
      };

      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.error('原油价格获取失败:', e);
      return null;
    }
  }

  // =============================================================
  // 市场指数
  // =============================================================

  async function fetchMarketIndices() {
    const cacheKey = 'market_indices';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const indices = [];

    try {
      const promises = [
        fetchSinaIndex('sh000300', '沪深300'),
        fetchTencentFuture('hf_CL', 'WTI原油'),
        fetchTencentFuture('hf_DX', '美元指数')
      ];

      const results = await Promise.allSettled(promises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          indices.push(result.value);
        }
      });

      const data = {
        items: indices,
        updated_at: new Date().toISOString()
      };

      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.error('市场指数获取失败:', e);
      return null;
    }
  }

  async function fetchSinaIndex(code, name) {
    try {
      const resp = await fetchWithTimeout(
        `https://hq.sinajs.cn/list=${code}`,
        { headers: { 'Referer': 'https://finance.sina.com.cn' } }
      );
      const buffer = await resp.arrayBuffer();
      const decoder = new TextDecoder('gbk');
      const text = decoder.decode(buffer);
      
      const match = text.match(/hq_str_\w+="([^"]+)"/);
      if (!match) return null;

      const fields = match[1].split(',');
      const price = parseFloat(fields[3]);
      const prevClose = parseFloat(fields[2]);
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol: code,
        name: name,
        price: price,
        change: change,
        changePct: changePct,
        source: '新浪财经'
      };
    } catch (e) {
      console.warn(`${name}获取失败:`, e);
      return null;
    }
  }

  async function fetchTencentFuture(code, name) {
    try {
      const resp = await fetchWithTimeout('https://qt.gtimg.cn/q=' + code);
      const buffer = await resp.arrayBuffer();
      const decoder = new TextDecoder('gbk');
      const text = decoder.decode(buffer);
      
      const match = text.match(/v_\w+="([^"]+)"/);
      if (!match) return null;

      const fields = match[1].split(',');
      const price = parseFloat(fields[0]);
      const change = parseFloat(fields[1]);
      const prevClose = parseFloat(fields[2]);
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol: code,
        name: name,
        price: price,
        change: change,
        changePct: changePct,
        source: '腾讯财经'
      };
    } catch (e) {
      console.warn(`${name}获取失败:`, e);
      return null;
    }
  }

  // =============================================================
  // 黄金ETF持仓 (SPDR GLD)
  // =============================================================

  async function fetchGoldETF() {
    const cacheKey = 'gold_etf';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      // 尝试从网络获取SPDR持仓数据
      const resp = await fetchWithTimeout(
        'https://query1.finance.yahoo.com/v8/finance/chart/GLD?interval=1d&range=5d',
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const json = await resp.json();
      
      // Yahoo Finance 不直接提供持仓量，这里返回null让前端显示"暂不可用"
      return null;
    } catch (e) {
      console.warn('黄金ETF数据获取失败:', e);
      return null;
    }
  }

  // =============================================================
  // 公开接口
  // =============================================================
  return {
    // 汇率
    fetchExchangeRates,
    
    // 黄金
    fetchGoldPriceUSD,
    fetchGoldPriceCNY,
    fetchGoldHistory,
    
    // 原油
    fetchCrudeOil,
    
    // 市场指数
    fetchMarketIndices,
    
    // 黄金ETF
    fetchGoldETF,
    
    // 工具
    getCache,
    setCache,
    CACHE_PREFIX,
    CACHE_TTL
  };
})();
