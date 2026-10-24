"""
Configuration module for WaseNet Backend
Implements NFR-S1, NFR-S3, FR-1.1, FR-1.3, FR-4.1
"""
from typing import List, Union
from pydantic import Field, field_validator, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "WaseNet Public Document Authentication API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database connection string (PostgreSQL 15+ in production, SQLite supported for isolated unit tests)
    DATABASE_URL: str = Field(
        default="postgresql://wasenet_user:wasenet_pass@localhost:5432/wasenet_db",
        validation_alias=AliasChoices("DATABASE_URL", "POSTGRES_URL"),
        description="Database URL for SQLAlchemy 2.x"
    )

    # JWT Session Configuration (FR-1.3: absolute 8-hour expiry, never hardcoded in production)
    JWT_SECRET: str = Field(
        default="wasenet-secure-random-jwt-secret-key-replace-in-production-2026",
        description="HMAC SHA-256 secret key for signing session tokens"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_HOURS: int = 8
    JWT_ISSUER: str = "wasenet-authority"
    JWT_AUDIENCE: str = "wasenet-client"

    # Application-level Encryption (AES-256-GCM for holder national ID & contact details, SRS Section 4.1)
    # Must be 32 bytes (64 hex characters or 44 base64 characters)
    AES_GCM_SECRET_KEY: str = Field(
        default="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        description="Hex or base64 encoded 256-bit key for AES-256-GCM envelope encryption"
    )

    # Server-Side Document Signer (ES256 ECDSA NIST P-256 / secp256r1, FR-2.1 to FR-2.4)
    # Encapsulated behind DocumentSigner interface so it can migrate to client-side or INSA HSM in the future.
    ACTIVE_KID: str = "wase-aa-2026-01"
    SERVER_ES256_PRIVATE_KEY_PEM: str = Field(
        default="",
        description="Optional PEM-encoded EC private key. If empty, a key will be generated or loaded from storage."
    )

    # Argon2id password hashing parameters (FR-1.1)
    ARGON2_TIME_COST: int = 2
    ARGON2_MEMORY_COST: int = 65536  # 64 MiB
    ARGON2_PARALLELISM: int = 2
    ARGON2_HASH_LEN: int = 32
    ARGON2_SALT_LEN: int = 16

    # CORS Configuration
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:8080"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    # Rate Limiting Parameters (per minute)
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 10
    RATE_LIMIT_FRAUD_PER_MINUTE: int = 10
    RATE_LIMIT_AUDIT_BATCH_PER_MINUTE: int = 60

    # Data Retention Settings (SRS Section 4.1: Default 365 days)
    RETENTION_DAYS_AUDIT: int = 365
    RETENTION_DAYS_FRAUD: int = 365

    # Bootstrap initial administrator credentials for seed script (FR-1.1)
    BOOTSTRAP_ADMIN_USERNAME: str = "admin"
    BOOTSTRAP_ADMIN_PASSWORD: str = "Admin@WaseNet2026!"
    BOOTSTRAP_ADMIN_FULL_NAME: str = "Federal Authority Administrator"
    BOOTSTRAP_ADMIN_ORG: str = "National Document Authentication Directorate"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
