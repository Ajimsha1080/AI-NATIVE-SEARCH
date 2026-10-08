import os

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DISALLOWED_WEAK_SECRETS = {
    "super_secret_jwt_key_enterprise_grade_aaas_platform_2026",
    "super_secret_jwt_key_change_in_production",
    "secret",
    "changeme",
    "password",
    "test",
    "admin",
    "12345678901234567890123456789012"
}

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Core Environment
    APP_ENV: str = Field(default="development")
    NODE_ENV: str = Field(default="development")
    PORT: int = Field(default=8000)

    # Database
    DATABASE_URL: str | None = Field(default=None)
    REDIS_URL: str | None = Field(default="redis://localhost:6379/0")

    # Security Keys
    JWT_SECRET: str = Field(default="development_only_jwt_secret_32bytes_long!")
    SERVICE_JWT_SECRET: str = Field(default="development_only_service_secret_32bytes_long!")
    INTERNAL_SERVICE_SECRET: str | None = Field(default=None)
    ENCRYPTION_KEY: str = Field(default="development_only_enc_secret_32bytes_long!")

    # LLM Configuration
    LLM_PROVIDER: str = Field(default="sarvam")
    LLM_MODEL: str = Field(default="sarvam-105b-conversations")
    SARVAM_API_KEY: str | None = Field(default="")
    OPENAI_API_KEY: str | None = Field(default="")
    ANTHROPIC_API_KEY: str | None = Field(default="")
    OLLAMA_BASE_URL: str = Field(default="http://localhost:11434")

    # Payment Gateways (Razorpay)
    RAZORPAY_KEY_ID: str | None = Field(default="")
    RAZORPAY_KEY_SECRET: str | None = Field(default="")
    RAZORPAY_ME_URL: str = Field(default="https://razorpay.me/@ajimshamuhammad2112")
    RAZORPAY_WEBHOOK_SECRET: str | None = Field(default="")

    # Email Provider (SMTP / Resend)
    SMTP_HOST: str | None = Field(default=None)
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str | None = Field(default=None)
    SMTP_PASSWORD: str | None = Field(default=None)
    SMTP_FROM_EMAIL: str = Field(default="noreply@shopmate.ai")
    SMTP_USE_TLS: bool = Field(default=True)
    RESEND_API_KEY: str | None = Field(default=None)
    FRONTEND_URL: str = Field(default="http://localhost:3000")

    # CORS
    ALLOWED_ORIGINS: list[str] = Field(default_factory=lambda: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://bluetyga.com"
    ])

    @field_validator("JWT_SECRET", "SERVICE_JWT_SECRET", "ENCRYPTION_KEY", mode="after")
    @classmethod
    def validate_secret_strength(cls, v: str, info) -> str:
        clean = v.strip()
        field_name = info.field_name

        # Check known weak defaults
        if clean.lower() in DISALLOWED_WEAK_SECRETS:
            raise ValueError(f"Security Error: {field_name} is using a known insecure default password.")

        # In production environments, require at least 32 characters and reject dev fallbacks
        is_dev = os.getenv("APP_ENV", "development").lower() == "development"
        if not is_dev:
            if clean.startswith("development_only_"):
                raise ValueError(f"Production Error: {field_name} cannot use development placeholder in production.")
            if len(clean) < 32:
                raise ValueError(f"Security Error: {field_name} must be at least 32 characters long.")

        return clean

settings = AppSettings()
