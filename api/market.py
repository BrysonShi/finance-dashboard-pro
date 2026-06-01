#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""市场脉搏数据代理 API"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import yfinance as yf
import time
from datetime import datetime

router = APIRouter()

_cache = {"market_data": None, "cache_time": 0}
CACHE_TTL = 60

def get_cached():
    now = time.time()
    if _cache["market_data"] and (now - _cache["cache_time"]) < CACHE_TTL:
        return _cache["market_data"]
    return None

def fetch_single_ticker(symbol, name, region=""):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        price = info.get('regularMarketPrice')
        prev_close = info.get('previousClose') or info.get('regularMarketPreviousClose')
        
        if price is None or prev_close is None:
            hist = ticker.history(period="2d")
            if len(hist) >= 2:
                price = hist['Close'].iloc[-1]
                prev_close = hist['Close'].iloc[-2]
            else:
                return None
        
        change_pct = ((price - prev_close) / prev_close) * 100
        
        hist = ticker.history(period="5d")
        sparkline = []
        if len(hist) > 0:
            closes = hist['Close'].tolist()[-5:]
            sparkline = [round(c, 2) for c in closes]
        
        return {
            "symbol": symbol, "name": name, "region": region,
            "price": round(price, 2), "prev_close": round(prev_close, 2),
            "change_pct": round(change_pct, 2),
            "trend": "up" if change_pct > 0 else "down" if change_pct < 0 else "flat",
            "sparkline": sparkline
        }
    except Exception as e:
        return {"symbol": symbol, "name": name, "region": region, "error": str(e), "price": 0, "change_pct": 0, "trend": "flat", "sparkline": []}

def fetch_all_market_data():
    tickers = [
        {"symbol": "GC=F", "name": "现货黄金", "region": "USD"},
        {"symbol": "DX-Y.NYB", "name": "美元指数", "region": "USD"},
        {"symbol": "^TNX", "name": "10Y美债", "region": "USD"},
        {"symbol": "000300.SS", "name": "沪深300", "region": "CNY"},
        {"symbol": "^HSI", "name": "恒生指数", "region": "HKD"},
        {"symbol": "^VIX", "name": "VIX", "region": "USD"}
    ]
    
    results = []
    for t in tickers:
        data = fetch_single_ticker(t["symbol"], t["name"], t["region"])
        if data:
            results.append(data)
        time.sleep(0.1)
    
    return results

@router.get("/")
async def get_market_pulse():
    cached = get_cached()
    if cached:
        cached["cached"] = True
        return JSONResponse(content=cached)
    
    data = fetch_all_market_data()
    result = {"items": data, "updated_at": datetime.now().isoformat()}
    
    _cache["market_data"] = result
    _cache["cache_time"] = time.time()
    
    return JSONResponse(content=result)
