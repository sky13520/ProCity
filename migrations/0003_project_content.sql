ALTER TABLE projects ADD COLUMN amenities_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE projects ADD COLUMN current_incentives TEXT NOT NULL DEFAULT '';
