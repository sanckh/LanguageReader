import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('27: atomic imports, unchanged anchors, explicit refresh and service-only execution', async () => {
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
   await db.exec(await readFile(new URL(name,dir),'utf8'));
  const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
  const book = {slug:'test-book',title:'Test',authors:['Author'],translators:[],level:null,topic:'Test',
   word_count:2,source:'https://wolnelektury.pl/katalog/lektura/test-book/',license:'Test license',
   source_notice:'Test attribution',attribution:'Author',content_hash:'test'};
  const sections = [{kind:'heading',body:'Title'},{kind:'paragraph',body:'Zażółć gęślą.'}];
  const call = (metadata=book,body=sections,refresh=false) => one('select import_wolne_lektury_book($1,$2,$3) as result',[JSON.stringify(metadata),JSON.stringify(body),refresh]);
  for (const role of ['anon','authenticated']) {
   await db.exec('set role '+role);
   await assert.rejects(call(),{code:'42501'});
   await db.exec('reset role');
  }
  await db.exec('set role service_role');
  const created = (await call()).result;
  assert.equal(created.action,'imported');
  const before = (await db.query('select id from document_section where document_id=$1 order by position',[created.id])).rows;
  assert.equal((await call()).result.action,'unchanged');
  assert.deepEqual((await db.query('select id from document_section where document_id=$1 order by position',[created.id])).rows,before);
  const updated = [{kind:'paragraph',body:'New edition'}];
  await assert.rejects(call(book,updated),{code:'22023'});
  await assert.rejects(call({...book,title:'Should roll back'},[{kind:'invalid',body:'Bad'}],true),{code:'23514'});
  assert.equal((await one('select title from document where id=$1',[created.id])).title,'Test');
  assert.equal((await one('select count(*)::integer as n from document_section where document_id=$1',[created.id])).n,2);
  await assert.rejects(call({...book,slug:'broken'},[{kind:'invalid',body:'Bad'}]),{code:'23514'});
  assert.equal((await one("select count(*)::integer as n from document where provider_book_id='broken'")).n,0);
  await db.exec('reset role');
  const auth = await one('insert into auth.users values(gen_random_uuid()) returning id');
  const profile = await one('insert into user_profile(auth_user_id) values($1) returning id',[auth.id]);
  await db.query('insert into reading_position(user_id,document_id,section_id) values($1,$2,$3)',[profile.id,created.id,before[0].id]);
  await db.exec('set role service_role');
  await call(book,sections,true);
  assert.equal((await one('select count(*)::integer as n from reading_position')).n,1);
  assert.equal((await call(book,updated,true)).result.action,'refreshed');
  assert.equal((await one('select count(*)::integer as n from reading_position')).n,0);
  assert.equal((await one('select count(*)::integer as n from document')).n,1);
 } finally { await db.close(); }
});
