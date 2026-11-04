# LupaCasa — instructions for Claude Code

The rules below are shared with Cursor (`.cursor/rules/`). Edit them there, not here.

@.cursor/rules/habidata-project.mdc
@AGENTS.md

## Claude-specific notes

- Shell is Windows PowerShell locally; the monthly scrape runs on Linux in GitHub Actions.
- Monthly scrape: `.github/workflows/monthly-scrape.yml` + [`docs/SCRAPER_AUTOMATION.md`](docs/SCRAPER_AUTOMATION.md). Don't change it without reading the runbook.
- Never read or print `web/.env*` or `scraper/.env`; they hold production credentials.
