import time
import hashlib
import threading
from typing import Dict, List, Tuple
from fastapi import Request

SALT = "budicheck_security_salt_2026"

def get_client_ip(request: Request) -> str:
    """Extracts client IP address supporting reverse proxies (X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "127.0.0.1"

def get_voter_hash(client_ip: str) -> str:
    """
    Generates a secure, privacy-preserving hash from client IP.
    GDPR-compliant (irreversible), but uniquely identifies repeat voters.
    """
    return hashlib.sha256(f"{SALT}_{client_ip}".encode("utf-8")).hexdigest()[:16]

class InMemoryRateLimiter:
    """
    Thread-safe sliding-window rate limiter for public endpoints.
    Tracks timestamps of requests per client key (IP).
    """
    def __init__(self):
        self.lock = threading.Lock()
        self.requests: Dict[str, List[float]] = {}

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Returns (is_allowed, retry_after_seconds).
        If allowed, automatically records the request.
        """
        now = time.time()
        with self.lock:
            # Clean old entries
            timestamps = [t for t in self.requests.get(key, []) if now - t < window_seconds]
            if len(timestamps) >= max_requests:
                earliest = timestamps[0]
                retry_after = max(1, int(window_seconds - (now - earliest)))
                self.requests[key] = timestamps
                return False, retry_after

            timestamps.append(now)
            self.requests[key] = timestamps
            return True, 0

    def record(self, key: str):
        """Manually records an attempt (e.g. for failed logins)."""
        now = time.time()
        with self.lock:
            self.requests.setdefault(key, []).append(now)

    def reset(self, key: str):
        """Clears records for a key (e.g. on successful login)."""
        with self.lock:
            self.requests.pop(key, None)

# Global rate limiters
vote_limiter = InMemoryRateLimiter()     # 15 votes / 60 seconds / IP
report_limiter = InMemoryRateLimiter()   # 3 reports / 300 seconds (5 min) / IP
login_limiter = InMemoryRateLimiter()    # 5 failed logins / 900 seconds (15 min) / IP
