from datetime import datetime
from typing import Any

from pydantic import BaseModel


class BusinessAuditLogItem(BaseModel):
    id: int
    shop_id: int
    actor_user_id: int | None = None
    actor_email: str | None = None
    action: str
    entity_type: str
    entity_id: int | None = None
    summary: str | None = None
    before_data: dict[str, Any] | None = None
    after_data: dict[str, Any] | None = None
    audit_metadata: dict[str, Any] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BusinessAuditLogResponse(BaseModel):
    items: list[BusinessAuditLogItem]
    total: int
    page: int
    page_size: int
