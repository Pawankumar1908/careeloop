from cryptography.fernet import Fernet, InvalidToken
import httpx
import re

from app.config import settings


class WhatsAppAPIError(Exception):
    pass


def _meta_error_message(response: httpx.Response, fallback: str) -> str:
    try:
        data = response.json()
    except ValueError:
        return fallback
    error = data.get("error", {}) if isinstance(data, dict) else {}
    if not isinstance(error, dict):
        return fallback
    code = error.get("code")
    message = error.get("message") or fallback
    if code == 131031 or str(code) == "131031":
        return "WhatsApp Business Account is locked by Meta (error 131031). Check Meta Business Support Home for the restriction and request a review if available."
    if code is not None:
        return f"{message} (Meta error {code})"
    return message


def _cipher() -> Fernet:
    if not settings.whatsapp_token_encryption_key:
        raise RuntimeError("Set WHATSAPP_TOKEN_ENCRYPTION_KEY before connecting a WhatsApp account")
    try:
        return Fernet(settings.whatsapp_token_encryption_key.encode("ascii"))
    except (ValueError, UnicodeEncodeError) as exc:
        raise RuntimeError("WHATSAPP_TOKEN_ENCRYPTION_KEY is invalid") from exc


def encrypt_access_token(token: str) -> str:
    return _cipher().encrypt(token.encode("utf-8")).decode("ascii")


def decrypt_access_token(token: str) -> str:
    try:
        return _cipher().decrypt(token.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeEncodeError) as exc:
        raise RuntimeError("Stored WhatsApp token cannot be decrypted; check the encryption key") from exc


def _graph_url(path: str) -> str:
    version = settings.whatsapp_api_version.strip()
    if not version.startswith("v"):
        version = f"v{version}"
    if not re.fullmatch(r"v\d+\.\d+", version):
        raise RuntimeError("WHATSAPP_API_VERSION must look like vNN.0")
    return f"https://graph.facebook.com/{version}/{path}"


async def get_phone_details(phone_number_id: str, token: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.get(
                _graph_url(phone_number_id),
                params={"fields": "display_phone_number,verified_name"},
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as exc:
        raise WhatsAppAPIError("Could not reach Meta. Check the backend network and try again.") from exc
    if response.is_error:
        raise WhatsAppAPIError(_meta_error_message(response, "Meta could not verify this phone number ID and access token."))
    try:
        data = response.json()
    except ValueError as exc:
        raise WhatsAppAPIError("Meta returned an invalid response while checking the phone number.") from exc
    if not isinstance(data, dict):
        raise WhatsAppAPIError("Meta returned an unexpected response while checking the phone number.")
    return data


async def send_test_template(phone_number_id: str, token: str, recipient: str) -> dict:
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {"name": "hello_world", "language": {"code": "en_US"}},
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                _graph_url(f"{phone_number_id}/messages"),
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as exc:
        raise WhatsAppAPIError("Could not reach Meta. Check the backend network and try again.") from exc
    if response.is_error:
        raise WhatsAppAPIError(_meta_error_message(response, "Meta rejected the test message."))
    try:
        data = response.json()
    except ValueError as exc:
        raise WhatsAppAPIError("Meta returned an invalid response for the test message.") from exc
    if not isinstance(data, dict):
        raise WhatsAppAPIError("Meta returned an unexpected response for the test message.")
    return data


async def send_medication_reminder(
    phone_number_id: str,
    token: str,
    recipient: str,
    patient_name: str,
    medicine_name: str,
    time_label: str,
    reminder_id: str,
) -> dict:
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": settings.whatsapp_reminder_template_name,
            "language": {"code": settings.whatsapp_template_language},
            "components": [
                {"type": "body", "parameters": [
                    {"type": "text", "text": patient_name},
                    {"type": "text", "text": medicine_name},
                    {"type": "text", "text": time_label},
                ]},
                {"type": "button", "sub_type": "quick_reply", "index": "0", "parameters": [
                    {"type": "payload", "payload": f"taken:{reminder_id}"},
                ]},
                {"type": "button", "sub_type": "quick_reply", "index": "1", "parameters": [
                    {"type": "payload", "payload": f"not_taken:{reminder_id}"},
                ]},
            ],
        },
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                _graph_url(f"{phone_number_id}/messages"),
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as exc:
        raise WhatsAppAPIError("Could not reach Meta. Check the backend network and try again.") from exc
    if response.is_error:
        raise WhatsAppAPIError(_meta_error_message(response, "Meta rejected the medication reminder template."))
    try:
        data = response.json()
    except ValueError as exc:
        raise WhatsAppAPIError("Meta returned an invalid response for the medication reminder.") from exc
    if not isinstance(data, dict):
        raise WhatsAppAPIError("Meta returned an unexpected response for the medication reminder.")
    return data


async def send_appointment_reminder(
    phone_number_id: str,
    token: str,
    recipient: str,
    patient_name: str,
    appointment_title: str,
    appointment_time: str,
) -> dict:
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient,
        "type": "template",
        "template": {
            "name": settings.whatsapp_appointment_template_name,
            "language": {"code": settings.whatsapp_template_language},
            "components": [{"type": "body", "parameters": [
                {"type": "text", "text": patient_name},
                {"type": "text", "text": appointment_title},
                {"type": "text", "text": appointment_time},
            ]}],
        },
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                _graph_url(f"{phone_number_id}/messages"),
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError as exc:
        raise WhatsAppAPIError("Could not reach Meta while sending the appointment reminder.") from exc
    if response.is_error:
        raise WhatsAppAPIError(_meta_error_message(response, "Meta rejected the appointment reminder template."))
    try:
        data = response.json()
    except ValueError as exc:
        raise WhatsAppAPIError("Meta returned an invalid response for the appointment reminder.") from exc
    if not isinstance(data, dict):
        raise WhatsAppAPIError("Meta returned an unexpected response for the appointment reminder.")
    return data
