import { test, expect } from "@playwright/test"

test.describe("smoke", () => {
  test("home has skip link and main landmark", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("html")).toHaveAttribute("lang", "es")
    await page.keyboard.press("Tab")
    const skip = page.getByRole("link", { name: /saltar al contenido|skip to content/i })
    await expect(skip).toBeVisible()
    await expect(page.locator("#main-content")).toBeVisible()
  })

  test("english home uses lang en", async ({ page }) => {
    await page.goto("/en")
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
  })

  test("opportunities page loads", async ({ page }) => {
    await page.goto("/oportunidades")
    await expect(page.locator("#main-content")).toBeVisible()
  })
})
