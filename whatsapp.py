import httpx
import logging
import config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def send_text_message(phone: str, text: str) -> None:
    print(f"[WA] Sending message to {phone}: {text[:50]}...")
    url = f"https://graph.facebook.com/v19.0/{config.WHATSAPP_PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {config.WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": text}
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            print(f"[WA] Message sent successfully to {phone}")
        except Exception as e:
            logger.error(f"[WA] Error sending message: {e}")
            raise


async def download_media(media_id: str) -> bytes:
    print(f"[WA] Downloading media: {media_id}")
    base_url = "https://graph.facebook.com/v19.0"
    headers = {
        "Authorization": f"Bearer {config.WHATSAPP_TOKEN}"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{base_url}/{media_id}", headers=headers)
            response.raise_for_status()
            media_url = response.json().get("url")
            print(f"[WA] Got media URL: {media_url}")
            
            if not media_url:
                raise ValueError("No media URL in response")
            
            download_response = await client.get(media_url, headers=headers)
            download_response.raise_for_status()
            print(f"[WA] Media downloaded successfully, size: {len(download_response.content)} bytes")
            return download_response.content
        except Exception as e:
            logger.error(f"[WA] Error downloading media: {e}")
            raise
