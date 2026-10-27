import os


class ConfigError(RuntimeError):
    pass


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise ConfigError(f"missing required environment variable: {name}")
    return value


SUPABASE_URL = require_env("SUPABASE_URL")
SUPABASE_SERVICE_KEY = require_env("SUPABASE_SERVICE_KEY")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
ALERT_FROM_EMAIL = os.environ.get("ALERT_FROM_EMAIL", "alerts@example.com")
ALERT_TO_EMAIL = os.environ.get("ALERT_TO_EMAIL")
TICKETMASTER_API_KEY = os.environ.get("TICKETMASTER_API_KEY")
