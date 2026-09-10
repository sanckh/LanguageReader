import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('card 13.6: assessment_item schema, constraints, and response columns', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create role service_role bypassrls;
      grant usage on schema public to anon, authenticated, service_role;
      create schema auth; create table auth.users (id uuid primary key);`);
    const dir = new URL('../migrations/', import.meta.url);
    const names = (await readdir(dir))
      .filter(
        (n) =>
          n.endsWith('.sql') &&
          (n < '20260909000600' || n.startsWith('20260909001000')),
      )
      .sort();
    for (const name of names) {
      await db.exec(await readFile(new URL(name, dir), 'utf8'));
    }

    const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
    const fails = async (sql, code, args = []) =>
      assert.rejects(db.query(sql, args), { code });

    await db.exec('set role service_role');
    const pl = await one(
      "insert into language(code,name) values('pl','Polish') returning id",
    );
    const en = await one(
      "insert into language(code,name) values('en','English') returning id",
    );
    const lex = await one(
      "insert into lexeme(language_id,lemma) values($1,'dom') returning id",
      [pl.id],
    );
    const item = `insert into assessment_item
      (language_id, base_language_id, item_key, version, item_type, difficulty,
       target_lexeme_id, prompt, options, correct_option_key)
      values ($1,$2,$3,1,'vocabulary_meaning',1,$4,'dom',
        '[{"key":"a","text":"house"},{"key":"b","text":"dog"}]'::jsonb,'a')`;
    await db.query(item, [pl.id, en.id, 'pl.v1.dom.house', lex.id]);
    await fails(item, '23505', [pl.id, en.id, 'pl.v1.dom.house', lex.id]);

    const bad = (key, type, difficulty, options) =>
      `insert into assessment_item (language_id,base_language_id,item_key,item_type,difficulty,prompt,options,correct_option_key)
        values ('${pl.id}','${en.id}','${key}','${type}',${difficulty},'p','${options}'::jsonb,'a')`;
    await fails(bad('k1', 'bad_type', 1, '[{"key":"a","text":"x"},{"key":"b","text":"y"}]'), '23514');
    await fails(bad('k2', 'vocabulary_meaning', 9, '[{"key":"a","text":"x"},{"key":"b","text":"y"}]'), '23514');
    await fails(bad('k3', 'vocabulary_meaning', 1, '[{"key":"a","text":"x"}]'), '23514');
    await fails(bad('k4', 'vocabulary_meaning', 1, '{}'), '23514');

    assert.equal(
      (
        await one(
          "select relrowsecurity from pg_class where oid='public.assessment_item'::regclass",
        )
      ).relrowsecurity,
      true,
    );
    for (const role of ['anon', 'authenticated']) {
      await db.exec('reset role; set role ' + role);
      await fails('select * from public.assessment_item', '42501');
    }
    await db.exec('reset role');
    const authUser = await one(
      'insert into auth.users values (gen_random_uuid()) returning id',
    );
    await db.exec('set role service_role');
    const profile = await one(
      'insert into user_profile(auth_user_id) values($1) returning id',
      [authUser.id],
    );
    const assessment = await one(
      'insert into assessment(user_id,language_id) values($1,$2) returning id',
      [profile.id, pl.id],
    );
    const response = await one(
      `insert into assessment_response
        (assessment_id,item_id,correct,difficulty_at_time,selected_option_key,item_version)
        values ($1,'pl.v1.dom.house',true,1,'a',1)
        returning selected_option_key, item_version`,
      [assessment.id],
    );
    assert.equal(response.selected_option_key, 'a');
    assert.equal(response.item_version, 1);
  } finally {
    await db.close();
  }
});
