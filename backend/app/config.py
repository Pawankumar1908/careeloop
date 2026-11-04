from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    jwt_secret: str
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cors_origins: str = "http://localhost:5173"
    whatsapp_api_version: str = "v23.0"
    whatsapp_reminder_template_name: str = "medication_reminder"
    whatsapp_template_language: str = "en_US"
    whatsapp_token_encryption_key: str = ""
    whatsapp_webhook_verify_token: str = ""
    meta_app_secret: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
