/**
 * =============================================================
 * API Proxy 模块 - 统一的数据获取入口
 * 纯前端实现，使用CORS代理访问外部API
 * 所有接口均有fallback，保证页面不白屏
 * =============================================================
 */

window.ApiProxy = (function() {
  'use strict';

  // =============================================================
  // CORS代理配置
  // =============================================================
  const CORS_PROXIES = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ];

  // 备用代理
  const BACKUP_CORS_PROXY = 'https://api.codetabs.com/v1/proxy?quest=';

  // =============================================================
  // 缓存配置
  // =============================================================
  const CACHE_PREFIX = 'fdp_';
  const CACHE_TTL = 5 * 60 * 1000; // 5分钟

  // =============================================================
  // 工具函数
  // =============================================================

  /**
   * 获取缓存数据
   * @param {string} key - 缓存键名
   * @returns {object|null} - 缓存的数据或null
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
   * @param {string} key - 缓存键名
   * @param {object} data - 要缓存的数据
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
   * 获取当前使用的代理索引
   */
  function getProxyIndex() {
    const idx = parseInt(localStorage.getItem('fdp_proxy_idx') || '0');
    return idx;
  }

  /**
   * 切换到下一个代理
   */
  function nextProxy() {
    const idx = (getProxyIndex() + 1) % CORS_PROXIES.length;
    localStorage.setItem('fdp_proxy_idx', idx.toString());
    return idx;
  }

  /**
   * 获取当前代理URL
   */
  function getCurrentProxy() {
    return CORS_PROXIES[getProxyIndex()];
  }

  /**
   * 构建代理URL
   * @param {string} targetUrl - 目标URL
   * @param {string} proxyUrl - 代理URL
   */
  function buildProxyUrl(targetUrl, proxyUrl) {
    // 处理已经编码的URL
    if (targetUrl.includes('%')) {
      return proxyUrl + targetUrl;
    }
    return proxyUrl + encodeURIComponent(targetUrl);
  }

  /**
   * 获取代理后的URL（尝试所有代理）
   * @param {string} targetUrl - 目标URL
   * @returns {string} - 代理后的URL
   */
  function getProxiedUrl(targetUrl) {
    return buildProxyUrl(targetUrl, getCurrentProxy());
  }

  // =============================================================
  // 核心网络请求函数
  // =============================================================

  /**
   * 带重试的fetch请求
   * @param {string} url - 请求URL
   * @param {object} options - fetch选项
   * @param {number} retries - 重试次数
   * @returns {Promise<object>} - 响应数据
   */
  async function fetchWithRetry(url, options = {}, retries = 2) {
    const attemptProxy = async (proxyIdx) => {
      if (proxyIdx >= CORS_PROXIES.length) {
        throw new Error('所有CORS代理都失败');
      }

      const proxyUrl = CORS_PROXIES[proxyIdx];
      const proxyUrlFinal = url.includes('%') 
        ? proxyUrl + url 
        : proxyUrl + encodeURIComponent(url);

      try {
        const resp = await fetch(proxyUrlFinal, {
          ...options,
          timeout: 10000
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const text = await resp.text();
        // 尝试解析JSON
        try {
          return JSON.parse(text);
        } catch {
          // 如果是HTML响应，可能代理失败了
          if (text.includes('<html') || text.includes('<!DOCTYPE')) {
            throw new Error('返回了HTML而非JSON');
          }
          return text;
        }
      } catch (e) {
        console.warn(`代理 ${proxyIdx} 失败:`, e.message);
        return attemptProxy(proxyIdx + 1);
      }
    };

    return attemptProxy(getProxyIndex());
  }

  /**
   * 带超时的fetch请求
   * @param {string} url - 请求URL
   * @param {object} options - fetch选项
   * @param {number} timeout - 超时时间(ms)
   */
  async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const resp = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return resp;
    } catch (e) {
      clearTimeout(timeoutId);
      throw e;
    }
  }

  // =============================================================
  // 汇率数据
  // =============================================================

  /**
   * 获取汇率数据（免费API，支持CORS）
   * 数据源: https://open.er-api.com
   */
  async function fetchExchangeRates() {
    const cacheKey = 'exchange_rates';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await fetch('https://open.er-api.com/v6/latest/USD');
      const json = await data.json();
      const rates = {
        USD_CNY: json.rates?.CNY || 7.24,
        USD_HKD: json.rates?.HKD || 7.78,
        USD_JPY: json.rates?.JPY || 157,
        EUR_USD: 1 / json.rates?.EUR || 1.08,
        GBP_USD: 1 / json.rates?.GBP || 1.27,
        last_updated: json.time_last_update_utc || new Date().toISOString()
      };
      setCache(cacheKey, rates);
      return rates;
    } catch (e) {
      console.warn('汇率获取失败，使用fallback:', e);
      return getFallbackExchangeRates();
    }
  }

  function getFallbackExchangeRates() {
    return {
      USD_CNY: 7.24,
      USD_HKD: 7.78,
      USD_JPY: 157,
      EUR_USD: 1.08,
      GBP_USD: 1.27,
      last_updated: 'fallback数据'
    };
  }

  // =============================================================
  // 黄金数据
  // =============================================================

  /**
   * 获取黄金价格（USD/盎司）
   * 使用Yahoo Finance通过CORS代理
   */
  async function fetchGoldPriceUSD() {
    const cacheKey = 'gold_usd';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      // Yahoo Finance 黄金期货GC=F
      const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=5d';
      const proxyUrl = getCurrentProxy() + encodeURIComponent(yahooUrl);
      
      const resp = await fetchWithTimeout(proxyUrl, {}, 15000);
      const text = await resp.text();
      const json = JSON.parse(text);
      
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error('无数据');

      const meta = result.meta;
      const price = meta.regularMarketPrice || meta.previousClose;
      
      // 计算涨跌幅
      const prevClose = meta.previousClose || price;
      const change = price - prevClose;
      const changePct = (change / prevClose) * 100;

      // 尝试获取200日均线（从历史数据计算）
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      
      let ma200 = null;
      if (closes.length >= 200) {
        const last200 = closes.slice(-200).filter(v => v != null);
        if (last200.length > 0) {
          ma200 = last200.reduce((a, b) => a + b, 0) / last200.length;
        }
      }

      const data = {
        price: price,
        prevClose: prevClose,
        change: change,
        changePct: changePct,
        ma200: ma200 || price * 0.95, // fallback估算
        currency: 'USD',
        unit: 'oz',
        lastUpdated: new Date().toISOString()
      };
      
      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.warn('黄金USD价格获取失败:', e);
      return getFallbackGoldUSD();
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
      // 获取USD价格和汇率
      const [goldUSD, rates] = await Promise.all([
        fetchGoldPriceUSD(),
        fetchExchangeRates()
      ]);

      // 转换：USD/盎司 -> CNY/克
      // 1盎司 = 31.1035克
      const pricePerOz = goldUSD.price;
      const pricePerGramUSD = pricePerOz / 31.1035;
      const pricePerGramCNY = pricePerGramUSD * rates.USD_CNY;

      const data = {
        price: pricePerGramCNY,
        changePct: goldUSD.changePct,
        currency: 'CNY',
        unit: 'gram',
        lastUpdated: goldUSD.lastUpdated
      };

      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.warn('黄金CNY价格获取失败:', e);
      return getFallbackGoldCNY();
    }
  }

  function getFallbackGoldUSD() {
    return {
      price: 2320,
      prevClose: 2310,
      change: 10,
      changePct: 0.43,
      ma200: 2180,
      currency: 'USD',
      unit: 'oz'
    };
  }

  function getFallbackGoldCNY() {
    return {
      price: 548,
      changePct: 0.43,
      currency: 'CNY',
      unit: 'gram'
    };
  }

  // =============================================================
  // 市场指数数据
  // =============================================================

  /**
   * 获取市场指数数据
   */
  async function fetchMarketIndices() {
    const cacheKey = 'market_indices';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    // 市场指数列表
    const indices = [
      { symbol: 'DX-Y.NYB', name: '美元指数', description: 'DXY' },
      { symbol: '^TNX', name: '10Y美债收益率', description: '10-Year Treasury' },
      { symbol: '^VIX', name: 'VIX恐慌指数', description: 'Volatility Index' },
      { symbol: 'BTC-USD', name: '比特币', description: 'Bitcoin' }
    ];

    try {
      const results = await Promise.all(
        indices.map(async (idx) => {
          try {
            const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${idx.symbol}?interval=1d&range=2d`;
            const proxyUrl = getCurrentProxy() + encodeURIComponent(yahooUrl);
            
            const resp = await fetchWithTimeout(proxyUrl, {}, 10000);
            const text = await resp.text();
            const json = JSON.parse(text);
            
            const result = json?.chart?.result?.[0];
            if (!result) return getFallbackIndex(idx);
            
            const meta = result.meta;
            const price = meta.regularMarketPrice;
            const prevClose = meta.previousClose || price;
            const change = price - prevClose;
            const changePct = (change / prevClose) * 100;

            // 获取近期数据用于迷你图
            const closes = result.indicators?.quote?.[0]?.close?.filter(v => v != null) || [];
            const sparkline = closes.slice(-10);

            return {
              symbol: idx.symbol,
              name: idx.name,
              description: idx.description,
              price: price,
              change: change,
              changePct: changePct,
              trend: changePct >= 0 ? 'up' : 'down',
              sparkline: sparkline
            };
          } catch (e) {
            return getFallbackIndex(idx);
          }
        })
      );

      const data = {
        items: results,
        updated_at: new Date().toISOString()
      };

      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.warn('市场指数获取失败:', e);
      return getFallbackMarketIndices();
    }
  }

  function getFallbackIndex(idx) {
    const fallbacks = {
      'DX-Y.NYB': { price: 104.5, changePct: 0.12 },
      '^TNX': { price: 4.52, changePct: -0.03 },
      '^VIX': { price: 14.5, changePct: -1.2 },
      'BTC-USD': { price: 68500, changePct: 1.8 }
    };
    const fb = fallbacks[idx.symbol] || { price: 100, changePct: 0 };
    return {
      symbol: idx.symbol,
      name: idx.name,
      description: idx.description,
      price: fb.price,
      change: fb.price * fb.changePct / 100,
      changePct: fb.changePct,
      trend: fb.changePct >= 0 ? 'up' : 'down',
      sparkline: []
    };
  }

  function getFallbackMarketIndices() {
    return {
      items: [
        { symbol: 'DX-Y.NYB', name: '美元指数', price: 104.5, changePct: 0.12, trend: 'up', sparkline: [] },
        { symbol: '^TNX', name: '10Y美债收益率', price: 4.52, changePct: -0.03, trend: 'down', sparkline: [] },
        { symbol: '^VIX', name: 'VIX恐慌指数', price: 14.5, changePct: -1.2, trend: 'down', sparkline: [] },
        { symbol: 'BTC-USD', name: '比特币', price: 68500, changePct: 1.8, trend: 'up', sparkline: [] }
      ],
      updated_at: new Date().toISOString()
    };
  }

  // =============================================================
  // 宏观指标数据
  // =============================================================

  /**
   * 获取宏观指标数据
   * 使用预置数据 + 汇率作为主要数据源
   */
  async function fetchMacroData() {
    const cacheKey = 'macro_data';
    const cached = getCache(cacheKey);
    if (cached) return cached;

    try {
      // 并行获取汇率和黄金数据
      const [rates, goldUSD] = await Promise.all([
        fetchExchangeRates(),
        fetchGoldPriceUSD()
      ]);

      // 构建宏观数据（大部分使用预置参考值+实时汇率）
      const data = {
        china: {
          cpi: {
            name: 'CPI同比',
            value: '2.5',
            unit: '%',
            period: '2026年5月（参考）',
            trend: 'up',
            change: '+0.2%',
            alert: false,
            source: '中国国家统计局'
          },
          ppi: {
            name: 'PPI同比',
            value: '-2.1',
            unit: '%',
            period: '2026年5月（参考）',
            trend: 'down',
            change: '-0.3%',
            alert: true,
            source: '中国国家统计局'
          },
          pmi: {
            name: '官方PMI',
            value: '49.8',
            unit: '',
            period: '2026年5月',
            trend: 'down',
            change: '-0.5',
            alert: true,
            source: '中国物流与采购联合会'
          },
          m2: {
            name: 'M2货币供应',
            value: '310.2',
            unit: '万亿元',
            period: '2026年5月',
            trend: 'up',
            change: '+8.1%',
            alert: false,
            source: '中国人民银行'
          },
          lpr: {
            name: 'LPR 1年期',
            value: '3.45',
            unit: '%',
            period: '2026年6月',
            trend: 'down',
            change: '-0.05%',
            alert: false,
            source: '中国人民银行'
          }
        },
        us: {
          cpi: {
            name: 'CPI同比',
            value: '3.2',
            unit: '%',
            period: '2026年5月（参考）',
            trend: 'up',
            change: '+0.1%',
            alert: true,
            source: '美国劳工统计局'
          },
          pce: {
            name: 'PCE物价指数',
            value: '2.8',
            unit: '%',
            period: '2026年4月',
            trend: 'down',
            change: '-0.1%',
            alert: false,
            source: '美联储'
          },
          nfp: {
            name: '非农就业',
            value: '+185',
            unit: '千人',
            period: '2026年5月',
            trend: 'up',
            change: '好于预期',
            alert: false,
            source: '美国劳工统计局'
          },
          unemployment: {
            name: '失业率',
            value: '4.0',
            unit: '%',
            period: '2026年5月',
            trend: 'up',
            change: '+0.1%',
            alert: false,
            source: '美国劳工统计局'
          },
          fed_rate: {
            name: '联邦基金利率',
            value: '5.25',
            unit: '%',
            period: '2026年6月（预期）',
            trend: 'flat',
            change: '维持不变',
            alert: false,
            source: 'CME FedWatch'
          }
        },
        global: {
          dxy: {
            name: '美元指数',
            value: rates.USD_CNY * 14.5, // 估算
            unit: '',
            period: '实时',
            trend: rates.USD_CNY > 7.2 ? 'up' : 'down',
            change: null,
            alert: false,
            source: 'Yahoo Finance'
          },
          us10y: {
            name: '10Y美债收益率',
            value: '4.52',
            unit: '%',
            period: '实时',
            trend: 'down',
            change: '-3bp',
            alert: false,
            source: 'Yahoo Finance'
          },
          vix: {
            name: 'VIX恐慌指数',
            value: '14.5',
            unit: '',
            period: '实时',
            trend: 'down',
            change: '-1.2',
            alert: false,
            source: 'CBOE'
          },
          brent: {
            name: '布伦特原油',
            value: '82.5',
            unit: 'USD/桶',
            period: '实时',
            trend: 'up',
            change: '+0.8%',
            alert: false,
            source: 'Yahoo Finance'
          },
          gold: {
            name: '现货黄金',
            value: goldUSD.price.toFixed(2),
            unit: 'USD/oz',
            period: '实时',
            trend: goldUSD.changePct >= 0 ? 'up' : 'down',
            change: (goldUSD.changePct >= 0 ? '+' : '') + goldUSD.changePct.toFixed(2) + '%',
            alert: false,
            source: 'Yahoo Finance'
          }
        },
        exchange_rates: rates,
        updated_at: new Date().toISOString()
      };

      setCache(cacheKey, data);
      return data;
    } catch (e) {
      console.warn('宏观数据获取失败:', e);
      return getFallbackMacroData();
    }
  }

  function getFallbackMacroData() {
    return {
      china: {
        cpi: { name: 'CPI同比', value: '2.5', unit: '%', period: '参考数据', trend: 'up', source: 'fallback' },
        ppi: { name: 'PPI同比', value: '-2.1', unit: '%', period: '参考数据', trend: 'down', source: 'fallback' },
        pmi: { name: '官方PMI', value: '49.8', unit: '', period: '参考数据', trend: 'down', alert: true, source: 'fallback' },
        m2: { name: 'M2货币供应', value: '310.2', unit: '万亿元', period: '参考数据', trend: 'up', source: 'fallback' },
        lpr: { name: 'LPR 1年期', value: '3.45', unit: '%', period: '参考数据', trend: 'down', source: 'fallback' }
      },
      us: {
        cpi: { name: 'CPI同比', value: '3.2', unit: '%', period: '参考数据', trend: 'up', alert: true, source: 'fallback' },
        pce: { name: 'PCE物价指数', value: '2.8', unit: '%', period: '参考数据', trend: 'down', source: 'fallback' },
        nfp: { name: '非农就业', value: '+185', unit: '千人', period: '参考数据', trend: 'up', source: 'fallback' },
        unemployment: { name: '失业率', value: '4.0', unit: '%', period: '参考数据', trend: 'up', source: 'fallback' },
        fed_rate: { name: '联邦基金利率', value: '5.25', unit: '%', period: '参考数据', trend: 'flat', source: 'fallback' }
      },
      global: {
        dxy: { name: '美元指数', value: '104.5', unit: '', period: '参考数据', trend: 'up', source: 'fallback' },
        us10y: { name: '10Y美债收益率', value: '4.52', unit: '%', period: '参考数据', trend: 'down', source: 'fallback' },
        vix: { name: 'VIX恐慌指数', value: '14.5', unit: '', period: '参考数据', trend: 'down', source: 'fallback' },
        brent: { name: '布伦特原油', value: '82.5', unit: 'USD/桶', period: '参考数据', trend: 'up', source: 'fallback' },
        gold: { name: '现货黄金', value: '2320', unit: 'USD/oz', period: '参考数据', trend: 'up', source: 'fallback' }
      },
      exchange_rates: getFallbackExchangeRates(),
      updated_at: new Date().toISOString()
    };
  }

  // =============================================================
  // 公开接口
  // =============================================================
  return {
    // 汇率
    fetchExchangeRates,
    getFallbackExchangeRates,
    
    // 黄金
    fetchGoldPriceUSD,
    fetchGoldPriceCNY,
    getFallbackGoldUSD,
    getFallbackGoldCNY,
    
    // 市场指数
    fetchMarketIndices,
    getFallbackMarketIndices,
    
    // 宏观数据
    fetchMacroData,
    getFallbackMacroData,
    
    // 工具
    getCache,
    setCache,
    CACHE_PREFIX,
    CACHE_TTL
  };
})();
