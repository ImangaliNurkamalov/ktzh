from pydantic import BaseModel


class AlertResponse(BaseModel):
    alert_id: str
    level: str
    message: str
    value: float | str | None = None
