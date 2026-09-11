import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";

test("SDK: imported books are atomic, repeatable and service-role managed", async () => {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const status = JSON.parse(execFileSync(process.execPath, ["supabase/node_modules/supabase/dist/supabase.js", "status", "-o", "json"], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  })) as Record<string, string>;
  assert.equal(status.API_URL, "http://127.0.0.1:55321");
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(status.API_URL!, status.SERVICE_ROLE_KEY!, options);
  const user = createClient(status.API_URL!, status.ANON_KEY!, options);
  const anonymous = createClient(status.API_URL!, status.ANON_KEY!, options);
  const email = `${randomUUID()}@example.test`, password = randomUUID();
  const created = await admin.auth.admin.createUser({email,password,email_confirm:true});
  assert.equal(created.error,null);
  let documentId: string | undefined;
  try {
    assert.equal((await user.auth.signInWithPassword({email,password})).error,null);
    const payload = {
      book: {slug:`sdk-${randomUUID()}`,title:'SDK test',authors:['Author'],translators:[],word_count:2,license:'Test only',source_notice:'Test only'},
      sections: [{kind:'paragraph',body:'Test text'}], refresh:false,
    };
    const result = await admin.rpc('import_wolne_lektury_book',payload);
    assert.equal(result.error,null);
    documentId = result.data.id as string;
    const read = await user.from('document').select('id,title,authors,language!inner(code)').eq('status','ready').eq('id',documentId).single();
    assert.equal(read.error,null);
    assert.deepEqual(read.data?.authors,['Author']);
    const before = await user.from('document_section').select().eq('document_id',documentId);
    assert.equal(before.error,null);
    assert.equal((await admin.rpc('import_wolne_lektury_book',payload)).data.action,'unchanged');
    assert.deepEqual((await user.from('document_section').select().eq('document_id',documentId)).data,before.data);
    assert.ok((await anonymous.rpc('import_wolne_lektury_book',payload)).error);
    assert.ok((await user.rpc('import_wolne_lektury_book',payload)).error);
    assert.ok((await anonymous.from('document').select().eq('id',documentId)).error);
    assert.deepEqual((await user.from('document').update({title:'Attack'}).eq('id',documentId).select()).data,[]);
    assert.ok((await admin.rpc('import_wolne_lektury_book',{...payload,sections:[{kind:'paragraph',body:'Changed'}]})).error);
    assert.ok((await admin.rpc('import_wolne_lektury_book',{...payload,refresh:true,sections:[{kind:'invalid',body:'Bad'}]})).error);
    assert.deepEqual((await user.from('document_section').select().eq('document_id',documentId)).data,before.data);
    const refresh = await admin.rpc('import_wolne_lektury_book',{...payload,refresh:true,sections:[{kind:'paragraph',body:'New edition'}]});
    assert.equal(refresh.error,null);
    assert.equal(refresh.data.action,'refreshed');
  } finally {
    if(documentId) await admin.from('document').delete().eq('id',documentId);
    await user.auth.signOut();
    await admin.auth.admin.deleteUser(created.data.user!.id);
  }
});
