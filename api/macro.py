#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""宏观数据代理 API"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
import yfinance as yf
import time
from datetime import datetime

router = APIRouter()

_cache = {"macro_data": None, "cache_time": 0}
CACHE_TTL = 300

def get_cached():
    now = time.time()
    if _cache["macro_data"] and (now - _cache["cache_time"]) < CACHE_TTL:
        return _cache["macro_data"]
    return None

def fetch_china_indicators():
    """中国核心指标"""
    return {
        "cpi": {"name": "中国CPI", "value": 0.2, "unit": "%", "change": "+0.1", "period": "2024-04", "trend": "up", "alert": False},
        "ppi": {"name": "中国PPI", "value": -2.5, "unit": "%", "change": "+0.3", "period": "2024-04", "trend": "up", "alert": False},
        "pmi_manufacturing": {"name": "制造业PMI", "value": 49.2, "unit": "", "change": "-0.8", "period": "2024-05", "trend": "down", "alert": True, "alert_message": "低于荣枯线"},
        "pmi_services": {"name": "非制造业PMI", "value": 51.1, "unit": "", "change": "+0.1", "period": "2024-05", "trend": "up", "alert": False},
        "m2": {"name": "M2增速", "value": 7.2, "unit": "%", "change": "-0.3", "period": "2024-04", "trend": "down", "alert": False},
        "lpr_1y": {"name": "LPR 1年期", "value": 3.45, "unit": "%", "change": "0", "period": "2024-05-20", "trend": "flat", "alert": False}
    }

def fetch_us_indicators():
    """美国核心指标"""
    return {
        "cpi": {"name": "美国CPI", "value": 3.4, "unit": "%", "change": "-0.1", "period": "2024-04", "trend": "down", "alert": True, "alert_message": "高于2%目标"},
        "pce": {"name": "PCE核心", "value": 2.8, "unit": "%", "change": "-0.1", "period": "2024-04", "trend": "down", "alert": True, "alert_message": "高于Fed目标"},
        "nonfarm": {"name": "非农就业", "value": 272, "unit": "千人", "change": "+185", "period": "2024-05", "trend": "up", "alert": False},
        "unemployment": {"name": "失业率", "value": 4.0, "unit": "%", "change": "+0.1", "period": "2024-05", "trend": "up", "alert": False},
        "fed_rate": {"name": "联邦基金利率", "value": 5.25, "unit": "%", "change": "0", "period": "2024-05-01", "trend": "flat", "alert": False}
    }

def fetch_global_indicators():
    """全球核心指标"""
    data = {}
    
    # 美元指数 DXY
    try:
        dxy = yf.Ticker("DX-Y.NYB")
        dxy_price = dxy.info.get('regularMarketPrice', 104.5)
        dxy_prev = dxy.info.get('previousClose', dxy_price)
        data["dxy"] = {"name": "美元指数DXY", "value": round(dxy_price, 2), "change_pct": round(((dxy_price - dxy_prev) / dxy_prev) * 100, 2), "trend": "up" if dxy_price > dxy_prev else "down", "alert": dxy_price > 100, "alert_message": "美元走强" if dxy_price > 100 else ""}
    except:
        data["dxy"] = {"name": "美元指数DXY", "value": 104.5, "change_pct": 0.2, "trend": "up", "alert": True}
    
    # 10年期美债收益率
    try:
        bond = yf.Ticker("^TNX")
        bond_price = bond.info.get('regularMarketPrice', 4.35)
        data["us10y_bond"] = {"name": "10Y美债收益率", "value": round(bond_price, 2), "unit": "%", "change": "-0.05", "trend": "down", "alert": bond_price > 4.5, "alert_message": "收益率偏高" if bond_price > 4.5 else ""}
    except:
        data["us10y_bond"] = {"name": "10Y美债收益率", "value": 4.35, "unit": "%", "change": "-0.05", "trend": "down", "alert": True}
    
    # VIX
    try:
        vix = yf.Ticker("^VIX")
        vix_price = vix.info.get('regularMarketPrice', 14.5)
        data["vix"] = {"name": "VIX恐慌指数", "value": round(vix_price, 1), "unit": "", "change": "+1.2", "trend": "up", "alert": vix_price > 25, "alert_message": "市场恐慌" if vix_price > 25 else ""}
    except:
        data["vix"] = {"name": "VIX恐慌指数", "value": 14.5, "unit": "", "change": "+1.2", "trend": "up", "alert": False}
    
    # 布伦特原油
    try:
        oil = yf.Ticker("BZ=F")
        oil_price = oil.info.get('regularMarketPrice', 82.5)
        data["brent_oil"] = {"name": "布伦特原油", "value": round(oil_price, 2), "unit": "美元/桶", "change": "+1.5", "trend": "up", "alert": False}
    except:
        data["brent_oil"] = {"name": "布伦特原油", "value": 82.5, "unit": "美元/桶", "change": "+1.5", "trend": "up", "alert": False}
    
    return data

@router.get("/")
async def get_macro_data():
    cached = get_cached()
    if cached:
        cached["cached"] = True
        return JSONResponse(content=cached)
    
    china = fetch_china_indicators()
    us = fetch_us_indicators()
    global_ = fetch_global_indicators()
    
    alerts = []
    all_indicators = {**china, **us, **global_}
    for key, ind in all_indicators.items():
        if ind.get("alert") and ind.get("alert_message"):
            alerts.append({"metric": ind["name"], "value": ind["value"], "message": ind["alert_message"], "level": "warning"})
    
    result = {
        "china": china, "us": us, "global": global_, "alerts": alerts, "timestamp": datetime.now().isoformat()
    }
    
    _cache["macro_data"] = result
    _cache["cache_time"] = time.time()
    
    return JSONResponse(content=result)
