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

const DETAIL_COLUMNS = {
  source_url: "TEXT NOT NULL DEFAULT ''",
  images_json: "TEXT NOT NULL DEFAULT '[]'",
  property_details_json: "TEXT NOT NULL DEFAULT '{}'",
  pricing_fees_json: "TEXT NOT NULL DEFAULT '{}'",
  deposit_structure: "TEXT NOT NULL DEFAULT ''",
  amenities_json: "TEXT NOT NULL DEFAULT '[]'",
  current_incentives: "TEXT NOT NULL DEFAULT ''",
  details_fetched_at: "TEXT"
};

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
  const columnResult = await database.prepare("PRAGMA table_info(projects)").all();
  const existingColumns = new Set(columnResult.results.map((column) => column.name));
  for (const [name, definition] of Object.entries(DETAIL_COLUMNS)) {
    if (!existingColumns.has(name)) {
      await database.prepare(`ALTER TABLE projects ADD COLUMN ${name} ${definition}`).run();
    }
  }
}
