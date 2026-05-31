// Executa supabase/migration.sql no banco do projeto Supabase.
// Uso: node scripts/migrate.mjs  (lê a senha do env DB_PASSWORD ou usa a padrão abaixo)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "..", "supabase", "migration.sql"), "utf8");

const PROJECT_REF = "fpgcvekbkkotrweelbrc";
const PASSWORD = process.env.DB_PASSWORD || "DEDVxyd2KBRT4boh";

// Tenta conexão direta e, se falhar, os poolers regionais.
const candidates = [
  { host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: "postgres" },
  ...["us-east-1", "us-east-2", "us-west-1", "sa-east-1", "eu-central-1", "eu-west-1", "ap-southeast-1"].flatMap(
    (region) => [
      { host: `aws-0-${region}.pooler.supabase.com`, port: 6543, user: `postgres.${PROJECT_REF}` },
      { host: `aws-0-${region}.pooler.supabase.com`, port: 5432, user: `postgres.${PROJECT_REF}` },
      { host: `aws-1-${region}.pooler.supabase.com`, port: 6543, user: `postgres.${PROJECT_REF}` },
    ]
  ),
];

async function tryOne(c) {
  const client = new pg.Client({
    host: c.host,
    port: c.port,
    user: c.user,
    password: PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    query_timeout: 60000,
  });
  await client.connect();
  await client.query(sql);
  await client.end();
}

let ok = false;
for (const c of candidates) {
  try {
    process.stdout.write(`Conectando em ${c.host}:${c.port} (${c.user})… `);
    await tryOne(c);
    console.log("OK ✔");
    ok = true;
    break;
  } catch (e) {
    console.log("falhou:", e.code || e.message);
  }
}

if (!ok) {
  console.error(
    "\nNão consegui conectar automaticamente. Rode o conteúdo de supabase/migration.sql\n" +
      "no SQL Editor do Supabase (https://supabase.com/dashboard/project/" +
      PROJECT_REF +
      "/sql/new)."
  );
  process.exit(1);
}
console.log("\nMigração concluída com sucesso.");
