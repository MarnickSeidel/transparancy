"""One-off: inspect what Playwright sees on the listing page."""
from __future__ import annotations

import json

from playwright.sync_api import sync_playwright

from config import LISTING_URL

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    )
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 900},
        locale="es-CO",
        timezone_id="America/Bogota",
    )
    page = ctx.new_page()
    page.goto(LISTING_URL, wait_until="domcontentloaded", timeout=120_000)
    page.wait_for_timeout(8000)

    stats = page.evaluate(
        """() => {
      const allA = document.querySelectorAll('a[href]');
      const fin = document.querySelectorAll('a[href*="fincaraiz"]');
      const digitEnd = [];
      for (const a of allA) {
        const h = (a.href || "").split("#")[0];
        const m = h.match(/\\/(\\d{6,})\\/?$/);
        if (m) digitEnd.push(h.slice(0, 120));
      }
      return {
        title: document.title,
        bodyLen: (document.body && document.body.innerText) ? document.body.innerText.length : 0,
        allLinks: allA.length,
        fincaLinks: fin.length,
        digitEndIds: digitEnd.length,
        sampleDigit: digitEnd.slice(0, 5),
        sampleAny: Array.from(allA).slice(0, 8).map(a => a.href),
      };
    }"""
    )
    print(json.dumps(stats, indent=2, ensure_ascii=False))
    page.screenshot(path="debug_listing.png", full_page=False)
    print("Wrote debug_listing.png")
    browser.close()
