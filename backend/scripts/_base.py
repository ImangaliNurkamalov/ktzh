"""
Shared helpers for locomotive telemetry simulation scripts.

Usage:
    python scenario1_te33a.py [ws://host:port/api/ws/locomotive]

Environment:
    LOCO_WS_URL  override WebSocket endpoint
                 (default: ws://localhost:8000/api/ws/locomotive)
"""

from __future__ import annotations

import asyncio
import json
import os
import random
import sys

try:
    import websockets
except ImportError:
    sys.exit("ERROR: pip install websockets")

WS_URL = os.environ.get("LOCO_WS_URL", "ws://localhost:8000/api/ws/locomotive")
TICK_SEC = 1.0


def drift(cur: float, tgt: float, noise: float, lo: float, hi: float) -> float:
    """Random walk toward *tgt* with gravitational pull, clamped to [lo, hi]."""
    delta = random.uniform(-noise, noise)
    pull = (tgt - cur) * 0.08
    return round(max(lo, min(hi, cur + delta + pull)), 2)


def approach(cur: float, tgt: float, rate: float) -> float:
    """Deterministically move *cur* toward *tgt* by at most *rate*."""
    if abs(cur - tgt) <= rate:
        return round(tgt, 2)
    return round(cur + rate, 2) if cur < tgt else round(cur - rate, 2)


def ch(value, state: int = 0) -> dict:
    """Build a ``{value, state}`` telemetry channel."""
    if isinstance(value, float):
        value = round(value, 2)
    return {"value": value, "state": state}


def health_status(idx: int) -> str:
    if idx >= 85:
        return "norm"
    if idx >= 60:
        return "warning"
    return "critical"


async def run(name: str, state, ws_url: str | None = None) -> None:
    """Connect to the locomotive WS endpoint and stream ticks until Ctrl-C."""
    if ws_url is None:
        ws_url = sys.argv[1] if len(sys.argv) > 1 else WS_URL

    print(f"\n{'=' * 64}")
    print(f"  {name}")
    print(f"  -> {ws_url}")
    print(f"{'=' * 64}\n")

    try:
        async with websockets.connect(ws_url) as ws:
            print("[connected]\n")
            t = 0
            while True:
                t += 1
                payload = state.tick(t)
                await ws.send(json.dumps(payload, ensure_ascii=False, default=str))
                print(f"  #{t:4d} | {state.log(t)}")
                await asyncio.sleep(TICK_SEC)
    except KeyboardInterrupt:
        print("\n\n[stopped by user]")
    except ConnectionRefusedError:
        print(f"\n[error] Cannot connect to {ws_url}")
        print("        Is the server running? uvicorn app.main:app --reload")
    except Exception as exc:
        print(f"\n[error] {type(exc).__name__}: {exc}")
