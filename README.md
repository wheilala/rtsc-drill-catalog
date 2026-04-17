# RTSC Drill Catalog

This repo powers my published RTSC coaching library:

[Live site on GitHub Pages](https://wheilala.github.io/rtsc-drill-catalog/)

It is not meant to be a generic product or starter kit. It is a small personal publishing workflow that lets me keep my working coaching content in Notion, then publish selected drills and session plans as a cleaner, faster static site for other coaches to browse.

## What this is for

I collect drills slowly over time from normal coaching life:

- word of mouth from other coaches
- videos and online research
- ideas adapted from real team needs
- activities that proved useful enough to keep

The messy, evolving working version lives in Notion. This repo is the publishing layer that turns selected content into a shareable library.

In plain English:

- I organize privately in Notion
- I mark the drills or session plans I want to share
- this repo syncs the published subset locally
- Astro builds the final static site
- GitHub Pages hosts the finished result

## How the workflow works

### Drills

Drills are the most structured content type.

The Notion drill database stores things like:

- title
- topics
- summary
- setup
- instructions
- progressions
- emphasis
- diagram/image
- video link

When a drill is ready to publish, I mark it with `Publish to Coaches`. The sync script pulls only those drills, normalizes the content, mirrors the publishable media, and writes generated files into `content/generated/drills`.

### Session plans

Session plans are more authored and less rigidly structured than drills. They are intentionally treated as a separate content type.

For v1, I curate them by allowlist:

- page IDs live in `content/config/session-plan-allowlist.json`
- the sync pulls those specific Notion pages
- supported Notion blocks are converted into published page content
- images are mirrored into `public/media/session-plans`

## How the site is built

This project uses:

- `Astro` for the static site
- `Notion` as the authoring source
- a local sync script for content generation
- `GitHub Pages` for hosting

The site does not read from Notion at runtime. Notion is only used during sync/build, which keeps the published site fast and simple.

## Repo responsibilities

This repo is responsible for:

- syncing selected content from Notion with `npm run sync:notion`
- writing normalized generated content to `content/generated`
- mirroring images and other publishable media into `public/media`
- building the static site with `npm run build`
- deploying the final output to GitHub Pages via GitHub Actions

## Commands

- `npm run sync:notion`
- `npm run build`
- `npm run preview`
- `npm run dev`

## Local setup

Before the first sync:

1. Create a Notion integration with read access.
2. Share the drill database and any session-plan parent pages you want to publish with that integration.
3. Add these drill properties in Notion:
   - `Publish to Coaches`
   - `Slug`
   - `Sort Order` (optional)
   - `Featured` (optional)
4. Copy `.env.example` to `.env` and fill in the values.

Expected local env values:

- `NOTION_TOKEN`
- `NOTION_DRILL_DATA_SOURCE_ID`
- `SITE_URL`
- `PUBLIC_BASE_PATH`

## GitHub Pages deployment

The repo includes a GitHub Actions workflow that:

- installs dependencies
- runs the Notion sync when secrets are configured
- builds the Astro site
- deploys `dist` to GitHub Pages

Expected GitHub Actions configuration:

Secrets:

- `NOTION_TOKEN`
- `NOTION_DRILL_DATA_SOURCE_ID`

Variables:

- `SITE_URL`
- `PUBLIC_BASE_PATH`

## Practical note

If you are just trying to use the coaching library, the repo is the wrong place to start. Use the published site instead:

[https://wheilala.github.io/rtsc-drill-catalog/](https://wheilala.github.io/rtsc-drill-catalog/)
