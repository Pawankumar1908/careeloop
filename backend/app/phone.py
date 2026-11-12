import re


def normalize_indian_phone(value: str) -> str:
    """Accept a ten digit Indian number or an existing international number."""
    if not isinstance(value, str):
        raise ValueError("Enter a valid 10 digit mobile number")
    cleaned = re.sub(r"[\s().-]", "", value)
    if re.fullmatch(r"\d{10}", cleaned):
        return f"+91{cleaned}"
    if re.fullmatch(r"\+91\d{10}", cleaned):
        return cleaned
    if re.fullmatch(r"\+[1-9]\d{7,14}", cleaned):
        return cleaned
    raise ValueError("Enter a valid 10 digit mobile number")


def whatsapp_recipient(value: str) -> str:
    return normalize_indian_phone(value).lstrip("+")
