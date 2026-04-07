import base64
import logging
from datetime import datetime, timezone

from google import genai
from tenacity import retry, retry_if_exception_type, wait_exponential, stop_after_attempt

import config
import database
from models import IntentResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

client = genai.Client(api_key=config.GEMINI_API_KEY)


def build_system_prompt(user_phone: str, timezone: str = "Asia/Kolkata") -> str:
    now = datetime.now(timezone.utc).isoformat()
    last_messages = database.get_last_messages(user_phone, limit=5)
    
    history_str = ""
    if last_messages:
        history_lines = []
        for msg in last_messages:
            role = msg["role"]
            content = msg["content"][:100]
            history_lines.append(f"{role}: {content}")
        history_str = "\n".join(history_lines)
    else:
        history_str = "No previous messages"
    
    prompt = f"""You are a WhatsApp reminder assistant. The current UTC time is {now}. 
The user's timezone is {timezone}. 
Parse the user's message and extract intent. 
For reminders, always convert the time to UTC ISO 8601.
Always populate reply_to_user with a friendly confirmation or response.
Recent conversation history: {history_str}"""
    
    print(f"[GEMINI] System prompt built. Last {len(last_messages)} messages")
    return prompt


@retry(
    retry=retry_if_exception_type(Exception),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(3)
)
async def parse_intent(text_content: str, user_phone: str) -> IntentResult:
    print(f"[GEMINI] Parsing intent for user {user_phone}: {text_content[:50]}...")
    
    user = database.get_user(user_phone)
    user_timezone = user.get("timezone", "Asia/Kolkata") if user else "Asia/Kolkata"
    
    system_prompt = build_system_prompt(user_phone, user_timezone)
    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            {"role": "user", "parts": [{"text": text_content}]}
        ],
        config={
            "system_instruction": {"text": system_prompt},
            "response_mime_type": "application/json",
            "response_schema": IntentResult
        }
    )
    
    print(f"[GEMINI] Raw response: {response.text[:200]}")
    intent_result = IntentResult.model_validate_json(response.text)
    print(f"[GEMINI] Parsed intent: {intent_result.intent}")
    return intent_result


@retry(
    retry=retry_if_exception_type(Exception),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    stop=stop_after_attempt(3)
)
async def transcribe_and_parse(audio_base64: str, user_phone: str) -> IntentResult:
    print(f"[GEMINI] Transcribing and parsing audio for user {user_phone}")
    
    user = database.get_user(user_phone)
    user_timezone = user.get("timezone", "Asia/Kolkata") if user else "Asia/Kolkata"
    
    system_prompt = build_system_prompt(user_phone, user_timezone)
    
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            {"role": "user", "parts": [{"text": "Transcribe this audio and extract intent. Parse the message and extract intent. For reminders, always convert the time to UTC ISO 8601. Always populate reply_to_user with a friendly confirmation or response."}, {"inline_data": {"mime_type": "audio/ogg", "data": audio_base64}}]}
        ],
        config={
            "system_instruction": {"text": system_prompt},
            "response_mime_type": "application/json",
            "response_schema": IntentResult
        }
    )
    
    print(f"[GEMINI] Raw response from transcription: {response.text[:200]}")
    intent_result = IntentResult.model_validate_json(response.text)
    print(f"[GEMINI] Parsed intent from audio: {intent_result.intent}")
    return intent_result
