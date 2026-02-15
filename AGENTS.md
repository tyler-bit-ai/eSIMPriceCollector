# Repository Guidelines

## Project Structure & Module Organization
Core orchestration lives in `index.js`, which runs all crawler modules in `crawlers/` (`usimsa.js`, `pindirect.js`, `dosirak.js`, `maaltalk.js`). One-off analysis/debug scripts are in the repository root (for example, `analyze_selectors.js`, `crawl_esim.js`). Output artifacts (`esim_prices_*.csv`, `esim_prices_*.xlsx`) are generated in the root directory.

## Build, Test, and Development Commands
- `npm install`: install Node.js dependencies (`playwright`, `xlsx`).
- `npm start`: run the full multi-site crawl via `index.js`.
- `node index.js`: equivalent direct entrypoint for local runs.
- `node crawl_esim.js`: run legacy single-flow crawler/debug workflow.

There is currently no functional automated test script; `npm test` intentionally exits with an error placeholder.

## Coding Style & Naming Conventions
Use CommonJS modules (`require`/`module.exports`) and 2-space indentation, matching existing files. Prefer descriptive camelCase for variables/functions (`saveToCSV`, `extractProductInfo`) and lowercase filenames for crawler modules. Keep each crawler focused on one provider and export a consistent crawl interface used by `index.js`.

## Testing Guidelines
This repository does not yet include a test framework. For now:
- Validate changes by running `npm start` against at least one target site.
- Confirm output files are created and rows contain expected fields (`country`, `network_type`, `product_name`, `data_amount`, `price`, `crawled_at`).
- For parser/selector changes, add a small reproducible script (similar to `analyze_*.js`) when needed.

## Commit & Pull Request Guidelines
Recent commits follow short imperative messages (for example, `Add Maaltalk eSIM crawler`, `Refactor crawlers into modular architecture with Excel export`). Keep that style:
- Start with a verb (`Add`, `Refactor`, `Fix`, `Update`).
- Keep subject lines specific to one logical change.

PRs should include: purpose, affected crawler(s), sample output or logs from a local run, and any selector/site assumptions that may break with upstream UI changes.
