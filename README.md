# 家庭财务看板 · DEMO

> 一份给朋友 Fork 用的家庭财务管理仪表盘。
> 纯 HTML + JS + JSON，**不依赖任何后端**，浏览器打开就能看。
>
> ⚠️ **本仓库里的所有金额都是虚构的 DEMO 数据**。请把 `data/` 目录下的 JSON 替换成你自己的真实数据后使用。

---

## 这是什么

一个完整的家庭财务三本账仪表盘：

1. **资产配置** — 股票/现金/房产分布、目标偏离告警、长期增长预测、退休缺口、腾讯减仓阶梯
2. **负债与刚性支出** — 保险缴费日历、循环开销、未来 20 年现金流瀑布（含通胀切换）
3. **现金流追踪** — 年度收支按类目/人员汇总、预算 vs 实际、储蓄率

设计哲学：**不是基金组合，是一台"家庭被动现金流机器"** — 房租 + 股息 + 国债票息 + 黄金/科技对冲。

---

## 怎么开始用（3 分钟）

### 第 1 步：本地预览（验证能跑起来）

```bash
cd family-finance-dashboard
python3 -m http.server 8765
```

浏览器打开 <http://localhost:8765>，看到 DEMO 数据渲染出来即说明代码工作正常。

> ⚠️ 必须用 HTTP，不能直接双击 `index.html` 打开（fetch JSON 会被浏览器跨域拦截）。

### 第 2 步：把 DEMO 数据换成你自己的

进 `data/` 目录，按下面这张表挨个改：

| 文件 | 你需要做什么 |
|---|---|
| `target.json` | 改 `modules` 里的目标比例（targetPct）；改 `retirement.selfRetireYear` 等假设；改 `redLines` |
| `history.json` | 把 `holdings` 里的 `raw`（现金）/ `shares`+`cost`（证券）改成你真实的；把 `prices` 改成当前股价 |
| `recurring.json` | `incomes` 填你的工资、房租收入、家庭转账；`expenses` 填房租、保险、利息、通讯、停车等所有月度/年度循环开销 |
| `liabilities.json` | 房贷 / 借款 / 软性负债（向亲属借款无固定还款日的） |
| `income_events.json` | 一次性事件：股票兑现 / 项目分红 / 单点奖金等（DEMO 留空） |
| `transactions/yearly/2026.json` | 当年实际开销按大类汇总（推荐从随手记/网易有钱年度截图导入）|
| `transactions/index.json` | 每加一年记得在 `years` 数组里加一项 |

**最快路径**：把整个 `data/` 文件夹和你的 AI（Claude / ChatGPT / Cursor / CodeBuddy 都行）说"帮我把这些 DEMO 数据换成我的"，然后丢一张随手记年度截图、几张持仓截图、几张保单照片给它，让它自动改。

### 第 3 步：每次报数

每隔 1-3 个月做一次：

1. 跑 `python3 scripts/fetch_rates.py` 抓实时汇率
2. 在 `data/history.json` 的 `snapshots` 数组**末尾追加**一条新快照（永不覆盖旧的）
3. 跑 `python3 scripts/backup_data.py "本次报数说明"` 留个备份
4. 浏览器刷新看新数据

---

## 看板能看到什么

### Tab 1 · 📊 资产配置

- **顶部状态栏**：快照日期切换 + 实时汇率
- **健康检查 strip**：单一公司红线 / RMB 占比 / 大类偏离 / 待变现资产，逐条列出告警等级 + 触发条件 + 推荐动作
- **腾讯阶梯小图**（如有腾讯持仓）：当前价位 vs 进攻档/防御档/红线档，下次触发提示
- **8 张 KPI**：总资产 / 单一股票敞口 / RMB 占比 / 告警数 / 持仓盈亏 / 整体年化 / 金融盘年化 / 退休年缺口
- **模块画像**：每个大类一张卡 — 进度条 + 目标线 + 阈值带 + 子项明细（含币种/账户/盈亏）
- **偏离告警表**：双层（大类 + 子项）一览
- **币种分布 + 池分离**：RMB 池 vs 海外池物理隔离视图
- **趋势图**：4 个 sparkline（总盘 / RMB 占比 / 单一公司敞口 / 告警数），过去快照点可点击切换
- **更新时间线**：历次快照可点击切换；显示备注 + 环比
- **长期增长预测**：保守/中性/乐观三档，名义/实际购买力切换
- **Target.json 总览** + **里程碑 P0/P1/P2/P3 清单**

### Tab 2 · 💸 负债与刚性

