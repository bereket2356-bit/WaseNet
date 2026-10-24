"""
Rate Limiting Middleware and Utilities
Implements rate limits for login attempts, fraud reports, and device audit uploads.
"""
import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, status


class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter.
    Cleans expired timestamps on access.
    """

    def __init__(self):
        self._requests: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> bool:
        now = time.time()
        window_start = now - window_seconds
        
        # Filter out timestamps older than current window
        valid_timestamps = [ts for ts in self._requests[key] if ts > window_start]
        self._requests[key] = valid_timestamps

        if len(valid_timestamps) >= max_requests:
            return False

        self._requests[key].append(now)
        return True

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int = 60, message: str = "Rate limit exceeded"):
        if not self.is_allowed(key, max_requests, window_seconds):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": {"code": "RATE_LIMIT_EXCEEDED", "message": message}}
            )


rate_limiter = InMemoryRateLimiter()
