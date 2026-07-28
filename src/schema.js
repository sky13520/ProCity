import PROJECT_CATALOG from "./project-data.json" with { type: "json" };

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    city TEXT NOT NULL,
    area TEXT NOT NULL,
    address TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Condo',
    builder TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
    occupancy TEXT NOT NULL DEFAULT '',
    badge TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
    published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_projects_public
    ON projects (published, featured, updated_at)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_city_type
    ON projects (city, type)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_location
    ON projects (latitude, longitude)`
];

const CATALOG_BATCH_SIZE = 100;
const CATALOG_ID_OFFSET = 100000;

const STARTER_PROJECTS = [
  [1, "Harbourline Residences", "Toronto", "East Bayfront", "25 Queens Quay E, Toronto, ON", "Condo", "A curated ProCity opportunity", 699000, "2029", "FEATURED", "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1400&q=85", "Contemporary waterfront living with quick access to downtown, transit, and the lake.", 43.6437, -79.3717, 1, 1],
  [2, "The Junction House", "Toronto", "The Junction", "2853 Dundas St W, Toronto, ON", "Condo", "A curated ProCity opportunity", 759000, "2028", "NEW RELEASE", "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=85", "Boutique urban residences in one of Toronto's most character-rich neighbourhoods.", 43.6654, -79.4654, 0, 1],
  [3, "VMC Parkside", "Vaughan", "Vaughan Metropolitan Centre", "100 New Park Pl, Vaughan, ON", "Condo", "A curated ProCity opportunity", 629000, "2029", "VIP ACCESS", "https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1400&q=85", "A transit-connected high-rise community at the centre of Vaughan's new downtown.", 43.7936, -79.5267, 1, 1],
  [4, "Unionville Garden", "Markham", "Unionville", "16th Ave & Kennedy Rd, Markham, ON", "Condo", "A curated ProCity opportunity", 719000, "2028", "COMING SOON", "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=85", "Modern residences surrounded by green space, retail, schools, and regional transit.", 43.8892, -79.3192, 0, 1],
  [5, "Yonge & Major", "Richmond Hill", "Yonge Street", "Yonge St & Major Mackenzie Dr, Richmond Hill, ON", "Condo", "A curated ProCity opportunity", 689000, "2029", "FEATURED", "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1400&q=85", "Refined high-rise living near shops, parks, schools, and rapid transit connections.", 43.8717, -79.4371, 1, 1],
  [6, "Leslieville Lane", "Toronto", "Leslieville", "Queen St E & Leslie St, Toronto, ON", "Townhome", "A curated ProCity opportunity", 1199000, "2028", "LIMITED", "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85", "Design-led urban townhomes on a quiet lane, steps from Toronto's east-end energy.", 43.6628, -79.3312, 0, 1],
  [7, "Cornell Modern", "Markham", "Cornell", "Bur Oak Ave & Cornell Centre Blvd, Markham, ON", "Townhome", "A curated ProCity opportunity", 1099000, "2027", "MOVE-IN SOONER", "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=85", "Spacious family townhomes in a walkable Markham community close to everyday essentials.", 43.8963, -79.2307, 0, 1],
  [8, "Central District", "Vaughan", "Highway 7", "Highway 7 & Jane St, Vaughan, ON", "Condo", "A curated ProCity opportunity", 649000, "2028", "INCENTIVES", "https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&w=1400&q=85", "A connected mixed-use community with contemporary suites and easy GTA access.", 43.7922, -79.5275, 0, 1]
];

const INSERT_STARTER_PROJECT = `INSERT OR IGNORE INTO projects (
  id, title, city, area, address, type, builder, price, occupancy, badge,
  image_url, description, latitude, longitude, featured, published
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function initializeDatabase(database) {
  try {
    await database.prepare("SELECT 1 FROM projects LIMIT 1").first();
  } catch (error) {
    if (!String(error?.message || error).toLowerCase().includes("no such table")) {
      throw error;
    }
  }

  await database.batch(
    SCHEMA_STATEMENTS.map((statement) => database.prepare(statement))
  );
  await syncProjectCatalog(database);
}

export async function syncProjectCatalog(database) {
  await database.prepare(
    `CREATE TABLE IF NOT EXISTS catalog_import_state (
      source TEXT PRIMARY KEY,
      cursor INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();

  const source = "mycondopro-public-directory";
  const state = await database.prepare(
    "SELECT cursor, total FROM catalog_import_state WHERE source = ?"
  ).bind(source).first();
  let cursor = Number(state?.cursor || 0);
  if (Number(state?.total || 0) !== PROJECT_CATALOG.length) cursor = 0;
  if (cursor >= PROJECT_CATALOG.length) return {
    imported: PROJECT_CATALOG.length,
    total: PROJECT_CATALOG.length,
    complete: true
  };

  const batch = PROJECT_CATALOG.slice(cursor, cursor + CATALOG_BATCH_SIZE);
  const statement = database.prepare(
    `INSERT OR REPLACE INTO projects (
      id, title, city, area, address, type, builder, price, occupancy, badge,
      image_url, description, latitude, longitude, featured, published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  await database.batch(batch.map((project, index) => statement.bind(
    CATALOG_ID_OFFSET + cursor + index,
    project.title,
    project.city,
    project.area,
    project.address,
    project.type,
    project.builder,
    project.price,
    project.occupancy,
    project.badge,
    project.imageUrl,
    project.description,
    project.latitude ?? 0,
    project.longitude ?? 0,
    project.featured ? 1 : 0,
    project.published ? 1 : 0
  )));

  cursor += batch.length;
  await database.prepare(
    `INSERT INTO catalog_import_state (source, cursor, total, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(source) DO UPDATE SET
       cursor = excluded.cursor,
       total = excluded.total,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(source, cursor, PROJECT_CATALOG.length).run();

  if (cursor >= PROJECT_CATALOG.length) {
    await database.prepare("DELETE FROM projects WHERE id BETWEEN 1 AND 8").run();
  }
  return {
    imported: cursor,
    total: PROJECT_CATALOG.length,
    complete: cursor >= PROJECT_CATALOG.length
  };
}
