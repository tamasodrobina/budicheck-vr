import os
import json
import time
import hashlib
import secrets
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE_DIR / "data" / "config.json"
ENV_PATH = BASE_DIR / ".env"

# Load environment variables from .env if present
load_dotenv(dotenv_path=ENV_PATH)

SALT = "budicheck_vr_admin_salt_2026"

def hash_password(password: str) -> str:
    return hashlib.sha256((password + SALT).encode('utf-8')).hexdigest()

DEFAULT_PASSWORD_HASH = hash_password("admin123")

DEFAULT_CONFIG = {
    "gemini_api_key": "",
    "model_name": "gemini-3.5-flash-lite",
    "use_gemini": True,
    "enable_whisper_fallback": False,
    "whisper_fallback_model": "base",
    "admin_password_hash": DEFAULT_PASSWORD_HASH
}

TOKENS_PATH = BASE_DIR / "data" / "admin_tokens.json"
TOKEN_TTL_SECONDS = 7 * 86400  # 7 days expiration

def _load_tokens() -> dict:
    """Loads tokens as a dict of {token: timestamp}. Cleans expired tokens."""
    now = time.time()
    tokens = {}
    if TOKENS_PATH.exists():
        try:
            with open(TOKENS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    # Migration from legacy list format
                    tokens = {t: now for t in data if isinstance(t, str)}
                elif isinstance(data, dict):
                    tokens = {t: ts for t, ts in data.items() if (now - ts) < TOKEN_TTL_SECONDS}
        except Exception:
            pass
    return tokens

def _save_tokens():
    try:
        TOKENS_PATH.parent.mkdir(parents=True, exist_ok=True)
        temp_path = TOKENS_PATH.with_suffix(".tmp")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(_active_admin_tokens, f)
        os.replace(temp_path, TOKENS_PATH)
    except Exception:
        pass

_active_admin_tokens: dict = _load_tokens()

def verify_admin_password(password: str) -> bool:
    """
    Verifies admin password using constant-time comparison.
    In cloud/production environments, rejects the default 'admin123' password.
    """
    if not password:
        return False

    input_hash = hash_password(password)

    # 1. Environment variable support (highest priority, persistent on cloud like Render)
    env_pass = os.environ.get("ADMIN_PASSWORD") or os.environ.get("BUDICHECK_ADMIN_PASSWORD")
    if env_pass and env_pass.strip():
        clean_env = env_pass.strip()
        expected_hash = hash_password(clean_env)
        return secrets.compare_digest(input_hash, expected_hash)

    # 2. Config file fallback
    is_cloud = "RENDER" in os.environ or "PORT" in os.environ or os.environ.get("ENVIRONMENT") == "production"
    cfg = load_config()
    saved_hash = cfg.get("admin_password_hash", DEFAULT_PASSWORD_HASH)

    # In cloud / production, do not allow default 'admin123' password
    if is_cloud and secrets.compare_digest(saved_hash, DEFAULT_PASSWORD_HASH):
        return False

    return secrets.compare_digest(input_hash, saved_hash)

def change_admin_password(new_password: str) -> bool:
    new_hash = hash_password(new_password)
    save_config({"admin_password_hash": new_hash})
    return True

def create_admin_token() -> str:
    token = secrets.token_hex(24)
    _active_admin_tokens[token] = time.time()
    _save_tokens()
    return token

def verify_admin_token(token: str) -> bool:
    global _active_admin_tokens
    if not token:
        return False
    now = time.time()
    # Check in-memory
    ts = _active_admin_tokens.get(token)
    if ts and (now - ts) < TOKEN_TTL_SECONDS:
        return True
    elif ts:
        _active_admin_tokens.pop(token, None)
        _save_tokens()
        return False

    # Check disk
    disk_tokens = _load_tokens()
    ts = disk_tokens.get(token)
    if ts and (now - ts) < TOKEN_TTL_SECONDS:
        _active_admin_tokens[token] = ts
        return True
    return False

def revoke_admin_token(token: str):
    global _active_admin_tokens
    if token in _active_admin_tokens:
        _active_admin_tokens.pop(token, None)
        _save_tokens()

def load_config() -> dict:
    config = DEFAULT_CONFIG.copy()
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
                config.update(saved)
        except Exception:
            pass
            
    # Environment variable has priority if set
    env_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if env_key:
        config["gemini_api_key"] = env_key

    return config

def save_config(updates: dict) -> dict:
    current = load_config()
    current.update(updates)
    
    # Save to config.json
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2, ensure_ascii=False)
        
    # Also sync GEMINI_API_KEY to .env for persistence
    if "gemini_api_key" in updates and updates["gemini_api_key"]:
        key_val = updates["gemini_api_key"].strip()
        os.environ["GEMINI_API_KEY"] = key_val
        try:
            lines = []
            if ENV_PATH.exists():
                with open(ENV_PATH, "r", encoding="utf-8") as ef:
                    lines = [l for l in ef.readlines() if not l.startswith("GEMINI_API_KEY=") and not l.startswith("GOOGLE_API_KEY=")]
            lines.append(f"GEMINI_API_KEY={key_val}\n")
            with open(ENV_PATH, "w", encoding="utf-8") as ef:
                ef.writelines(lines)
        except Exception:
            pass

    return current

def get_gemini_api_key() -> str:
    cfg = load_config()
    return cfg.get("gemini_api_key", "").strip()

def has_gemini_api_key() -> bool:
    return bool(get_gemini_api_key())
