import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/** Postgres em memória com o mínimo do Supabase e todas as migrations. */
export async function createTestDb(userIds: string[]) {
  const db = new PGlite();
  await db.exec(`
    create role authenticated nologin;
    create schema auth;
    grant usage on schema auth to authenticated;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  `);
  for (const id of userIds) {
    await db.exec(`insert into auth.users values ('${id}')`);
  }

  const dir = join(process.cwd(), "supabase/migrations");
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }

  const actAs = async (userId: string) => {
    await db.exec(
      `reset role; set request.jwt.sub = '${userId}'; set role authenticated;`,
    );
  };

  return { db, actAs };
}
