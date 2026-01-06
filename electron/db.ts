import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { seedReagents } from './reagentSeed';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Switch to root directory: Project root in Dev, Exe dir in Prod
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'config.json');

let customDbPath = '';
try {
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.customDbPath) {
      customDbPath = config.customDbPath;
    }
  }
} catch (e) {
  console.warn('Failed to read config.json:', e);
}

const dbPath = customDbPath || (app.isPackaged
  ? path.join(path.dirname(app.getPath('exe')), 'hpsa_prod.db')
  : path.join(process.cwd(), 'hpsa_prod.db'));


let db: Database.Database;
try {
  db = new Database(dbPath);
  try {
    db.pragma("key = 'LM'");
  } catch (e) {
    console.warn("Database encryption not supported or failed:", e);
  }
} catch (e) {
  console.error("Failed to initialize database at", dbPath, e);
  // Fallback to default path if custom failed
  if (customDbPath) {
    console.warn("Falling back to default database path");
    const defaultPath = app.isPackaged
      ? path.join(path.dirname(app.getPath('exe')), 'hpsa_prod.db')
      : path.join(process.cwd(), 'hpsa_prod.db');
    db = new Database(defaultPath);
  } else {
    throw e; // Standard path failed, let it crash
  }
}

export function initDb() {
  // Load Schema
  // Robustly finding the schema file
  const locations = [
    path.join(__dirname, 'schema.sql'),              // Production (bundled in dist-electron)
    path.join(process.resourcesPath, 'schema.sql'),  // Production (extraResources)
    path.join(__dirname, '../electron/schema.sql')   // Dev (source)
  ];

  let schema = '';
  for (const loc of locations) {
    try {
      if (fs.existsSync(loc)) {
        schema = fs.readFileSync(loc, 'utf-8');
        break;
      }
    } catch (e) { console.error(e); }
  }

  if (schema) {
    db.exec(schema);

    // Auto-Migration for new columns (Safe if exists)
    const migrations = [
      "ALTER TABLE inspection_results ADD COLUMN name TEXT",
      "ALTER TABLE inspection_results ADD COLUMN gender TEXT",
      "ALTER TABLE inspection_results ADD COLUMN birth_date TEXT",
      "ALTER TABLE inspection_results ADD COLUMN second_report_date TEXT",
      "ALTER TABLE inspection_results ADD COLUMN order_number TEXT",
      "ALTER TABLE settings ADD COLUMN default_technologist TEXT",
      // Reagent 999 Columns
      "ALTER TABLE inspection_results ADD COLUMN other_reagent_zh TEXT",
      "ALTER TABLE inspection_results ADD COLUMN other_reagent_en TEXT",
      "ALTER TABLE inspection_results ADD COLUMN other_license_no TEXT",
      "ALTER TABLE inspection_results ADD COLUMN other_expire_date TEXT",
      // Secondary Reagent 999 Columns 
      "ALTER TABLE inspection_results ADD COLUMN is_printed BOOLEAN DEFAULT 0",
      "ALTER TABLE inspection_results ADD COLUMN second_other_reagent_zh TEXT",
      "ALTER TABLE inspection_results ADD COLUMN second_other_reagent_en TEXT",
      "ALTER TABLE inspection_results ADD COLUMN second_other_license_no TEXT",
      "ALTER TABLE inspection_results ADD COLUMN second_other_expire_date TEXT",
      // New Settings for Lab Name and Print Title
      "ALTER TABLE settings ADD COLUMN default_lab_name TEXT",
      "ALTER TABLE settings ADD COLUMN print_title_source TEXT"
    ];

    for (const sql of migrations) {
      try {
        db.exec(sql);
      } catch (e: any) {
        // Ignore "duplicate column name" error
        if (!e.message.includes('duplicate column name')) {
          console.warn('Migration warning:', e.message);
        }
      }
    }

    seedReagents(db);
  } else {
    console.error('Schema file not found in:', locations);
  }
}

export default db;
