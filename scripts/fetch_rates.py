#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
抓取实时汇率，输出 JSON 片段，方便 append 到 history.json。
来源：https://open.er-api.com/v6/latest/USD（免费、无需 key）

用法：
    python3 fetch_rates.py            # 打印当前 USD→RMB / HKD→RMB
    python3 fetch_rates.py --json     # 输出 history.json snapshot 模板片段
"""
import json
import sys
import urllib.request
from datetime import date


def fetch():
    with urllib.request.urlopen("https://open.er-api.com/v6/latest/USD", timeout=10) as resp:
        data = json.load(resp)
    rates = data["rates"]
    usd_rmb = round(rates["CNY"], 4)
    usd_hkd = rates["HKD"]
    hkd_rmb = round(rates["CNY"] / rates["HKD"], 4)
    return {
        "USD": usd_rmb,
        "HKD": hkd_rmb,
        "_source": data.get("time_last_update_utc", ""),
        "_usd_to_hkd": round(usd_hkd, 4),
    }


def main():
    r = fetch()
    if "--json" in sys.argv:
        snap = {
            "date": str(date.today()),
            "rates": {"USD": r["USD"], "HKD": r["HKD"]},
            "ratesSource": f"open.er-api.com ({r['_source']})",
            "comment": "TODO 写一句备注",
            "holdings": {"TODO_sub_key": {"raw": 0}},
        }
        print(json.dumps(snap, ensure_ascii=False, indent=2))
    else:
        print(f"USD → RMB : {r['USD']}")
        print(f"HKD → RMB : {r['HKD']}")
        print(f"USD → HKD : {r['_usd_to_hkd']}")
        print(f"source    : {r['_source']}")


if __name__ == "__main__":
    main()
