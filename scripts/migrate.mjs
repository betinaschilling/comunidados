import {neon} from '@neondatabase/serverless';
const sql=neon(process.env.DATABASE_URL);
await sql.query(`CREATE TABLE IF NOT EXISTS planner_items(id TEXT PRIMARY KEY,title TEXT NOT NULL,date TEXT NOT NULL,category TEXT NOT NULL,routine BOOLEAN NOT NULL,done BOOLEAN NOT NULL DEFAULT FALSE,completed_at TEXT,amount INTEGER NOT NULL DEFAULT 0,link TEXT NOT NULL DEFAULT '',notes TEXT NOT NULL DEFAULT '',measurements JSONB NOT NULL DEFAULT '{}',attachments JSONB NOT NULL DEFAULT '[]',source_id TEXT)`,[]);
await sql.query('CREATE INDEX IF NOT EXISTS planner_items_date_idx ON planner_items(date)',[]);
await sql.query('CREATE TABLE IF NOT EXISTS planner_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)',[]);
console.log('Banco preparado');

await sql.query(`CREATE TABLE IF NOT EXISTS auth_accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT,session_version INTEGER NOT NULL DEFAULT 0,reset_hash TEXT,reset_expires TIMESTAMPTZ)`,[]);
await sql.query(`CREATE TABLE IF NOT EXISTS auth_limits(scope TEXT PRIMARY KEY,attempts INTEGER NOT NULL,expires_at TIMESTAMPTZ NOT NULL)`,[]);

await sql.query('ALTER TABLE planner_items ADD COLUMN IF NOT EXISTS not_done BOOLEAN NOT NULL DEFAULT FALSE',[]);
await sql.query('ALTER TABLE planner_items ADD COLUMN IF NOT EXISTS sort_order INTEGER',[]);

await sql.query('ALTER TABLE planner_items ADD COLUMN IF NOT EXISTS household_group TEXT',[]);
await sql.query('ALTER TABLE planner_items ADD COLUMN IF NOT EXISTS period TEXT',[]);
await sql.query('ALTER TABLE planner_items ADD COLUMN IF NOT EXISTS depends_on TEXT',[]);
