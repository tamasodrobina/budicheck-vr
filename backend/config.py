import os
import json
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

def _load_tokens() -> set:
    if TOKENS_PATH.exists():
        try:
            with open(TOKENS_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return set(data) if isinstance(data, list) else set()
        except Exception:
            pass
    return set()

def _save_tokens():
    try:
        TOKENS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKENS_PATH, "w", encoding="utf-8") as f:
            json.dump(list(_active_admin_tokens), f)
    except Exception:
        pass

_active_admin_tokens = _load_tokens()

def verify_admin_password(password: str) -> bool:
    # 1. Environment variable support (highest priority, persistent on cloud like Render)
    env_pass = os.environ.get("ADMIN_PASSWORD") or os.environ.get("BUDICHECK_ADMIN_PASSWORD")
    if env_pass and env_pass.strip():
        clean_env = env_pass.strip()
        if password == clean_env or hash_password(password) == hash_password(clean_env):
            return True

    # 2. Config file fallback
    cfg = load_config()
    saved_hash = cfg.get("admin_password_hash", DEFAULT_PASSWORD_HASH)
    return hash_password(password) == saved_hash

def change_admin_password(new_password: str) -> bool:
    new_hash = hash_password(new_password)
    save_config({"admin_password_hash": new_hash})
    return True

def create_admin_token() -> str:
    token = secrets.token_hex(24)
    _active_admin_tokens.add(token)
    _save_tokens()
    return token

def verify_admin_token(token: str) -> bool:
    if not token:
        return False
    return token in _active_admin_tokens

def revoke_admin_token(token: str):
    if token in _active_admin_tokens:
        _active_admin_tokens.remove(token)
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
