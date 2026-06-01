#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Finance Dashboard Pro - 本地开发服务器
使用 FastAPI 提供数据代理服务
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

app = FastAPI(title="AI Finance Dashboard Pro API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.gold import router as gold_router
from api.macro import router as macro_router
from api.market import router as market_router
from api.calendar import router as calendar_router

app.include_router(gold_router, prefix="/api/gold", tags=["黄金"])
app.include_router(macro_router, prefix="/api/macro", tags=["宏观"])
app.include_router(market_router, prefix="/api/market", tags=["市场"])
app.include_router(calendar_router, prefix="/api/calendar", tags=["日历"])

@app.get("/")
async def root():
    return {"message": "AI Finance Dashboard Pro API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    print("=" * 50)
    print("AI Finance Dashboard Pro - 本地服务器")
    print("前端访问: http://localhost:8000/public/index.html")
    print("API文档:  http://localhost:8000/docs")
    print("=" * 50)
    uvicorn.run(app, host="0.0.0.0", port=8000)
