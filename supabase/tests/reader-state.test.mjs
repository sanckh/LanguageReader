import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('private saves and passage state remain owner-scoped, idempotent and edition-safe', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   grant usage on schema public to anon, authenticated, service_role;
   create schema auth; create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as
   $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
   grant usage on schema auth to authenticated;`);
  const dir = new URL('../migrations/', import.meta.url);
  for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql') && !n.includes('library_storage')).sort())
   await db.exec(await readFile(new URL(name, dir), 'utf8'));
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const alice = await one('insert into auth.users values(gen_random_uuid()) returning id');
  const bob = await one('insert into auth.users values(gen_random_uuid()) returning id');
  const a = await one('insert into user_profile(auth_user_id) values($1) returning id', [alice.id]);
  const b = await one('insert into user_profile(auth_user_id) values($1) returning id', [bob.id]);
  const book = { slug: 'sample', title: 'Sample', authors: ['Author'], translators: [], license: 'License', source_notice: 'Credits' };
  const original = (await one('select import_wolne_lektury_book($1,$2) as book', [JSON.stringify(book), JSON.stringify([{kind:'paragraph', body:'A😀 phrase here.'}])])).book.id;
  const section = await one('select id from document_section where document_id=$1', [original]);
  await db.query("insert into reader_settings values($1,$2,'learning')", [a.id, original]);
  await db.query('insert into reading_position(user_id,document_id,section_id,character_offset) values($1,$2,$3,2)', [a.id, original, section.id]);
  await db.query("insert into reader_assistance(user_id,document_id,section_id,start_offset,end_offset,attempt,revealed,translation,vocabulary_help) values($1,$2,$3,0,2,'guess',true,'Actual translation','{\"lemma\":\"example\"}')", [a.id, original, section.id]);
  const save = async (owner = a.id) => (await one('select save_provider_book($1,$2) as id', [original, owner])).id;
  const privateId = await save();
  assert.equal(await save(), privateId);
  assert.notEqual(await save(b.id), privateId);
  const saved = await one('select * from document where id=$1', [privateId]);
  assert.equal(saved.owner_id, a.id);
  assert.equal(saved.is_included_library, false);
  assert.equal(saved.source_notice, 'Credits');
  const copyState = await one('select * from reader_assistance where document_id=$1', [privateId]);
  assert.notEqual(copyState.section_id, section.id);
  assert.equal(copyState.attempt, 'guess');
  assert.equal(copyState.translation, 'Actual translation');
  assert.deepEqual(copyState.vocabulary_help, {lemma:'example'});
  assert.equal((await one('select mode from reader_settings where document_id=$1', [privateId])).mode, 'learning');
  assert.equal((await one('select character_offset from reading_position where document_id=$1', [privateId])).character_offset, 2);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob.id]);
  assert.equal((await db.query('select * from reader_assistance where user_id=$1', [a.id])).rows.length, 0);
  assert.equal((await db.query('select * from reader_settings where user_id=$1', [a.id])).rows.length, 0);
  assert.equal((await db.query('select * from document where id=$1', [privateId])).rows.length, 0);
  await assert.rejects(db.query("insert into reader_settings values($1,$2,'reading')", [b.id, privateId]), {code:'42501'});
  await assert.rejects(save(b.id), {code:'42501'});
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice.id]);
  await db.query("insert into reader_assistance(user_id,document_id,section_id,start_offset,end_offset,attempt,revealed) values($1,$2,$3,0,2,'retake',false) on conflict(user_id,document_id,section_id,start_offset,end_offset) do update set attempt=excluded.attempt,revealed=excluded.revealed", [a.id, privateId, copyState.section_id]);
  assert.equal((await one('select attempt from reader_assistance where document_id=$1', [privateId])).attempt, 'retake');
  await assert.rejects(db.query('insert into reader_assistance(user_id,document_id,section_id,start_offset,end_offset) values($1,$2,$3,0,1000)', [a.id, privateId, copyState.section_id]), {code:'23514'});
  await assert.rejects(db.query('insert into reader_assistance(user_id,document_id,section_id,start_offset,end_offset) values($1,$2,$3,0,1)', [a.id, privateId, section.id]), {code:'23503'});
  await db.exec('reset role');
  await db.query('delete from document_section where id=$1', [section.id]);
  assert.equal((await one('select count(*)::int as n from reader_assistance where document_id=$1', [original])).n, 0);
  assert.equal((await one('select count(*)::int as n from reader_assistance where document_id=$1', [privateId])).n, 1);
 } finally { await db.close(); }
});
