/**
 * =============================================================
 * 财经日历模块 - 纯前端版
 * 数据来源：本地 data/calendar.json
 * =============================================================
 */
window.CalendarModule = (function() {
  'use strict';

  let cachedData = null;

  // =============================================================
  // 常量映射
  // =============================================================

  const countryNames = {
    'US': '美国',
    'CN': '中国',
    'EU': '欧洲',
    'JP': '日本',
    'UK': '英国',
    'AU': '澳大利亚',
    'CA': '加拿大'
  };

  const importanceLabels = {
    'high': '高',
    'medium': '中',
    'low': '低'
  };

  // =============================================================
  // 工具函数
  // =============================================================

  /**
   * 格式化日期显示
   */
  function formatDate(dateStr, timeStr) {
    if (!dateStr) return { date: '—', time: '—' };
    const parts = dateStr.split('-');
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const day = parseInt(parts[2]);
    return {
      date: `${month}月${day}日`,
      time: timeStr || '不定时'
    };
  }

  /**
   * 计算距离今天的天数
   */
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return diff;
  }

  /**
   * 获取日期标签
   */
  function getDateTag(dateStr) {
    const days = daysUntil(dateStr);
    if (days === null) return '';
    if (days === 0) return '<span style="background:var(--danger);color:#fff;padding:1px 4px;border-radius:3px;font-size:9px">今日</span>';
    if (days > 0 && days <= 3) return '<span style="background:var(--warn);color:#000;padding:1px 4px;border-radius:3px;font-size:9px">' + days + '天后</span>';
    if (days > 3 && days <= 7) return '<span style="background:var(--accent);color:#000;padding:1px 4px;border-radius:3px;font-size:9px">' + days + '天后</span>';
    return '';
  }

  /**
   * 获取事件重要程度标签
   */
  function getImportanceTag(importance) {
    const labels = importanceLabels[importance] || '低';
    return `<span class="calendar-importance ${importance || 'low'}">${labels}</span>`;
  }

  // =============================================================
  // 渲染函数
  // =============================================================

  /**
   * 渲染事件列表
   */
  function renderEvents(events) {
    const container = document.getElementById('calendarList');
    if (!container) return;

    if (!events || events.length === 0) {
      container.innerHTML = '<div class="loading">暂无数据</div>';
      return;
    }

    // 按日期排序（即将到来的事件优先）
    const sortedEvents = [...events].sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });

    container.innerHTML = sortedEvents.map(e => {
      const { date, time } = formatDate(e.date, e.time);
      const dateTag = getDateTag(e.date);
      const importanceTag = getImportanceTag(e.importance);
      const country = countryNames[e.country] || e.country;
      const note = e.note ? `<div style="font-size:10px;color:var(--text-3);margin-top:2px">${e.note}</div>` : '';

      return `<div class="calendar-item ${e.importance || 'low'}">
        <div class="calendar-date">${date}${dateTag ? '<br>' + dateTag : ''}<br><span style="color:var(--text-3);font-size:9px">${time}</span></div>
        <div class="calendar-country">${country}</div>
        <div class="calendar-event">${e.event}${note}</div>
        <div style="text-align:right">${importanceTag}</div>
      </div>`;
    }).join('');
  }

  /**
   * 渲染即将到来的重要事件（高重要性）
   */
  function renderUpcoming(events) {
    const container = document.getElementById('upcomingEvents');
    if (!container) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 14);

    const upcoming = events.filter(e => {
      if (e.importance !== 'high') return false;
      const eventDate = new Date(e.date);
      return eventDate >= today && eventDate <= nextWeek;
    }).slice(0, 5);

    if (upcoming.length === 0) {
      container.innerHTML = '<div style="color:var(--text-3);font-size:12px;padding:10px">未来两周无高重要性事件</div>';
      return;
    }

    container.innerHTML = upcoming.map(e => {
      const { date, time } = formatDate(e.date, e.time);
      return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="text-align:center;min-width:40px">
          <div style="font-size:16px;font-weight:600;color:var(--text-0)">${new Date(e.date).getDate()}</div>
          <div style="font-size:10px;color:var(--text-2)">${date.split('月')[0]}月</div>
        </div>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--text-0)">${e.event}</div>
          <div style="font-size:10px;color:var(--text-2)">${time} · ${countryNames[e.country] || e.country}</div>
        </div>
      </div>`;
    }).join('');
  }

  // =============================================================
  // 主加载函数
  // =============================================================

  async function load() {
    try {
      // 从本地JSON文件加载
      const resp = await fetch('data/calendar.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      
      const data = await resp.json();
      cachedData = data;

      renderEvents(data.events || []);
      
      // 如果页面有 upcomingEvents 容器，也渲染即将到来的事件
      renderUpcoming(data.events || []);

      return data;
    } catch (e) {
      console.error('日历数据加载失败:', e);
      
      // 如果本地加载失败，尝试内嵌的 fallback 数据
      renderEvents(getFallbackEvents());
      
      return cachedData;
    }
  }

  /**
   * Fallback 事件数据（内嵌，不依赖网络）
   */
  function getFallbackEvents() {
    return [
      { date: new Date().toISOString().split('T')[0], time: '20:30', country: 'US', event: '美国非农就业报告', importance: 'high', note: '美联储重点关注' },
      { date: '2026-06-16', time: '02:00', country: 'US', event: 'FOMC利率决议', importance: 'high', note: '沃什首次主持FOMC会议' },
      { date: '2026-06-17', time: '02:00', country: 'US', event: '美联储主席沃什新闻发布会', importance: 'high', note: '首次新闻发布会' },
      { date: '2026-07-03', time: '20:30', country: 'US', event: '美国6月非农就业人口', importance: 'high', note: '夏季就业报告' },
      { date: '2026-07-10', time: '20:30', country: 'US', event: '美国6月CPI同比', importance: 'high', note: '年中通胀数据' },
      { date: '2026-07-25', time: '02:00', country: 'US', event: '美联储利率决议', importance: 'high', note: '7月FOMC会议' },
      { date: '2026-08-05', time: '20:30', country: 'US', event: '美国7月非农就业人口', importance: 'high', note: '夏季就业报告' },
      { date: '2026-09-02', time: '20:30', country: 'US', event: '美国8月非农就业人口', importance: 'high', note: '劳动节后首个就业报告' },
      { date: '2026-09-17', time: '02:00', country: 'US', event: '美联储利率决议', importance: 'high', note: '9月FOMC会议' },
      { date: '2026-11-05', time: '全天', country: 'US', event: '美国总统大选日', importance: 'high', note: '市场可能剧烈波动' },
      { date: '2026-12-15', time: '02:00', country: 'US', event: '美联储利率决议', importance: 'high', note: '12月FOMC会议（年内最后一次）' },
      { date: '2026-12-17', time: '02:00', country: 'US', event: '美联储主席鲍威尔新闻发布会', importance: 'high', note: '年度最后一次新闻发布会' }
    ];
  }

  return {
    load,
    getCachedData: () => cachedData,
    getFallbackEvents
  };
})();
