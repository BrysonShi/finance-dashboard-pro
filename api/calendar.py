#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""财经日历代理 API"""
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
import time

router = APIRouter()

_cache = {"calendar_data": None, "cache_time": 0}
CACHE_TTL = 3600

def get_cached():
    now = time.time()
    if _cache["calendar_data"] and (now - _cache["cache_time"]) < CACHE_TTL:
        return _cache["calendar_data"]
    return None

def get_upcoming_events():
    today = datetime.now()
    return [
        {"date": (today + timedelta(days=2)).strftime("%Y-%m-%d"), "time": "20:00", "country": "US", "event": "美联储FOMC会议纪要", "importance": "high"},
        {"date": (today + timedelta(days=5)).strftime("%Y-%m-%d"), "time": "20:30", "country": "US", "event": "美国CPI数据", "importance": "high", "previous": "3.4%", "forecast": "3.3%"},
        {"date": (today + timedelta(days=7)).strftime("%Y-%m-%d"), "time": "20:30", "country": "US", "event": "美国PPI数据", "importance": "medium"},
        {"date": (today + timedelta(days=8)).strftime("%Y-%m-%d"), "time": "20:30", "country": "US", "event": "美国零售销售", "importance": "high"},
        {"date": (today + timedelta(days=3)).strftime("%Y-%m-%d"), "time": "09:30", "country": "CN", "event": "中国LPR利率公布", "importance": "high"},
        {"date": (today + timedelta(days=12)).strftime("%Y-%m-%d"), "time": "10:00", "country": "CN", "event": "中国GDP数据", "importance": "high"},
        {"date": (today + timedelta(days=13)).strftime("%Y-%m-%d"), "time": "09:30", "country": "CN", "event": "中国CPI/PPI数据", "importance": "high"},
        {"date": (today + timedelta(days=4)).strftime("%Y-%m-%d"), "time": "17:00", "country": "EU", "event": "欧元区CPI终值", "importance": "medium"},
        {"date": (today + timedelta(days=6)).strftime("%Y-%m-%d"), "time": "20:00", "country": "EU", "event": "欧央行利率决议", "importance": "high"},
        {"date": (today + timedelta(days=1)).strftime("%Y-%m-%d"), "time": "不定时", "country": "JP", "event": "日本央行会议纪要", "importance": "medium"},
    ]

def get_holidays():
    return [
        {"date": "2026-06-02", "markets": ["美国", "英国"], "event": "英国春季银行假日"},
        {"date": "2026-06-10", "markets": ["中国", "香港"], "event": "端午节"},
        {"date": "2026-07-04", "markets": ["美国"], "event": "美国独立日"},
    ]

@router.get("/")
async def get_calendar():
    cached = get_cached()
    if cached:
        cached["cached"] = True
        return JSONResponse(content=cached)
    
    result = {"events": get_upcoming_events(), "holidays": get_holidays(), "updated_at": datetime.now().isoformat()}
    
    _cache["calendar_data"] = result
    _cache["cache_time"] = time.time()
    
    return JSONResponse(content=result)
