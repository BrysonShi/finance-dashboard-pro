# AI Finance Dashboard Pro

家庭财务三本账仪表盘 + 黄金持仓监控 + 宏观数据脉搏

**🎉 纯前端静态版本 - 支持 GitHub Pages 部署！**

## 功能特性

### 📊 Tab 1-3：原有三本账功能
- **资产配置**：股票/现金/房产分布、目标偏离、健康检查、长期增长预测
- **负债管理**：保险日历、循环开销、20年现金流瀑布
- **现金流追踪**：年度收支按类目/人员汇总

### 🥇 Tab 4：黄金持仓监控
- 现货黄金(AU/USD) + AU9999(CNY) 实时价格（Yahoo Finance）
- 持仓盈亏面板（成本1055元/克，当前价，浮盈亏）
- 10条加仓信号灯评估
- 200日均线位置图
- 关键价位标注（支撑/阻力）

### 🌐 Tab 5：宏观数据监控
- **中国指标**：CPI、PPI、PMI、M2、LPR
- **美国指标**：CPI、PCE、非农、失业率、Fed利率
- **全球指标**：美元指数、10Y美债收益率、VIX、布伦特原油
- 预警阈值变色提醒

### 📅 Tab 6：财经日历
- 2026年6-12月重要财经事件
- FOMC会议、非农发布日、CPI发布日、央行利率决议等
- 重要程度分级（高/中/低）

### 🎯 Tab 7：风险雷达
- 市场风险、财务风险、宏观风险、个人风险

### ⬆️ 顶部市场脉搏条
- 6大市场指标实时滚动：现货黄金、美元指数、10Y美债、VIX等
- 每项显示：名称 + 最新价 + 涨跌幅 + 迷你趋势线
- 5分钟自动缓存刷新

## 技术架构

### 纯前端设计
- **零后端依赖**：不需要服务器，所有数据通过浏览器直接获取
- **CORS 代理**：使用免费 CORS 代理访问 Yahoo Finance
- **本地缓存**：localStorage 缓存，5分钟过期
- **Fallback 机制**：API 失败时自动使用本地预置数据，绝不白屏

### 数据来源
- **黄金价格**：Yahoo Finance（通过 CORS 代理）
- **汇率数据**：open.er-api.com（免费，支持 CORS）
- **宏观指标**：预置参考数据 + 实时汇率换算
- **财经日历**：本地 JSON 文件（手动更新）

## 目录结构

```
finance-dashboard-pro/
├── public/                      # 前端静态文件（直接部署）
│   ├── index.html              # 主入口
│   ├── api-proxy.js            # API代理模块（核心）
│   ├── core.js                 # 核心计算库
│   ├── gold.js                 # 黄金监控模块
│   ├── macro.js                # 宏观数据模块
│   ├── calendar.js             # 财经日历模块
│   ├── data/                   # 数据文件
│   │   ├── gold-config.json    # 黄金持仓配置
│   │   └── calendar.json       # 财经日历数据
│   └── ...
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions 自动部署
├── vercel.json                 # Vercel 部署配置（可选）
├── README.md
└── AGENTS.md
```

## 快速开始

### 方式一：本地直接打开

```bash
# 直接用浏览器打开
open public/index.html

# 或使用简易服务器
cd public
python -m http.server 8080
# 访问 http://localhost:8080
```

### 方式二：部署到 GitHub Pages

1. 将项目推送到 GitHub 仓库
2. 在仓库 Settings → Pages 中启用 GitHub Pages
3. Source 选择 "GitHub Actions"
4. 推送代码到 main 分支，自动部署！

```bash
git add -A
git commit -m "✨ 纯前端版本，支持GitHub Pages"
git push
```

部署完成后访问：`https://[username].github.io/finance-dashboard-pro/`

### 方式三：部署到 Vercel

1. 将项目推送到 GitHub
2. 在 Vercel 导入项目
3. Framework Preset 选择 "Other"
4. Root Directory 选择项目根目录
5. 点击 Deploy

## 黄金持仓配置

持仓数据在 `public/data/gold-config.json` 中配置：

```json
{
  "position": {
    "cost_per_gram": 1055,
    "quantity": 50,
    "total_cost": 52750
  },
  "key_levels": {
    "support": [4360, 4450, 4500],
    "resistance": [4600, 4700]
  }
}
```

## 财经日历更新

财经日历数据在 `public/data/calendar.json` 中维护。重要事件包括：

- **FOMC 会议**：每年8次，约每隔6周
- **非农就业**：每月第一个周五 20:30
- **CPI/PPI 数据**：每月10-15日
- **央行利率决议**：美联储、欧央行、英央行等

## 视觉风格

深色主题，致敬 Bloomberg Terminal 风格：
- 主色调：深灰黑 `#0a0c10`
- 强调色：科技蓝 `#7aa2ff`
- 涨跌色：红涨绿跌（中国市场习惯）

## 响应式支持

- 桌面端：4列 KPI 网格
- 平板端：2列 KPI 网格
- 移动端：单列布局，底部导航

## 数据说明

- **DEMO数据**：所有金额均为虚构示例数据，请替换为真实数据
- **数据源**：Yahoo Finance（免费，无需API Key）
- **缓存策略**：localStorage 缓存，5分钟过期

## License

MIT
