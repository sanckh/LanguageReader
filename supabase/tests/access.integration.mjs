import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

// Only the dedicated local stack is accepted; credentials never come from cloud env.
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const root = fileURLToPath(new URL('../../', import.meta.url));
const status = JSON.parse(execFileSync(process.execPath, [cli, 'status', '-o', 'json'], {cwd:root, encoding:'utf8', stdio:['ignore','pipe','pipe']}));
const url = status.API_URL;
assert.equal(new URL(url).hostname, '127.0.0.1');
assert.equal(new URL(url).port, '55321');
const options = {auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false}};
const admin = createClient(url, status.SERVICE_ROLE_KEY, options);
const client = () => createClient(url, status.ANON_KEY, options);
async function ok(request) { const {data,error} = await request; assert.equal(error,null, error?.message); return data; }
async function denied(request) { const {error} = await request; assert.ok(error, 'expected denied operation'); }
const add = async (table,row) => (await ok(admin.from(table).insert(row).select().single()));
test('SDK: cross-user database and Storage isolation', async () => {
 const suffix = randomUUID();
 const users = [];
 for (const label of ['a','b']) {
  const email = label+'-'+suffix+'@example.test';
  const password = randomUUID()+'Aa9!';
  const {user} = await ok(admin.auth.admin.createUser({email,password,email_confirm:true}));
  const session = client();
  await ok(session.auth.signInWithPassword({email,password}));
  const profile = await ok(session.from('user_profile').insert({auth_user_id:user.id}).select().single());
  users.push({auth:user.id,profile:profile.id,client:session});
 }
 const [a,b] = users;
 const language = await add('language',{code:suffix,name:'Test'});
 const lexeme = await add('lexeme',{language_id:language.id,lemma:'dom'});
 const shared = await add('document',{language_id:language.id,source_type:'txt',title:'Included',is_included_library:true});
 const fixtures = [];
 for(const u of users) {
  const doc = await add('document',{owner_id:u.profile,language_id:language.id,source_type:'txt',title:'Private'});
  const knowledge = await add('knowledge_confidence',{user_id:u.profile,language_id:language.id,lexeme_id:lexeme.id,confidence:50});
  const assessment = await add('assessment',{user_id:u.profile,language_id:language.id});
  const rows = {
   user_profile:{id:u.profile},
   document:doc,
   knowledge_confidence:knowledge,
   evidence_log:await add('evidence_log',{knowledge_confidence_id:knowledge.id,event_type:'test',delta:1}),
   document_lexeme_freq:await add('document_lexeme_freq',{document_id:doc.id,lexeme_id:lexeme.id,frequency:1}),
   reading_session:await add('reading_session',{user_id:u.profile,document_id:doc.id}),
   word_lookup_event:await add('word_lookup_event',{user_id:u.profile,document_id:doc.id,lexeme_id:lexeme.id}),
   sentence_assistance_event:await add('sentence_assistance_event',{user_id:u.profile,document_id:doc.id,sentence_text:'To dom.',step_reached:1}),
   review_item:await add('review_item',{user_id:u.profile,lexeme_id:lexeme.id}),
   assessment,
   assessment_response:await add('assessment_response',{assessment_id:assessment.id,item_id:'q1',correct:true,difficulty_at_time:1})
  };
  fixtures.push(rows);
 }
 // Check both directions, and ensure own records remain accessible.
 for (let i=0;i<2;i++) {
  const viewer=users[i].client;
  for(const [table,row] of Object.entries(fixtures[i])) {
   const column=table==='document_lexeme_freq'?'document_id':'id';
   assert.equal((await ok(viewer.from(table).select().eq(column,row[column]))).length,1,table+' own read');
   const foreign=fixtures[1-i][table];
   assert.deepEqual(await ok(viewer.from(table).select().eq(column,foreign[column])),[],table+' cross-user read');
   if(!['user_profile','evidence_log'].includes(table)) {
    assert.deepEqual(await ok(viewer.from(table).delete().eq(column,foreign[column]).select()),[],table+' cross-user delete');
    assert.deepEqual(await ok(viewer.from(table).update({[column]:foreign[column]}).eq(column,foreign[column]).select()),[],table+' cross-user update');
   }
  }
 }
 await denied(a.client.from('document').insert({owner_id:b.profile,language_id:language.id,source_type:'txt',title:'Forged'}));
 await denied(a.client.from('document').update({owner_id:b.profile}).eq('id',fixtures[0].document.id));
 await denied(a.client.from('document').update({owner_id:null,is_included_library:true}).eq('id',fixtures[0].document.id));
 await denied(a.client.from('user_profile').update({auth_user_id:b.auth}).eq('id',a.profile));
 await denied(a.client.from('reading_session').insert({user_id:a.profile,document_id:fixtures[1].document.id}));
 await denied(a.client.from('word_lookup_event').insert({user_id:b.profile,document_id:fixtures[0].document.id,lexeme_id:lexeme.id}));
 await denied(a.client.from('evidence_log').insert({knowledge_confidence_id:fixtures[1].knowledge_confidence.id,event_type:'forged',delta:1}));
 await denied(a.client.from('evidence_log').update({delta:99}).eq('id',fixtures[0].evidence_log.id));
 await denied(a.client.from('evidence_log').delete().eq('id',fixtures[0].evidence_log.id));
 await denied(a.client.from('assessment_response').insert({assessment_id:fixtures[1].assessment.id,item_id:'forged',correct:true,difficulty_at_time:1}));
 await denied(a.client.from('document_lexeme_freq').insert({document_id:shared.id,lexeme_id:lexeme.id,frequency:1}));
 await add('document_lexeme_freq',{document_id:shared.id,lexeme_id:lexeme.id,frequency:1});
 assert.equal((await ok(b.client.from('document_lexeme_freq').select().eq('document_id',shared.id))).length,1);
 const own = await ok(a.client.from('document').insert({owner_id:a.profile,language_id:language.id,source_type:'txt',title:'Editable'}).select().single());
 await ok(a.client.from('document').update({title:'Changed'}).eq('id',own.id));
 assert.equal((await ok(a.client.from('document').delete().eq('id',own.id).select())).length,1);
 await ok(a.client.from('reading_session').insert({user_id:a.profile,document_id:shared.id}));
 assert.equal((await ok(b.client.from('document').select().eq('id',shared.id))).length,1);
 assert.deepEqual(await ok(b.client.from('document').update({title:'Attack'}).eq('id',shared.id).select()),[]);
 const anonymous=client();
 await denied(anonymous.from('document').select());
 const path=a.auth+'/'+suffix+'/source.txt';
 const bucket=a.client.storage.from('my-library');
 await ok(bucket.upload(path,'private test',{contentType:'text/plain'}));
 assert.equal(await (await ok(bucket.download(path))).text(),'private test');
 await denied(b.client.storage.from('my-library').download(path));
 await denied(b.client.storage.from('my-library').createSignedUrl(path,60));
 assert.deepEqual(await ok(b.client.storage.from('my-library').list(a.auth+'/'+suffix)),[]);
 await denied(b.client.storage.from('my-library').upload(path,'overwrite',{upsert:true}));
 await denied(bucket.move(path,b.auth+'/'+suffix+'/stolen.txt'));
 await denied(bucket.upload(b.auth+'/'+suffix+'/forged.txt','forged'));
 await denied(bucket.upload('unscoped-'+suffix+'.txt','unscoped'));
 await ok(b.client.storage.from('my-library').remove([path])); // may return [] under RLS
 assert.equal(await (await ok(bucket.download(path))).text(),'private test');
 await ok(bucket.update(path,'updated',{contentType:'text/plain'}));
 await denied(anonymous.storage.from('my-library').download(path));
 const included=suffix+'/included.txt';
 await ok(admin.storage.from('included-library').upload(included,'shared',{contentType:'text/plain'}));
 for(const u of users) {
  assert.equal(await (await ok(u.client.storage.from('included-library').download(included))).text(),'shared');
  await denied(u.client.storage.from('included-library').upload(included,'bad',{upsert:true}));
  await ok(u.client.storage.from('included-library').remove([included]));
  assert.equal(await (await ok(u.client.storage.from('included-library').download(included))).text(),'shared');
 }
 await denied(anonymous.storage.from('included-library').download(included));
 const publicURL = a.client.storage.from('included-library').getPublicUrl(included).data.publicUrl;
 assert.equal((await fetch(publicURL)).ok,false,'included bucket must not bypass RLS via public URL');
 await ok(bucket.remove([path]));
 await denied(bucket.download(path));
 await ok(admin.storage.from('included-library').remove([included]));
 for (const u of users) await ok(u.client.auth.signOut());
 // Relational fixtures intentionally remain in this isolated test stack because evidence is append-only.
});
