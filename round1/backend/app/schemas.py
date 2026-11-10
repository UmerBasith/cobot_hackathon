"""Request/response shapes. Keep in sync with frontend/src/lib/mock.ts and BRIEF.md §5."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["fire", "road_accident", "medical", "flood", "building_collapse", "gas_leak", "electrical", "other"]
Severity = Literal["Low", "Medium", "High", "Critical"]
Status = Literal["Reported", "Pending", "In Progress", "Resolved"]
Injuries = Literal["none", "minor", "serious"]
Hazard = Literal["small", "medium", "large", "spreading"]
Vulnerable = Literal["children", "elderly", "patients", "disabled", "pregnant"]


class ReportBase(BaseModel):
    category: Category
    area: str = Field(min_length=1, max_length=80)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    landmark: str = Field(default="", max_length=200)
    people_affected: int = Field(default=0, ge=0, le=100000)
    injured_count: int = Field(default=0, ge=0, le=100000)
    injuries: Injuries = "none"
    life_threat: bool = False
    hazard: Hazard = "small"
    active: bool = True
    vulnerable: list[Vulnerable] = []
    contact_name: str = Field(default="", max_length=100)
    contact_phone: str = Field(default="", max_length=20)


class PreviewIn(ReportBase):
    title: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=2000)


class ReportIn(ReportBase):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(min_length=10, max_length=2000)


class Reason(BaseModel):
    label: str
    points: int
    rule: str | None = None


class SeverityOut(BaseModel):
    score: int
    severity: Severity
    reasons: list[Reason]
    place_type: str | None
    place_name: str | None
    flags: list[str]


class TimelineEntry(BaseModel):
    at: str
    status: Status
    note: str
    actor: str


class Incident(ReportIn, SeverityOut):
    id: str
    status: Status
    duplicate_of: str | None = None
    created_at: str
    updated_at: str
    timeline: list[TimelineEntry]


class StatusIn(BaseModel):
    status: Status
    note: str = Field(default="", max_length=500)


class DuplicateIn(BaseModel):
    duplicate_of: str = Field(min_length=1, max_length=20)


class CountRow(BaseModel):
    count: int


class CategoryCount(CountRow):
    category: Category
    label: str


class SeverityCount(CountRow):
    severity: Severity


class AreaCount(CountRow):
    area: str


class Stats(BaseModel):
    total: int
    critical: int
    pending: int
    in_progress: int
    resolved: int
    by_category: list[CategoryCount]
    by_severity: list[SeverityCount]
    by_area: list[AreaCount]
