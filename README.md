# ProCity Realty — Toronto Pre-Construction Directory

A responsive Toronto and GTA pre-construction directory with a Cloudflare D1
database, a secure project-management dashboard, and Google Maps search.

## Included

- Public project directory backed by Cloudflare D1
- City, keyword, property-type, price, occupancy, and visible-map-area filters
- Google Places address and neighbourhood search
- Interactive price markers linked to project details
- `/admin/` project dashboard with create, edit, publish/unpublish, and delete
- Starter project fallback while D1 is not connected
- Cloudflare Pages Functions API with prepared SQL statements

## Cloudflare Pages settings

- Production branch: `main`
- Framework preset: `None`
- Build command: leave blank
- Build output directory: `.`

### 1. Create and initialize D1

Create a D1 database named `procity-projects`, then run:

```bash
npx wrangler@latest d1 execute procity-projects --remote --file=./migrations/0001_create_projects.sql
```

In the Pages project, open **Settings → Bindings → Add → D1 database** and use:

- Variable name: `DB`
- Database: `procity-projects`

Redeploy after adding the binding.

### 2. Protect the admin API

In **Settings → Variables and Secrets**, add a secret:

- `ADMIN_API_TOKEN`: a long, randomly generated password

The `/admin/` dashboard asks for this token and keeps it only in the current
browser tab. For Cloudflare Access, optionally add:

- `ADMIN_EMAILS`: comma-separated approved email addresses

Then protect `/admin/*` and `/api/admin/*` with a Cloudflare Access application.

### 3. Connect Google Maps

Enable **Maps JavaScript API** and **Places API (New)** in Google Cloud. Add:

- `GOOGLE_MAPS_API_KEY`: the browser API key

Restrict the key to the production domain and the Maps JavaScript/Places APIs.
Redeploy after saving the variable.

## Local checks

```bash
npm test
node --check app.js
node --check admin/admin.js
```

Project content in the first migration is demonstration data and must be
verified before public marketing use.
