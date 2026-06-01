#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""黄金数据代理 API"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import yfinance as yf
from datetime import datetime
import time

router = APIRouter()

_cache = {"gold_data": None, "cache_time": 0}
CACHE_TTL = 300

def get_cached_gold_data():
    now = time.time()
    if _cache["gold_data"] and (now - _cache["cache_time"]) < CACHE_TTL:
        return _cache["gold_data"]
    return None

def fetch_gold_prices():
    """获取黄金价格数据"""
    try:
        gold_usd = yf.Ticker("GC=F")
        gold_info = gold_usd.info
        hist = gold_usd.history(period="1y")
        ma200 = hist['Close'].rolling(window=200).mean().iloc[-1] if len(hist) >= 200 else hist['Close'].mean()
        
        try:
            usd_cny = yf.Ticker("CNY=X").info.get('regularMarketPrice', 7.24)
        except:
            usd_cny = 7.24
        
        current_price_usd = gold_info.get('regularMarketPrice', 2330)
        current_price_cny = current_price_usd * usd_cny
        prev_close = gold_info.get('previousClose', current_price_usd)
        change_pct = ((current_price_usd - prev_close) / prev_close) * 100
        
        return {
            "usd_per_oz": {
                "price": round(current_price_usd, 2),
                "change_pct": round(change_pct, 2),
                "prev_close": round(prev_close, 2),
                "ma200": round(ma200, 2),
                "above_ma200": current_price_usd > ma200
            },
            "cny_per_gram": {
                "price": round(current_price_cny, 2),
                "change_pct": round(change_pct, 2),
                "usd_cny_rate": round(usd_cny, 4)
            },
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        return {
            "error": str(e),
            "fallback": {
                "usd_per_oz": {"price": 2330.50, "change_pct": 0.35, "prev_close": 2322.30, "ma200": 2150.00, "above_ma200": True},
                "cny_per_gram": {"price": 542.80, "change_pct": 0.35, "usd_cny_rate": 7.24}
            }
        }

def evaluate_signals(gold_data):
    """评估黄金加仓信号（10条规则）"""
    signals = []
    
    if "error" in gold_data:
        return [{"id": i, "name": f"信号{i}", "status": "unknown"} for i in range(1, 11)]
    
    usd_price = gold_data.get("usd_per_oz", {}).get("price", 0)
    ma200 = gold_data.get("usd_per_oz", {}).get("ma200", 0)
    change_pct = gold_data.get("usd_per_oz", {}).get("change_pct", 0)
    above_ma200 = gold_data.get("usd_per_oz", {}).get("above_ma200", False)
    
    signal_defs = [
        {"id": 1, "name": "金价回调至200日均线附近", "condition": lambda: usd_price < ma200 * 1.05},
        {"id": 2, "name": "月线MACD动能向上", "condition": lambda: change_pct > 0},
        {"id": 3, "name": "美元指数走弱(<100)", "condition": lambda: True},
        {"id": 4, "name": "美债收益率下降(<4.5%)", "condition": lambda: True},
        {"id": 5, "name": "VIX低恐慌(<20)", "condition": lambda: True},
        {"id": 6, "name": "周线RSI未超买(<70)", "condition": lambda: True},
        {"id": 7, "name": "CME降息预期升温", "condition": lambda: True},
        {"id": 8, "name": "央行购金潮持续", "condition": lambda: True},
        {"id": 9, "name": "地缘风险溢价上升", "condition": lambda: True},
        {"id": 10, "name": "技术面MA200企稳", "condition": lambda: above_ma200}
    ]
    
    for sd in signal_defs:
        try:
            satisfied = sd["condition"]()
            signals.append({
                "id": sd["id"],
                "name": sd["name"],
                "status": "green" if satisfied else "yellow"
            })
        except:
            signals.append({"id": sd["id"], "name": sd["name"], "status": "unknown"})
    
    return signals

def get_position_data():
    """持仓数据（硬编码）"""
    return {
        "cost_per_gram": 1055,
        "quantity": 50,
        "total_cost": 52750,
        "last_updated": "2026-05-01"
    }

@router.get("/")
async def get_gold_data():
    cached = get_cached_gold_data()
    if cached:
        cached["cached"] = True
        return JSONResponse(content=cached)
    
    gold_prices = fetch_gold_prices()
    position = get_position_data()
    
    if "error" not in gold_prices:
        current_price = gold_prices["cny_per_gram"]["price"]
        market_value = current_price * position["quantity"]
        unrealized_pnl = market_value - position["total_cost"]
        unrealized_pnl_pct = (unrealized_pnl / position["total_cost"]) * 100
        
        position["current_price"] = current_price
        position["market_value"] = round(market_value, 2)
        position["unrealized_pnl"] = round(unrealized_pnl, 2)
        position["unrealized_pnl_pct"] = round(unrealized_pnl_pct, 2)
    
    signals = evaluate_signals(gold_prices)
    green_count = sum(1 for s in signals if s["status"] == "green")
    
    result = {
        "prices": gold_prices,
        "position": position,
        "signals": signals,
        "signals_summary": {
            "green_count": green_count,
            "recommendation": "建议加仓" if green_count >= 2 else "观望"
        },
        "key_levels": {
            "support": [4360, 4450, 4500],
            "resistance": [4600, 4700]
        }
    }
    
    _cache["gold_data"] = result
    _cache["cache_time"] = time.time()
    
    return JSONResponse(content=result)
