import logging
from fastapi import APIRouter, Request, Response
from pydantic import BaseModel

import config
import queue_worker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class WebhookVerifyResponse(BaseModel):
    pass


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.get("/webhook")
async def verify_webhook(request: Request) -> Response:
    print("[WEBHOOK] GET /webhook called")
    
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    print(f"[WEBHOOK] mode={mode}, token={token}, challenge={challenge}")
    print(f"[WEBHOOK] Expected verify token: {config.WEBHOOK_VERIFY_TOKEN}")
    
    if mode == "subscribe" and token == config.WEBHOOK_VERIFY_TOKEN:
        print("[WEBHOOK] Webhook verified successfully")
        return Response(content=challenge, media_type="text/plain")
    else:
        print("[WEBHOOK] Webhook verification failed")
        return Response(content="Forbidden", status_code=403)


@router.post("/webhook")
async def receive_webhook(request: Request) -> Response:
    print("[WEBHOOK] POST /webhook called")
    
    body = await request.json()
    print(f"[WEBHOOK] Raw body: {body}")
    
    try:
        entry = body.get("entry", [])
        if not entry:
            print("[WEBHOOK] No entry in body")
            return Response(status_code=200)
        
        changes = entry[0].get("changes", [])
        if not changes:
            print("[WEBHOOK] No changes in entry")
            return Response(status_code=200)
        
        value = changes[0].get("value", {})
        messages = value.get("messages", [])
        
        if not messages:
            print("[WEBHOOK] No messages in webhook payload")
            return Response(status_code=200)
        
        message = messages[0]
        phone = message.get("from")
        msg_type = message.get("type")
        
        contacts = value.get("contacts", [])
        name = None
        if contacts:
            name = contacts[0].get("profile", {}).get("name")
        
        print(f"[WEBHOOK] Message from {phone}, type: {msg_type}, name: {name}")
        
        payload = {"phone": phone, "type": msg_type, "name": name}
        
        if msg_type == "text":
            payload["content"] = message.get("text", {}).get("body", "")
            print(f"[WEBHOOK] Text message: {payload['content'][:50]}...")
        
        elif msg_type == "audio":
            payload["media_id"] = message.get("audio", {}).get("id")
            print(f"[WEBHOOK] Audio message, media_id: {payload['media_id']}")
        
        await queue_worker.message_queue.put(payload)
        print("[WEBHOOK] Message pushed to queue")
        
    except Exception as e:
        logger.error(f"[WEBHOOK] Error processing webhook: {e}")
    
    return Response(status_code=200)
