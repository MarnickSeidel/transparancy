"""Randomized delays and light fingerprint variance to behave more like a human session."""

from __future__ import annotations

import random
import time

from config import MAX_DELAY_SEC, MIN_DELAY_SEC


def pause_action() -> None:
    time.sleep(random.uniform(MIN_DELAY_SEC, MAX_DELAY_SEC))


def pause_short() -> None:
    time.sleep(random.uniform(0.4, 1.6))


def random_viewport() -> dict[str, int]:
    w = random.randint(1180, 1440)
    h = random.randint(780, 920)
    return {"width": w, "height": h}


def pick_user_agent() -> str:
    from config import USER_AGENTS

    return random.choice(USER_AGENTS)
