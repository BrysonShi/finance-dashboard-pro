/**
 * =============================================================
 * 财经日历模块
 * 数据来源：本地 data/calendar.json
 * =============================================================
 */
window.CalendarModule = (function() {
  'use strict';

  let cachedData = null;

  const countryNames = {
    'US': '美国', 'CN': '中国', 'EU': '欧洲',
    'JP': '日本', 'UK': '英国', 'AU': '澳大利亚', 'CA': '加拿大'
  };

  // =============================================================
  // 工具函数
  // =============================================================

  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  }

  function isPast(dateStr) {
    return daysUntil(dateStr) < 0;
  }

  function getCountdownTag(days) {
    if (days === 0) return '<span class="calendar-countdown soon">今日</span>';
    if (days === 1) return '<span class="calendar-countdown soon">明日</span>';
    if (days > 0 && days <= 3) return `<span class="calendar-countdown soon">${days}天后</span>`;
    if (days > 3 && days <= 7) return `<span class="calendar-countdown upcoming">${days}天后</span>`;
    if (days > 0) return `<span class="calendar-countdown normal">${days}天后</span>`;
    return '';
  }

  function getTomorrowTag(dateStr) {
    const days = daysUntil(dateStr);
    return days === 1; // 明天的事件标黄
  }

  function groupByMonth(events) {
    const groups = {};
    
    events.forEach(e => {
      const date = new Date(e.date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(e);
    });

    return Object.keys(groups)
      .sort()
      .map(key => ({
        month: key,
        monthLabel: formatMonthLabel(key),
        events: groups[key].sort((a, b) => new Date(a.date) - new Date(b.date))
      }));
  }

  function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split('-');
    const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月',
                        '七月', '八月', '九月', '十月', '十一月', '十二月'];
    return `${year}年 ${monthNames[parseInt(month) - 1]}`;
  }

  // =============================================================
  // 渲染函数
  // =============================================================

  function renderEventItem(e) {
    const date = new Date(e.date);
    const day = date.getDate();
    const days = daysUntil(e.date);
    const isPastEvent = isPast(e.date);
    const pastClass = isPastEvent ? 'past' : '';
    const importanceClass = e.importance || 'low';
    const tomorrowClass = getTomorrowTag(e.date) ? 'tomorrow-warning' : ''; // 明天事件标黄
    
    const countdownTag = !isPastEvent ? getCountdownTag(days) : '';
    const timeStr = e.time === '待定' || !e.time ? '待定' : e.time;
    
    return `
      <div class="calendar-item ${pastClass} ${importanceClass} ${tomorrowClass}">
        <div class="calendar-date">
          ${day}日
          <br>
          <span style="color:var(--text-3);font-size:9px">${timeStr}</span>
        </div>
        <div class="calendar-country">${countryNames[e.country] || e.country}</div>
        <div class="calendar-event">${e.event}</div>
        <div style="display:flex;align-items:center;gap:6px">
          ${countdownTag}
          <span class="calendar-importance ${importanceClass}">${e.importance === 'high' ? '高' : e.importance === 'medium' ? '中' : '低'}</span>
        </div>
      </div>
    `;
  }

  function renderEvents(events) {
    const container = document.getElementById('calendarContainer');
    if (!container) return;

    if (!events || events.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📅</div><div class="text">暂无财经事件</div></div>';
      return;
    }

    // 按重要性筛选
    const importanceFilter = document.getElementById('importanceFilter')?.value || 'all';
    let filteredEvents = events;
    
    if (importanceFilter === 'high') {
      filteredEvents = events.filter(e => e.importance === 'high');
    } else if (importanceFilter === 'medium-high') {
      filteredEvents = events.filter(e => e.importance === 'high' || e.importance === 'medium');
    }

    const groups = groupByMonth(filteredEvents);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    container.innerHTML = groups.map(group => {
      const highCount = group.events.filter(e => e.importance === 'high').length;
      
      return `
        <div class="calendar-month">
          <div class="calendar-month-title">
            ${group.monthLabel}
            ${highCount > 0 ? `<span style="color:var(--danger);font-weight:normal;font-size:10px;margin-left:8px">⚠️ ${highCount}个高重要性事件</span>` : ''}
          </div>
          <div class="calendar-list">
            ${group.events.map(renderEventItem).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  // 主加载函数
  async function load() {
    try {
      // 路径：calendar.js在docs/下，calendar.json在docs/data/下
      const resp = await fetch('data/calendar.json');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      
      const data = await resp.json();
      cachedData = data;

      // 添加筛选器
      const container = document.getElementById('calendarContainer');
      if (container) {
        const filterHtml = `
          <div class="calendar-filter" style="margin-bottom:12px">
            <label style="color:var(--text-2);font-size:12px">筛选：</label>
            <select id="importanceFilter" onchange="window.CalendarModule.reload()" style="background:var(--bg-2);color:var(--text-0);border:1px solid var(--line);border-radius:4px;padding:4px 8px;font-size:12px">
              <option value="all">全部</option>
              <option value="medium-high">中等以上</option>
              <option value="high">仅高重要性</option>
            </select>
          </div>
        `;
        container.innerHTML = filterHtml;
      }

      renderEvents(data.events || []);

      return data;
    } catch (e) {
      console.error('日历数据加载失败:', e);
      
      const container = document.getElementById('calendarContainer');
      if (container) {
        container.innerHTML = '<div class="empty-state"><div class="icon">📅</div><div class="text">数据加载失败</div></div>';
      }
      
      return null;
    }
  }

  // 重新加载（用于筛选）
  async function reload() {
    if (cachedData) {
      renderEvents(cachedData.events || []);
    }
  }

  return {
    load,
    reload,
    getCachedData: () => cachedData
  };
})();
