import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('cards 7-9: fresh schema, relationships, append-only evidence and difficulty snapshot', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   grant usage on schema public to anon, authenticated, service_role;
   create schema auth; create table auth.users(id uuid primary key);`);
  const dir = new URL('../migrations/', import.meta.url);
  // This suite asserts pre-card-10 grants; full RLS runs in the real SDK suite.
  for (const name of (await readdir(dir)).filter(n => n.endsWith('.sql') && n < '20260909000600').sort())
   await db.exec(await readFile(new URL(name, dir), 'utf8'));
  const one = async (sql, args=[]) => (await db.query(sql,args)).rows[0];
  const fails = async (sql, code, args=[]) => assert.rejects(db.query(sql,args), {code});
  const auth = await one('insert into auth.users values(gen_random_uuid()) returning id');
  await db.exec('set role service_role');
  const user = await one('insert into user_profile(auth_user_id) values($1) returning id',[auth.id]);
  await fails('insert into user_profile(auth_user_id) values($1)','23505',[auth.id]);
  const pl = await one("insert into language(code,name) values('pl','Polish') returning id");
  const en = await one("insert into language(code,name) values('en','English') returning id");
  const lex = await one("insert into lexeme(language_id,lemma) values($1,'dom') returning id",[pl.id]);
  const other = await one("insert into lexeme(language_id,lemma) values($1,'pies') returning id",[pl.id]);
  const knowledgeSQL = 'insert into knowledge_confidence(user_id,language_id,lexeme_id,confidence) values($1,$2,$3,$4) returning id';
  const knowledge = await one(knowledgeSQL,[user.id,pl.id,lex.id,50]);
  await fails(knowledgeSQL,'23505',[user.id,pl.id,lex.id,50]);
  await fails(knowledgeSQL,'23503',[user.id,en.id,lex.id,50]);
  await fails(knowledgeSQL,'23514',[user.id,pl.id,other.id,101]);
  await one("insert into evidence_log(knowledge_confidence_id,event_type,delta) values($1,'recall',5)",[knowledge.id]);
  await fails("update evidence_log set delta=0",'42501');
  await fails("delete from evidence_log",'42501');
  await fails("truncate evidence_log",'42501');
  await db.exec('reset role');
  // Even ordinary owner SQL (which bypasses grants/RLS) cannot rewrite evidence.
  for (const sql of ['update evidence_log set delta=0','delete from evidence_log','truncate evidence_log'])
   await fails(sql,'55000');
  await db.exec('set role service_role');
  await fails('delete from knowledge_confidence where id=$1','23503',[knowledge.id]);
  const doc = await one("insert into document(owner_id,language_id,source_type,title) values($1,$2,'txt','Private') returning id",[user.id,pl.id]);
  await one("insert into document(language_id,source_type,title,is_included_library) values($1,'original','Included',true)",[pl.id]);
  await fails("insert into document(language_id,source_type,title) values($1,'txt','No owner')",'23514',[pl.id]);
  await fails("update document set is_included_library=true where id=$1",'23514',[doc.id]);
  await one('insert into document_lexeme_freq values($1,$2,3)',[doc.id,lex.id]);
  await fails('insert into document_lexeme_freq values($1,$2,0)','23514',[doc.id,other.id]);
  await fails('insert into document_lexeme_freq values($1,$2,3)','23505',[doc.id,lex.id]);
  await one('insert into reading_session(user_id,document_id) values($1,$2)',[user.id,doc.id]);
  await fails("insert into reading_session(user_id,document_id,started_at,ended_at) values($1,$2,'2026-09-09','2026-09-08')",'23514',[user.id,doc.id]);
  const form = await one("insert into surface_form(lexeme_id,form_text) values($1,'domu') returning id",[lex.id]);
  await one('insert into word_lookup_event(user_id,document_id,lexeme_id,surface_form_id) values($1,$2,$3,$4)',[user.id,doc.id,lex.id,form.id]);
  await fails('insert into word_lookup_event(user_id,document_id,lexeme_id,surface_form_id) values($1,$2,$3,$4)','23503',[user.id,doc.id,other.id,form.id]);
  await one("insert into sentence_assistance_event(user_id,document_id,sentence_text,step_reached) values($1,$2,'To dom.',5)",[user.id,doc.id]);
  await fails("insert into sentence_assistance_event(user_id,document_id,sentence_text,step_reached) values($1,$2,'To dom.',6)",'23514',[user.id,doc.id]);
  await one('insert into review_item(user_id,lexeme_id) values($1,$2)',[user.id,lex.id]);
  const assessment = await one('insert into assessment(user_id,language_id) values($1,$2) returning id',[user.id,pl.id]);
  await one("insert into assessment_response(assessment_id,item_id,correct,difficulty_at_time) values($1,'question-v1',true,2.5)",[assessment.id]);
  await fails("insert into assessment_response(assessment_id,item_id,correct) values($1,'missing',true)",'23502',[assessment.id]);
  await fails("insert into assessment_response(assessment_id,item_id,correct,difficulty_at_time) values(gen_random_uuid(),'orphan',true,1)",'23503');
  await fails("update assessment set status='completed' where id=$1",'23514',[assessment.id]);
  await one("update assessment set status='completed', completed_at=now() where id=$1",[assessment.id]);
  assert.equal((await one('select difficulty_at_time::text as value from assessment_response')).value,'2.5');
  const tables = ['user_profile','knowledge_confidence','evidence_log','document','document_lexeme_freq',
   'reading_session','word_lookup_event','sentence_assistance_event','review_item','assessment','assessment_response'];
  for (const role of ['anon','authenticated']) {
   await db.exec('reset role; set role '+role);
   for (const table of tables) {
    await fails('select * from '+table,'42501');
    await fails('insert into '+table+' default values','42501');
   }
  }
  await db.exec('reset role');
  for (const table of tables)
   assert.equal((await one('select relrowsecurity from pg_class where oid=$1::regclass',[table])).relrowsecurity,true);
  for (const table of ['reading_session','word_lookup_event','sentence_assistance_event'])
   for (const col of ['user_id','document_id'])
    assert.ok(await one('select 1 from pg_indexes where indexname=$1',[table+'_'+col+'_idx']));
 } finally { await db.close(); }
});

