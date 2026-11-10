"""Request/response shapes. Keep in sync with frontend/src/lib/mock.ts and BRIEF.md §5."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Category = Literal["fire", "road_accident", "medical", "flood", "building_collapse", "gas_leak", "electrical", "landslide", "other"]
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
    reported_severity: Literal["Low", "Medium", "High", "Critical"] | None = None  # citizen's own judgement (info only)
    anonymous: bool = False
    photo: str | None = Field(default=None, max_length=3_000_000)  # data URL, optional evidence


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


class Team(BaseModel):
    id: str
    name: str
    type: Literal["fire", "ambulance_als", "ambulance_bls", "police", "ndrf", "boat"]
    type_label: str
    station: str
    lat: float
    lng: float
    status: Literal["available", "busy", "offline"]
    current_incident: str | None = None


AssignmentStatus = Literal["assigned", "accepted", "rejected", "en_route", "on_scene", "completed"]


class Assignment(BaseModel):
    id: str
    team_id: str
    team_name: str
    team_type: str
    status: AssignmentStatus
    eta_min: float
    distance_km: float
    reject_reason: str = ""
    note: str = ""
    assigned_at: str
    updated_at: str


class ResponderEscalation(BaseModel):
    """Raised from the field by a responder ("Escalate" quick action). Shown to the control room until handled."""
    at: str
    team_id: str
    team_name: str
    reason: str
    needs: list[str] = []
    note: str = ""


class Incident(PreviewIn, SeverityOut):
    id: str
    status: Status
    duplicate_of: str | None = None
    witnesses: int = 0
    assignments: list[Assignment] = []
    volunteers: list[dict] = []
    escalation: ResponderEscalation | None = None
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


class Candidate(BaseModel):
    team: Team
    eta_min: float
    distance_km: float


class SuggestSlot(BaseModel):
    slot: str
    best: str | None
    candidates: list[Candidate]


class AssignIn(BaseModel):
    team_ids: list[str] = Field(min_length=1, max_length=10)


class RespondIn(BaseModel):
    accept: bool
    reason: str = Field(default="", max_length=200)


class AssignmentStatusIn(BaseModel):
    status: Literal["en_route", "on_scene", "completed"]
    note: str = Field(default="", max_length=500)


FieldTag = Literal["situation", "contained", "rescued", "need_time", "casualty"]
NeedType = Literal["fire", "rescue", "ambulance", "police", "ndrf", "boat", "hazmat", "power"]


class FieldUpdateIn(BaseModel):
    """'Update Status' quick action: a situation report from the field (no stage change)."""
    note: str = Field(min_length=3, max_length=500)
    tag: FieldTag = "situation"


class EscalateIn(BaseModel):
    """'Escalate' quick action: the team needs more help than it has."""
    reason: str = Field(min_length=3, max_length=200)
    needs: list[NeedType] = Field(default=[], max_length=8)
    note: str = Field(default="", max_length=500)


class ResponderJob(BaseModel):
    assignment: Assignment
    incident: Incident


class Escalation(BaseModel):
    level: Literal["critical", "warning"]
    incident_id: str | None
    message: str


class Similar(BaseModel):
    id: str
    title: str
    severity: Severity
    status: Status
    distance_m: int
    minutes_apart: int


class AlertIn(BaseModel):
    area: str = Field(min_length=1, max_length=80)  # area name or "All Chennai"
    message: str = Field(min_length=5, max_length=300)
    level: Literal["info", "warning", "danger"] = "warning"
    hours: float = Field(default=6, gt=0, le=72)


class Alert(AlertIn):
    id: str
    created_at: str
    expires_at: str


class SimulateIn(BaseModel):
    scenario: Literal["chennai_flood"] = "chennai_flood"


class TrackOut(BaseModel):
    """Public view for the citizen tracking page (no contact details)."""
    id: str
    title: str
    category: Category
    area: str
    landmark: str
    severity: Severity
    score: int
    reasons: list[Reason]
    status: Status
    duplicate_of: str | None
    created_at: str
    updated_at: str
    timeline: list[TimelineEntry]
    teams: list[dict]  # [{team_name, team_type, status, eta_min}]
    lat: float | None = None
    lng: float | None = None


ZoneStatus = Literal["critical", "evacuate", "watch", "safe"]


class Zone(BaseModel):
    id: str  # area name
    area: str
    lat: float
    lng: float
    status: ZoneStatus
    note: str
    open_incidents: int
    critical_incidents: int
    updated_at: str


class ZoneIn(BaseModel):
    status: ZoneStatus
    note: str = Field(default="", max_length=200)


class Shelter(BaseModel):
    id: str
    name: str
    area: str
    lat: float
    lng: float
    capacity: int
    occupancy: int
    facilities: list[str]


class ShelterIn(BaseModel):
    occupancy: int = Field(ge=0, le=100000)


class Analytics(BaseModel):
    total: int
    open: int
    resolved: int
    resolution_rate: float          # % of incidents resolved
    avg_time_to_assign_min: float | None   # report -> first team assigned
    avg_time_to_resolve_min: float | None  # report -> resolved
    critical_avg_time_to_assign_min: float | None
    teams_total: int
    teams_busy: int
    utilisation: float              # % teams busy
    rejections: int
    by_hour: list[dict]             # [{hour:"06:00", reported, resolved}]
    by_area: list[dict]             # [{area, total, critical, open}]
    by_category: list[dict]         # [{category, label, total, avg_score}]
    by_severity: list[dict]         # [{severity, total, open}]
    by_status: list[dict]           # [{status, count}]
    team_performance: list[dict]    # [{team_id, team_name, type_label, jobs, completed, rejected, avg_eta_min}]