- KPI: 总资产 / 总负债 / 净资产 / 月度净流出 / 年保费 / 刚性支出 / 过渡期累计净流 / 退休稳态净流
- 负债清单（含软性负债如向亲属借款，本金不扣减净资产）
- 循环收支月度表（自动按汇率折算 RMB）
- **保单缴费日历**（按到期排序，倒计时 + 剩余应缴尾款）
- **未来 20 年现金流瀑布**：每年支出/收入条 + 关键事件 chip（保单缴清 🟢 / 工资终止 🎯 / 股票兑现 💎），通胀名义/实际购买力切换

### Tab 3 · 📈 现金流追踪

- 年度 KPI: 总收入 / 总支出 / 净结余 / 储蓄率 / 弹性 vs 刚性占比
- 支出大类堆叠条 + 按人维度
- **预算 vs 实际表**：recurring.json 的循环项 vs 当年实绩自动 diff
- 大类明细列表

---

## 项目结构

```
family-finance-dashboard/
├── index.html              # 三 Tab 主入口
├── core.js                 # 共享工具：fmt / 汇率换算 / 加权年化 / 健康检查 / 资产对账
├── app.js                  # Tab 1 资产配置
├── liabilities.js          # Tab 2 负债与刚性
├── cashflow.js             # Tab 3 现金流追踪
├── data/
│   ├── target.json         # 终局目标（modules / philosophy / redLines / inflation / retirement / milestones）
│   ├── history.json        # append-only 快照数组
│   ├── liabilities.json    # 负债清单
│   ├── recurring.json      # 循环收支
│   ├── income_events.json  # 一次性事件
│   ├── categories.json     # 支出/收入分类 + 人员
│   └── transactions/
│       ├── index.json
│       └── yearly/2026.json
├── scripts/
│   ├── fetch_rates.py      # 抓 USD/HKD 汇率
│   └── backup_data.py      # 改 data/ 之前先跑一次
├── README.md               # 这个文件
└── AGENTS.md               # 给 AI 看的工作指南
```

---

## 配置框架（保留作为参考）

DEMO 里保留了一套真实可用的配置思路 — 金额是虚构的，但结构和股票代码是真的：

| 大类 | 目标 | 阈值 | 子项 |
|---|---:|---:|---|
| 一·防御现金 | 16% | ±3% | 微众活期 / 国债阶梯 / 短债 ETF / 美元货币基金 / 美国国债 |
| 二·稳健现金流 | 50% | ±5% | 房产 A（出租收租金）/ 红利低波 512890 |
| 三·全球增长 | 20% | ±5% | CSPX·UCITS / VOO / QQQM / BRK.B |
| 四·避险卫星 | 14% | ±3% | IAU 黄金 / 腾讯 ×3 账户（港股通主仓 + 富途清仓） |

> 自己用的时候，按你的风险偏好和持仓重写 modules 即可。结构（philosophy / redLines / 双层阈值 / 池分离）可以留着当框架。

---

## 常见问题

**Q: 我的浏览器打开后 console 报 "JSON 解析失败"？**
A: 你改 JSON 时多了/少了逗号。VS Code 安装 "JSON Lint" 插件，或者直接 `python3 -c "import json; json.load(open('data/target.json'))"` 验证。

**Q: 数据在 git 里我不希望同步？**
A: 写个 `.gitignore`：

```
data/*
!data/.gitkeep
!data/categories.json
```

或者整个项目放 iCloud / Dropbox / 个人私有 git 仓库。

**Q: 怎么加新股票？**
A: 在 `target.json` 对应模块的 `subs` 数组加一条（key/name/ccy/venue/subTargetPct/expectedReturn），在 `history.json` 当前 snapshot 的 `holdings` 加 `{shares, cost}` + `prices` 加 `{ccy, price}`。

**Q: 怎么加退休金 / 公积金 / 社保？**
A: 公积金 / 社保按月缴的当 recurring.expenses（或者忽略，反正最后都进社保账户）；退休金到账当 income_events 的一次性事件。

**Q: 我没有腾讯持仓，腾讯阶梯小图怎么办？**
A: 不影响。`renderTencentLadder` 检测到 tencent_* 子项全为空时会自动隐藏。

---

## 致谢

这套看板由 [@Damao](https://github.com/Damao) 在 2026 年和他的 AI 助手共同迭代而来，开放给朋友 Fork 使用。
配色致敬 Bloomberg Terminal · 等宽数字 JetBrains Mono · 设计语言参考 Linear / Vercel / Tremor。

如果改出更好的版本，欢迎 PR / 或者把截图发给我看看 :)
