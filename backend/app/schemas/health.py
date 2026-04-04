from __future__ import annotations

from pydantic import BaseModel


class HealthFactor(BaseModel):
    name: str
    impact: int


class HealthResult(BaseModel):
    score: int
    status: str  # "normal" | "warning" | "critical"
    top_factors: list[HealthFactor]
