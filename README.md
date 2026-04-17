# RTSC Drill Catalog

Static coaching resource site powered by Astro, with Notion as the authoring source for drills and curated session plans.

## What this repo does

- Pulls selected drill and session plan content from Notion with `npm run sync:notion`
- Writes normalized generated content to `content/generated`
- Mirrors publishable media into `public/media`
- Builds a static site for GitHub Pages with `npm run build`

## Before first sync

1. Create a Notion integration with read access.
2. Share the drill database with that integration.
3. Add these drill properties in Notion:
   - `Publish to Coaches` checkbox
   - `Slug` text
   - `Sort Order` number (optional)
   - `Featured` checkbox (optional)
4. Copy `.env.example` to `.env` and fill in your Notion token.

## Session plan curation

Add Notion page IDs to `content/config/session-plan-allowlist.json`.

## Commands

- `npm run sync:notion`
- `npm run build`
- `npm run preview`

## GitHub Pages deployment

The included workflow will:

- install dependencies
- optionally run the Notion sync when secrets are configured
- build the site
- publish the `dist` output to GitHub Pages

Expected repository secrets:

- `NOTION_TOKEN`
- `NOTION_DRILL_DATA_SOURCE_ID`
- `SITE_URL` (optional)
- `PUBLIC_BASE_PATH` (optional)
