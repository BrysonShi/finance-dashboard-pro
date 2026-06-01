# AI Finance Dashboard Pro

家庭财务三本账仪表盘 + 黄金持仓监控 + 宏观数据脉搏

## 功能特性

### 📊 Tab 1-3：原有三本账功能
- **资产配置**：股票/现金/房产分布、目标偏离、健康检查、长期增长预测
- **负债管理**：保险日历、循环开销、20年现金流瀑布
- **现金流追踪**：年度收支按类目/人员汇总

### 🥇 Tab 4：黄金持仓监控
- 现货黄金(AU/USD) + AU9999(CNY) 实时价格
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
- 重要财经事件预告
- 重要程度分级（高/中/低）
- 市场休市日提醒

### 🎯 Tab 7：风险雷达
- 市场风险、财务风险、宏观风险、个人风险

### ⬆️ 顶部市场脉搏条
- 6大市场指标实时滚动：现货黄金、美元指数、10Y美债、沪深300、恒生指数、VIX
- 每项显示：名称 + 最新价 + 涨跌幅 + 迷你趋势线
- 1分钟自动刷新

## 目录结构

```
finance-dashboard-pro/
├── api/                    # Python后端API (FastAPI)
│   ├── gold.py            # 黄金数据代理
│   ├── macro.py           # 宏观指标代理
│   ├── market.py          # 市场脉搏数据
│   └── calendar.py        # 财经日历
├── public/                # 前端静态文件
│   ├── index.html         # 主入口
│   ├── core.js            # 核心计算库
│   ├── app.js             # Tab 1 资产配置
│   ├── liabilities.js     # Tab 2 负债
│   ├── cashflow.js        # Tab 3 现金流
│   ├── gold.js            # Tab 4 黄金监控
│   ├── macro.js           # Tab 5 宏观监控
│   ├── calendar.js        # Tab 6 财经日历
│   └── data/              # 数据文件
├── server.py              # 本地开发服务器
├── requirements.txt       # Python依赖
├── vercel.json            # Vercel部署配置
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动本地服务器

```bash
python server.py
```

### 3. 访问页面

- 前端：http://localhost:8000/public/index.html
- API文档：http://localhost:8000/docs

## Vercel 部署

1. 将项目推送到 GitHub
2. 在 Vercel 导入项目
3. Vercel 会自动识别 `vercel.json` 配置
4. 部署完成即可访问

**注意**：Vercel Serverless Functions 有超时限制，大数据量请求可能超时。

## 数据说明

- **DEMO数据**：所有金额均为虚构示例数据，请替换为真实数据
- **数据源**：Yahoo Finance（免费，无需API Key）
- **缓存策略**：内存缓存，5分钟过期

## 黄金持仓配置

持仓数据硬编码在 `api/gold.py` 的 `get_position_data()` 函数中：

```python
def get_position_data():
    return {
        "cost_per_gram": 1055,   # 成本价（元/克）
        "quantity": 50,          # 持仓数量（克）
        "total_cost": 52750,     # 总成本
        "last_updated": "2026-05-01"
    }
```

后续可通过配置文件或数据库管理。

## 技术栈

- **前端**：纯 HTML + CSS + JavaScript，零依赖
- **后端**：Python FastAPI
- **数据源**：Yahoo Finance (yfinance)
- **部署**：Vercel Serverless Functions

## 视觉风格

深色主题，致敬 Bloomberg Terminal 风格：
- 主色调：深灰黑 `#0a0c10`
- 强调色：科技蓝 `#7aa2ff`
- 涨跌色：红涨绿跌（中国市场习惯）

## License

MIT
