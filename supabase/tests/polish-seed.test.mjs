import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('card 13: Polish language row is seeded and the seed is idempotent', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;`);
    const dir = new URL('../migrations/', import.meta.url);
    const seed = '20260909000800_seed_polish_language.sql';
    for (const name of ['20260909000200_linguistic_core.sql', seed]) {
      await db.exec(await readFile(new URL(name, dir), 'utf8'));
    }
    const { rows } = await db.query(
      "select name from public.language where code = 'pl'",
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, 'Polish');
    await db.exec(await readFile(new URL(seed, dir), 'utf8'));
    assert.equal(
      (await db.query("select 1 from public.language where code = 'pl'")).rows
        .length,
      1,
    );
  } finally {
    await db.close();
  }
});
