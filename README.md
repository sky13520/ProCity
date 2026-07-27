# ProCity Realty — Toronto Pre-Construction Directory

A responsive Toronto and GTA pre-construction directory deployed as one
Cloudflare Worker with static assets, a D1 database, a secure
project-management dashboard, and Google Maps search.

## Included

- Public project directory backed by Cloudflare D1
- City, keyword, property-type, price, occupancy, and visible-map-area filters
- Google Places address and neighbourhood search
- Interactive price markers linked to project details
- `/admin/` project dashboard with create, edit, publish/unpublish, and delete
- Starter project fallback while D1 is not connected
- Cloudflare Worker API with prepared D1 statements
- Automatic first-run database schema and starter-data initialization

## Cloudflare Worker settings

- Worker name: `procity`
- Production branch: `main`
- Deploy command: `npx wrangler deploy`
- Static asset directory: `public`

### 1. Connect D1

Create or select the D1 database named `procity`. The Wrangler configuration
declares the following binding:

- Variable name: `DB`
- Database: `procity`

The Worker creates the `projects` table and inserts demonstration data on the
first API request if the database is empty. The SQL migration remains available
for manual or CI-based migration workflows.

### 2. Protect the admin API

In **Settings → Variables and Secrets**, add an encrypted secret:

- `ADMIN_API_TOKEN`: a long, randomly generated password

The `/admin/` dashboard asks for this token and keeps it only in the current
browser tab. For Cloudflare Access, optionally add:

- `ADMIN_EMAILS`: comma-separated approved email addresses

For an additional security layer, protect `/admin/*` and `/api/admin/*` with a
Cloudflare Access application.

### 3. Connect Google Maps

Enable **Maps JavaScript API** and **Places API (New)** in Google Cloud. Add:

- `GOOGLE_MAPS_API_KEY`: the browser API key

Restrict the key to the production domain and the Maps JavaScript/Places APIs.
Redeploy after saving the variable.

### 4. Check runtime status

Open `/api/health`. It reports whether the database, admin authentication, and
Google Maps are configured without exposing any secret values.

## Local checks

```bash
npm test
npm run check
npx wrangler deploy --dry-run
```

Project content in the first migration is demonstration data and must be
verified before public marketing use.
