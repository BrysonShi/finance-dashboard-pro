/**
 * =============================================================
 * API Proxy 模块 - 统一的数据获取入口
 * 数据源：
 *   - 汇率: open.er-api.com (CORS支持)
 *   - 黄金/原油/美股: 腾讯财经 qt.gtimg.cn (JSONP)
 *   - A股/港股: 新浪财经 hq.sinajs.cn (JSONP)
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

  /**
   * 获取缓存数据
   */
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

  /**
   * 设置缓存数据
   */
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

  /**
   * 带超时的fetch
   */
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

  /**
   * JSONP请求（动态创建script标签）
   */
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = 'jsonp_' + Date.now() + '_' + Math.random().toString(36).substr(2);
      const script = document.createElement('script');
      
      // 超时处理
      const timeoutId = setTimeout(() => {
        delete window[callbackName];
        document.head.removeChild(script);
        reject(new Error('JSONP请求超时'));
      }, TIMEOUT);

      window[callbackName] = function(data) {
        clearTimeout(timeoutId);
        delete window[callbackName];
        document.head.removeChild(script);
        resolve(data);
      };

      // 将回调函数名添加到URL
      const separator = url.includes('?') ? '&' : '?';
      script.src = url + separator + 'callback=' + callbackName;
      script.onerror = () => {
        clearTimeout(timeoutId);
        delete window[callbackName];
        document.head.removeChild(script);
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
   * 源: open.er-api.com (免费，CORS支持)
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
        AUD_USD: 1 / json.rates?.AUD || 0.72,
        last_updated: json.time_last_update_utc || new Date().toISOString(),
        source: 'exchangerate-api.com'
      };
      
      setCache(cacheKey, rates);
      return rates;
    } catch (e) {
      console.error('汇率获取失败:', e);
      return null; // 不再返回fallback，返回null由调用方处理
    }
  }

  // =============================================================
  // 黄金数据
  // =============================================================

  /**
   * 获取黄金价格（USD/盎司）
   * 源: 腾讯财经 qt.gtimg.cn (纽约黄金期货 hf_GC)
   * 返回格式: v_hf_GC="价格,涨跌,昨收,今开,最高,最低,时间,..."
   */
  async function fetchGoldPriceUSD() {
    const cacheKey = 'gold_usd';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      // 腾讯财经黄金期货（美元/盎司）
      const resp = await fetchWithTimeout('https://qt.gtimg.cn/q=hf_GC', {
        headers: { 'Accept': 'text/plain' }
      });
      const text = await resp.text();
      
      // 解析腾讯数据: v_hf_GC="4527.24,-1.43,..."
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

      // 估算MA200（基于近期波动，这里简化处理）
      const ma200 = price * 0.96; // 简化估算，实际应从历史数据计算

      const data = {
        price: price,
        prevClose: prevClose,
        change: change,
        changePct: changePct,
        high: high,
        low: low,
        ma200: ma200,
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

      if (!goldUSD || !rates) {
        return null;
      }

      // 转换: USD/盎司 -> CNY/克
      // 1盎司 = 31.1035克
      const pricePerOz = goldUSD.price;
      const pricePerGramUSD = pricePerOz / 31.1035;
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

  // =============================================================
  // 市场指数数据
  // =============================================================

  /**
   * 获取市场指数数据
   * 源: 腾讯财经/新浪财经
   */
  async function fetchMarketIndices() {
    const cacheKey = 'market_indices';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    const indices = [];

    try {
      // 并行获取多个指数
      const promises = [
        // A股指数（新浪）
        fetchSinaIndex('sh000001', '上证指数', '上证综指'),
        fetchSinaIndex('sh000300', '沪深300', '沪深300'),
        // 港股指数（新浪）
        fetchSinaHKIndex('rt_hkHSI', '恒生指数', '恒生指数'),
        // 美股指数（腾讯）
        fetchTencentUSIndex('usINX', '标普500', 'S&P 500'),
        // 原油期货（腾讯）
        fetchTencentFuture('hf_CL', 'WTI原油', '纽约原油'),
        // 白银期货（腾讯）
        fetchTencentFuture('hf_SI', '纽约白银', '纽约白银')
      ];

      const results = await Promise.allSettled(promises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          indices.push(result.value);
        }
      });

      if (indices.length === 0) {
        throw new Error('所有指数获取失败');
      }

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

  /**
   * 获取新浪A股指数
   */
  async function fetchSinaIndex(code, name, description) {
    try {
      const resp = await fetchWithTimeout(
        `https://hq.sinajs.cn/list=${code}`,
        { headers: { 'Referer': 'https://finance.sina.com.cn' } }
      );
      const buffer = await resp.arrayBuffer();
      const decoder = new TextDecoder('GBK');
      const text = decoder.decode(buffer);
      
      // 格式: var hq_str_sh000001="上证指数,今开,昨收,当前,最高,最低,..."
      const match = text.match(/hq_str_\w+="([^"]+)"/);
      if (!match) return null;

      const fields = match[1].split(',');
      const price = parseFloat(fields[3]);
      const prevClose = parseFloat(fields[2]);
      const high = parseFloat(fields[4]);
      const low = parseFloat(fields[5]);
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol: code,
        name: name,
        description: description,
        price: price,
        change: change,
        changePct: changePct,
        high: high,
        low: low,
        trend: changePct >= 0 ? 'up' : 'down',
        updateTime: fields[30] + ' ' + fields[31],
        source: '新浪财经'
      };
    } catch (e) {
      console.warn(`${name}获取失败:`, e);
      return null;
    }
  }

  /**
   * 获取新浪港股指数
   */
  async function fetchSinaHKIndex(code, name, description) {
    try {
      const resp = await fetchWithTimeout(
        `https://hq.sinajs.cn/list=${code}`,
        { headers: { 'Referer': 'https://finance.sina.com.cn' } }
      );
      const buffer = await resp.arrayBuffer();
      const decoder = new TextDecoder('GBK');
      const text = decoder.decode(buffer);
      
      // 格式: var hq_str_rt_hkHSI="HSI,恒生指数,当前,昨收,今开,最高,最低,时间,..."
      const match = text.match(/hq_str_\w+="([^"]+)"/);
      if (!match) return null;

      const fields = match[1].split(',');
      const price = parseFloat(fields[2]);
      const prevClose = parseFloat(fields[3]);
      const high = parseFloat(fields[5]);
      const low = parseFloat(fields[6]);
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol: code,
        name: name,
        description: description,
        price: price,
        change: change,
        changePct: changePct,
        high: high,
        low: low,
        trend: changePct >= 0 ? 'up' : 'down',
        updateTime: fields[17] + ' ' + fields[18],
        source: '新浪财经'
      };
    } catch (e) {
      console.warn(`${name}获取失败:`, e);
      return null;
    }
  }

  /**
   * 获取腾讯美股指数
   */
  async function fetchTencentUSIndex(code, name, description) {
    try {
      const resp = await fetchWithTimeout('https://qt.gtimg.cn/q=' + code);
      const buffer = await resp.arrayBuffer();
      const decoder = new TextDecoder('GBK');
      const text = decoder.decode(buffer);
      
      // 格式: v_usINX="200~名称~代码~当前~昨收~今开~..."
      const match = text.match(/v_\w+="([^"]+)"/);
      if (!match) return null;

      const fields = match[1].split('~');
      const price = parseFloat(fields[3]);
      const prevClose = parseFloat(fields[4]);
      const change = price - prevClose;
      const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol: code,
        name: name,
        description: description,
        price: price,
        change: change,
        changePct: changePct,
        trend: changePct >= 0 ? 'up' : 'down',
        updateTime: fields[30],
        source: '腾讯财经'
      };
    } catch (e) {
      console.warn(`${name}获取失败:`, e);
      return null;
    }
  }

  /**
   * 获取腾讯期货数据
   */
  async function fetchTencentFuture(code, name, description) {
    try {
      const resp = await fetchWithTimeout('https://qt.gtimg.cn/q=' + code);
      const buffer = await resp.arrayBuffer();
      const decoder = new TextDecoder('GBK');
      const text = decoder.decode(buffer);
      
      // 格式: v_hf_CL="价格,涨跌,昨收,今开,最高,最低,时间,..."
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
        description: description,
        price: price,
        change: change,
        changePct: changePct,
        trend: changePct >= 0 ? 'up' : 'down',
        updateTime: fields[6] + ' ' + fields[12],
        source: '腾讯财经'
      };
    } catch (e) {
      console.warn(`${name}获取失败:`, e);
      return null;
    }
  }

  // =============================================================
  // 宏观指标数据
  // =============================================================

  /**
   * 获取宏观指标数据
   * 注：CPI/PMI等月度数据需要手动更新，这里返回实时市场数据
   * 真实宏观数据请参考: 国家统计局、中国人民银行、美联储等官方发布
   */
  async function fetchMacroData() {
    const cacheKey = 'macro_data';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      const [rates, goldUSD, indices] = await Promise.all([
        fetchExchangeRates(),
        fetchGoldPriceUSD(),
        fetchMarketIndices()
      ]);

      // 构建宏观数据（实时市场指标）
      const data = {
        china: {
          cpi: null,   // 月度数据，需手动更新
          ppi: null,
          pmi: null,
          m2: null,
          lpr: null
        },
        us: {
          cpi: null,   // 月度数据，需手动更新
          pce: null,
          nfp: null,
          unemployment: null,
          fed_rate: null
        },
        global: {
          dxy: null,   // 美元指数（暂无直接接口）
          us10y: null, // 美债收益率（暂无直接接口）
          vix: null,   // VIX恐慌指数（暂无直接接口）
          brent: null, // 布伦特原油
          gold: goldUSD ? {
            name: '现货黄金',
            value: goldUSD.price.toFixed(2),
            unit: 'USD/oz',
            period: goldUSD.lastUpdated,
            trend: goldUSD.changePct >= 0 ? 'up' : 'down',
            change: (goldUSD.changePct >= 0 ? '+' : '') + goldUSD.changePct.toFixed(2) + '%',
            source: goldUSD.source
          } : null,
          crude: indices?.items?.find(i => i.name === 'WTI原油') || null
        },
        exchange_rates: rates,
        market_indices: indices,
        updated_at: new Date().toISOString(),
        note: '宏观指标（CPI/PMI等）为月度数据，请参考官方发布'
      };

      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.error('宏观数据获取失败:', e);
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
    
    // 市场指数
    fetchMarketIndices,
    
    // 宏观数据
    fetchMacroData,
    
    // 工具
    getCache,
    setCache,
    CACHE_PREFIX,
    CACHE_TTL
  };
})();
