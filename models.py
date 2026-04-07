from pydantic import BaseModel


class IntentResult(BaseModel):
    intent: str
    reminder_text: str | None = None
    trigger_datetime_iso: str | None = None
    recurrence: str | None = None
    reply_to_user: str
