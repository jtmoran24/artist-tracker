import requests

import config


def send_email(subject: str, body: str) -> tuple[bool, str | None]:
    if not config.RESEND_API_KEY or not config.ALERT_TO_EMAIL:
        return False, "email not configured (RESEND_API_KEY / ALERT_TO_EMAIL missing)"

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {config.RESEND_API_KEY}"},
            json={
                "from": config.ALERT_FROM_EMAIL,
                "to": [config.ALERT_TO_EMAIL],
                "subject": subject,
                "text": body,
            },
            timeout=15,
        )
        response.raise_for_status()
        return True, None
    except requests.RequestException as exc:
        return False, str(exc)
