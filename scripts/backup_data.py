#!/usr/bin/env python3
"""
data/ 目录备份工具。
每次小龙猫（或下一个 AI）要修改任何 data/*.json 之前，先调一次：

    python3 scripts/backup_data.py "改动说明"

会把当前 data/ 整体打包到 data/_backups/<UTC时间戳>/ 并写一份 manifest.txt 记录改动说明。
保留最近 N=20 份，超过自动删除最老的。

设计原则：
- 不依赖 git（数据本身被 .gitignore 排除）
- 只做本地快照，不上传任何地方
- 失败要 fail loud，不要悄悄继续
"""
from __future__ import annotations

import os
import shutil
import sys
import datetime as dt
from pathlib import Path

KEEP_LAST_N = 20

# 脚本永远以 asset_dashboard/ 为基准定位
SCRIPT_DIR = Path(__file__).resolve().parent
BASE = SCRIPT_DIR.parent  # asset_dashboard/
DATA = BASE / "data"
BACKUPS = DATA / "_backups"


def main(reason: str = "(no-reason)") -> int:
    if not DATA.is_dir():
        print(f"[backup_data] data/ 不存在: {DATA}", file=sys.stderr)
        return 1

    BACKUPS.mkdir(parents=True, exist_ok=True)

    ts = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S")
    dest = BACKUPS / ts
    if dest.exists():
        # 极端撞名，加微秒
        ts = dt.datetime.now().strftime("%Y-%m-%d-%H%M%S-%f")
        dest = BACKUPS / ts

    dest.mkdir(parents=True)

    # 复制 data/ 下所有文件，但跳过 _backups/ 自身
    copied = 0
    for src in DATA.iterdir():
        if src.name == "_backups":
            continue
        target = dest / src.name
        if src.is_dir():
            shutil.copytree(src, target)
        else:
            shutil.copy2(src, target)
        copied += 1

    manifest = dest / "manifest.txt"
    manifest.write_text(
        f"timestamp_local: {ts}\n"
        f"timestamp_utc:   {dt.datetime.now(dt.timezone.utc).isoformat()}\n"
        f"reason:          {reason}\n"
        f"copied_top_level: {copied}\n",
        encoding="utf-8",
    )

    # 修剪：仅保留最近 N 份
    snapshots = sorted([p for p in BACKUPS.iterdir() if p.is_dir()], key=lambda p: p.name)
    while len(snapshots) > KEEP_LAST_N:
        old = snapshots.pop(0)
        shutil.rmtree(old, ignore_errors=True)
        print(f"[backup_data] 清理旧备份 {old.name}")

    print(f"[backup_data] OK → {dest.relative_to(BASE)} (reason: {reason})")
    return 0


if __name__ == "__main__":
    reason = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "(no-reason)"
    raise SystemExit(main(reason))
