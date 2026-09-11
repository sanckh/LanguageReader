import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('20a: fresh migrations, content anchors, metadata and RLS', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   grant usage on schema public to anon, authenticated, service_role;
   create schema auth; create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
   grant usage on schema auth to authenticated;
   grant execute on function auth.uid() to authenticated;`);
  const dir = new URL('../migrations/', import.meta.url);
  for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql') && !n.includes('library_storage')).sort())
   await db.exec(await readFile(new URL(name, dir), 'utf8'));
  const one = async (sql, args=[]) => (await db.query(sql,args)).rows[0];
  const fail = async (sql, code, args=[]) => assert.rejects(db.query(sql,args), {code});
  const a = await one('insert into auth.users values(gen_random_uuid()) returning id');
  const b = await one('insert into auth.users values(gen_random_uuid()) returning id');
  const pa = await one('insert into user_profile(auth_user_id) values($1) returning id',[a.id]);
  const pb = await one('insert into user_profile(auth_user_id) values($1) returning id',[b.id]);
  const pl = await one("select id from language where code='pl'");
  const doc = async owner => one("insert into document(owner_id,language_id,source_type,title,is_included_library) values($1,$2,'txt','Test',$3) returning id",[owner,pl.id,owner === null]);
  const own = await doc(pa.id), other = await doc(pb.id), shared = await doc(null);
  const section = async id => one("insert into document_section(document_id,position,kind,body) values($1,0,'paragraph','A😀ą') returning id",[id]);
  const s = await section(own.id), foreign = await section(other.id), included = await section(shared.id);
  for (const value of [0,5]) await fail('update document set level=$1 where id=$2','23514',[value,own.id]);
  await fail('update document set word_count=-1','23514');
  await fail("update document set license=''",'23514');
  await db.query("update document set level=1,topic='Daily life',word_count=3,source='Original',attribution='Author',license='CC0' where id=$1",[shared.id]);
  await fail("insert into document_section(document_id,position,kind,body) values($1,0,'heading','Title')",'23505',[own.id]);
  await fail("insert into document_section(document_id,position,kind,body) values($1,-1,'heading','Title')",'23514',[own.id]);
  await fail("update document_section set body='changed' where id=$1",'23514',[s.id]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a.id]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from document_section')).rows.length,2);
  await fail("insert into document_section(document_id,position,kind,body) values($1,1,'paragraph','No')",'42501',[shared.id]);
  assert.equal((await db.query('delete from document_section where id=$1 returning id',[foreign.id])).rows.length,0);
  assert.equal((await db.query('update document_section set position=5 where id=$1 returning id',[included.id])).rows.length,0);
  const save = 'insert into reading_position(user_id,document_id,section_id,character_offset) values($1,$2,$3,$4) on conflict(user_id,document_id) do update set section_id=excluded.section_id,character_offset=excluded.character_offset returning *';
  await db.query(save,[pa.id,own.id,s.id,0]);
  const saved = await one(save,[pa.id,own.id,s.id,3]);
  assert.equal(saved.character_offset,3);
  await fail(save,'23514',[pa.id,own.id,s.id,4]);
  await fail(save,'23514',[pa.id,own.id,s.id,-1]);
  await fail(save,'23503',[pa.id,own.id,included.id,0]);
  await fail(save,'42501',[pb.id,own.id,s.id,0]);
  await fail(save,'42501',[pa.id,other.id,foreign.id,0]);
  await db.query(save,[pa.id,shared.id,included.id,1]);
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b.id]);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from reading_position')).rows.length,0);
  assert.equal((await db.query('delete from reading_position returning *')).rows.length,0);
  await db.exec('reset role; set role anon');
  await fail('select * from document_section','42501');
  await fail('select * from reading_position','42501');
  await db.exec('reset role; set role service_role');
  await db.query('delete from document_section where id=$1',[s.id]);
  assert.equal((await db.query('select * from reading_position where document_id=$1',[own.id])).rows.length,0);
 } finally { await db.close(); }
});
