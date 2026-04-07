import logging
from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

import database
import whatsapp

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(
    jobstores={
        "default": MemoryJobStore()
    }
)


def fire_reminder(reminder_id: str, phone: str, text: str) -> None:
    print(f"[SCHEDULER] Firing reminder {reminder_id} for {phone}: {text[:50]}...")
    try:
        import asyncio
        asyncio.run(whatsapp.send_text_message(phone, f"⏰ Reminder: {text}"))
        
        reminders = database.get_pending_reminders(phone)
        for rem in reminders:
            if hasattr(rem, '__getitem__') and rem[0] == reminder_id and rem[4] == "none":
                database.update_reminder_status(reminder_id, "sent")
                print(f"[SCHEDULER] Updated reminder {reminder_id} status to sent")
                break
    except Exception as e:
        logger.error(f"[SCHEDULER] Error firing reminder: {e}")


def register_reminder(reminder_id: str, phone: str, text: str, 
                      trigger_time: str, recurrence: str = "none") -> None:
    print(f"[SCHEDULER] Registering reminder {reminder_id} for {phone}")
    print(f"[SCHEDULER] Trigger time: {trigger_time}, Recurrence: {recurrence}")
    
    try:
        trigger_dt = datetime.fromisoformat(trigger_time.replace("Z", "+00:00"))
        
        if recurrence == "none":
            trigger = DateTrigger(run_date=trigger_dt)
        elif recurrence == "daily":
            trigger = IntervalTrigger(days=1, start_date=trigger_dt)
        elif recurrence == "weekly":
            trigger = IntervalTrigger(weeks=1, start_date=trigger_dt)
        else:
            print(f"[SCHEDULER] Invalid recurrence: {recurrence}, using none")
            trigger = DateTrigger(run_date=trigger_dt)
        
        scheduler.add_job(
            fire_reminder,
            trigger=trigger,
            args=[reminder_id, phone, text],
            id=reminder_id,
            replace_existing=True
        )
        print(f"[SCHEDULER] Registered job {reminder_id}")
    except Exception as e:
        logger.error(f"[SCHEDULER] Error registering reminder: {e}")


def reload_pending_reminders() -> None:
    print("[SCHEDULER] Reloading pending reminders...")
    pending = database.get_all_pending_reminders()
    print(f"[SCHEDULER] Found {len(pending)} pending reminders")
    
    for reminder in pending:
        try:
            register_reminder(
                reminder[0],
                reminder[1],
                reminder[2],
                reminder[3],
                reminder[4]
            )
        except Exception as e:
            logger.error(f"[SCHEDULER] Error reloading reminder {reminder[0]}: {e}")


def start_scheduler() -> None:
    print("[SCHEDULER] Starting APScheduler...")
    
    if not scheduler.running:
        scheduler.start()
        print("[SCHEDULER] APScheduler started")
    
    reload_pending_reminders()


def shutdown_scheduler() -> None:
    print("[SCHEDULER] Shutting down APScheduler...")
    if scheduler.running:
        scheduler.shutdown()
        print("[SCHEDULER] APScheduler shutdown complete")
