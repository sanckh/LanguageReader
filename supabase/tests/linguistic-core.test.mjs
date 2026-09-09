import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('fresh migrations, linguistic relationships, and client permissions', async () => {
  const db = new PGlite();
  try {
    // These roles are supplied by Supabase, not by bare Postgres.
    await db.exec(`create role anon; create role authenticated;
      create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema auth;
      create table auth.users (id uuid primary key);`);
    const directory = new URL('../migrations/', import.meta.url);
    // Embedded tests cover the pre-RLS schema; the SDK suite tests the full chain.
    for (const name of (await readdir(directory)).filter(n => n.endsWith('.sql') && n < '20260909000600').sort()) {
      await db.exec(await readFile(new URL(name, directory), 'utf8'));
    }
    const tables = ['language', 'lexeme', 'surface_form', 'meaning', 'example_sentence'];
    const { rows: metadata } = await db.query(`select relname, relrowsecurity
      from pg_class where relnamespace = 'public'::regnamespace and relname = any($1)`, [tables]);
    assert.equal(metadata.length, 5);
    assert.ok(metadata.every(row => row.relrowsecurity));
    const { rows: indexes } = await db.query(`select indexname from pg_indexes
      where schemaname = 'public'`);
    for (const index of ['lexeme_language_id_idx', 'surface_form_lexeme_id_idx',
      'meaning_lexeme_id_idx', 'example_sentence_lexeme_id_idx']) {
      assert.ok(indexes.some(row => row.indexname === index), index);
    }
    await db.exec('set role service_role');
    const { rows: [language] } = await db.query(`insert into public.language (code, name)
      values ('pl', 'Polish') returning id, capabilities`);
    assert.deepEqual(language.capabilities, {});
    const { rows: [lexeme] } = await db.query(`insert into public.lexeme
      (language_id, lemma, part_of_speech) values ($1, 'zamek', 'noun') returning id`, [language.id]);
    // Allow homonyms and multiple morphological analyses of one spelling.
    await db.query(`insert into public.lexeme (language_id, lemma, part_of_speech)
      values ($1, 'zamek', 'noun')`, [language.id]);
    await db.query(`insert into public.surface_form (lexeme_id, form_text, grammatical_features)
      values ($1, 'zamku', '{"case":"genitive"}'), ($1, 'zamku', '{"case":"locative"}')`, [lexeme.id]);
    await db.query(`insert into public.meaning (lexeme_id, gloss, source)
      values ($1, 'castle', 'test fixture'), ($1, 'lock', 'test fixture')`, [lexeme.id]);
    await db.query(`insert into public.example_sentence
      (lexeme_id, source_lang_text, target_lang_text, source)
      values ($1, 'To jest zamek.', 'This is a castle.', 'test fixture')`, [lexeme.id]);
    await assert.rejects(db.exec(`insert into public.language (code, name)
      values ('pl', 'Duplicate')`), { code: '23505' });
    await assert.rejects(db.exec(`insert into public.language (code, name, capabilities)
      values ('en', 'English', '[]')`), { code: '23514' });
    await assert.rejects(db.query(`insert into public.surface_form
      (lexeme_id, form_text, grammatical_features) values ($1, 'x', '[]')`, [lexeme.id]), { code: '23514' });
    await assert.rejects(db.exec(`insert into public.lexeme (language_id, lemma)
      values (gen_random_uuid(), 'orphan')`), { code: '23503' });
    for (const [table, column] of [['surface_form', 'form_text'], ['meaning', 'gloss'],
      ['example_sentence', 'source_lang_text']]) {
      await assert.rejects(db.exec(`insert into public.${table} (lexeme_id, ${column})
        values (gen_random_uuid(), 'orphan')`), { code: '23503' });
    }
    await assert.rejects(db.query('delete from public.language where id = $1', [language.id]), { code: '23503' });
    await assert.rejects(db.query('delete from public.lexeme where id = $1', [lexeme.id]), { code: '23503' });
    await db.exec('reset role; set role authenticated');
    for (const table of tables) {
      assert.ok((await db.query(`select * from public.${table}`)).rows.length > 0);
      for (const statement of [`delete from public.${table}`, `update public.${table} set id = id`,
        `insert into public.${table} default values`, `truncate public.${table}`]) {
        await assert.rejects(db.exec(statement), { code: '42501' });
      }
    }
    await db.exec('reset role; set role anon');
    for (const table of tables) {
      await assert.rejects(db.exec(`select * from public.${table}`), { code: '42501' });
    }
  } finally {
    await db.close();
  }
});
