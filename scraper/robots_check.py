"""Lightweight robots.txt check for the listing path (respect site policy)."""

from __future__ import annotations

import random
import time
import urllib.error
import urllib.request

from human_behavior import pause_short, pick_user_agent

from config import ROBOTS_URL


def robots_allows_listing(url: str) -> bool:
    """
    Returns True if the default * block doesn't obviously disallow this path.
    Fincaraiz disallows /venta/*-y-* (combined searches); city path is typically allowed.
    """
    try:
        req = urllib.request.Request(
            ROBOTS_URL,
            headers={"User-Agent": pick_user_agent()},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, OSError):
        pause_short()
        return True

    if "Disallow: /venta/*-y-*" in body and "-y-" in url:
        return False
    pause_short()
    return True


def maybe_random_pre_navigation_delay() -> None:
    pause_short()
    time.sleep(random.uniform(0.2, 0.9))
