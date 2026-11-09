"""Request/response shapes. Keep in sync with frontend/src/lib/mock.ts."""
from typing import Literal
from pydantic import BaseModel, Field


class Kpis(BaseModel):
    total: int
    risk_avg: float
    alerts: int
    accuracy: float


class SeriesPoint(BaseModel):
    t: str
    actual: float
    predicted: float


class Slice(BaseModel):
    name: str
    value: float


class RecordRow(BaseModel):
    id: str
    name: str
    category: str
    score: int
    status: Literal["Healthy", "Watch", "Critical"]
    updated: str


class Overview(BaseModel):
    kpis: Kpis
    series: list[SeriesPoint]
    breakdown: list[Slice]
    records: list[RecordRow]


class PredictIn(BaseModel):
    temperature: float = Field(ge=-50, le=200, description="deg C")
    vibration: float = Field(ge=0, le=50, description="mm/s")
    load: float = Field(ge=0, le=100, description="percent")
    hours: float = Field(ge=0, le=100000, description="run hours")


class Factor(BaseModel):
    name: str
    impact: int


class PredictOut(BaseModel):
    score: int
    label: Literal["Low", "Medium", "High"]
    confidence: float
    factors: list[Factor]
    recommendation: str


class ColumnSummary(BaseModel):
    column: str
    mean: float | None
    min: float | None
    max: float | None
    missing: int


class AnalyzeOut(BaseModel):
    rows: int
    columns: list[str]
    summary: list[ColumnSummary]
    preview: list[dict]


class ChatMsg(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AssistantIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    history: list[ChatMsg] = []


class AssistantOut(BaseModel):
    answer: str
    source: Literal["llm", "rules"]
