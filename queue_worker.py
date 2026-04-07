import asyncio
import base64
import logging
from uuid import uuid4

import database
import gemini
import scheduler
import whatsapp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

message_queue: asyncio.Queue = asyncio.Queue()


async def process_message(payload: dict) -> None:
    print(f"[WORKER] Processing message: {payload}")
    
    phone = payload.get("phone")
    msg_type = payload.get("type")
    
    if not phone:
        print("[WORKER] No phone found in payload")
        return
    
    name = payload.get("name")
    database.upsert_user(phone, name=name)
    
    intent = None
    
    if msg_type == "audio":
        media_id = payload.get("media_id")
        if not media_id:
            print("[WORKER] No media_id found for audio message")
            return
        
        audio_bytes = await whatsapp.download_media(media_id)
        audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
        intent = await gemini.transcribe_and_parse(audio_b64, phone)
        
        content = f"[Audio transcription processed]"
    else:
        content = payload.get("content", "")
        intent = await gemini.parse_intent(content, phone)
    
    database.insert_message(phone, "user", content)
    database.insert_message(phone, "assistant", intent.reply_to_user)
    
    await whatsapp.send_text_message(phone, intent.reply_to_user)
    
    if intent.intent == "set_reminder":
        reminder_id = str(uuid4())
        database.insert_reminder(
            reminder_id,
            phone,
            intent.reminder_text,
            intent.trigger_datetime_iso,
            intent.recurrence or "none",
            "pending"
        )
        scheduler.register_reminder(
            reminder_id,
            phone,
            intent.reminder_text,
            intent.trigger_datetime_iso,
            intent.recurrence or "none"
        )
    
    if intent.intent == "list_reminders":
        pending = database.get_pending_reminders(phone)
        if pending:
            reminder_list = "\n".join(
                f"{i+1}. {rem['text']} (due: {rem['trigger_time']})"
                for i, rem in enumerate(pending)
            )
            reply = f"Your pending reminders:\n{reminder_list}"
        else:
            reply = "You have no pending reminders."
        await whatsapp.send_text_message(phone, reply)
    
    await asyncio.sleep(4)
    print("[WORKER] Message processing complete")


async def queue_worker() -> None:
    print("[WORKER] Queue worker started")
    while True:
        try:
            payload = await message_queue.get()
            print(f"[WORKER] Got message from queue: {payload}")
            await process_message(payload)
        except Exception as e:
            logger.error(f"[WORKER] Error processing message: {e}")
            await asyncio.sleep(1)
