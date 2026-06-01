// =============================================================
// 财经日历模块
// =============================================================
window.CalendarModule = (function() {
  'use strict';

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8000'
    : '/api';

  let cachedData = null;

  const countryNames = { 'US': '美国', 'CN': '中国', 'EU': '欧洲', 'JP': '日本', 'UK': '英国' };
  const importanceLabels = { 'high': '高', 'medium': '中', 'low': '低' };

  function formatDate(dateStr, timeStr) {
    if (!dateStr) return { date: '—', time: '—' };
    const parts = dateStr.split('-');
    return { date: `${parseInt(parts[1])}月${parseInt(parts[2])}日`, time: timeStr || '不定时' };
  }

  function renderEvents(events) {
    const container = document.getElementById('calendarList');
    if (!container) return;
    if (!events || events.length === 0) {
      container.innerHTML = '<div class="loading">暂无数据</div>';
      return;
    }
    container.innerHTML = events.map(e => {
      const { date, time } = formatDate(e.date, e.time);
      return `<div class="calendar-item ${e.importance}">
        <div class="calendar-date">${date}<br><span style="color:var(--text-3);font-size:9px">${time}</span></div>
        <div class="calendar-country">${countryNames[e.country] || e.country}</div>
        <div class="calendar-event">${e.event}</div>
        <div class="calendar-importance ${e.importance}">${importanceLabels[e.importance] || '低'}</div>
      </div>`;
    }).join('');
  }

  async function load() {
    try {
      const resp = await fetch(API_BASE + '/calendar/');
      if (!resp.ok) throw new Error('API error: ' + resp.status);
      const data = await resp.json();
      cachedData = data;
      renderEvents(data.events);
      return data;
    } catch (e) {
      console.error('日历数据加载失败:', e);
      return cachedData;
    }
  }

  return { load, getCachedData: () => cachedData };
})();
