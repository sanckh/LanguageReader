-- Resolve Auth identities through the application profile UUID.
grant select, insert on public.user_profile to authenticated;
create policy profile_read on public.user_profile for select to authenticated
 using (auth_user_id = (select auth.uid()));
create policy profile_create on public.user_profile for insert to authenticated
 with check (auth_user_id = (select auth.uid()));
-- Profile identity is immutable to clients; no UPDATE/DELETE grants.

grant select, insert, update, delete on public.document to authenticated;
create policy document_read on public.document for select to authenticated using (is_included_library or exists (select 1 from public.user_profile p where p.id = document.owner_id and p.auth_user_id = (select auth.uid())));
create policy document_insert on public.document for insert to authenticated with check (not is_included_library and exists (select 1 from public.user_profile p where p.id = document.owner_id and p.auth_user_id = (select auth.uid())));
create policy document_update on public.document for update to authenticated using (not is_included_library and exists (select 1 from public.user_profile p where p.id = document.owner_id and p.auth_user_id = (select auth.uid()))) with check (not is_included_library and exists (select 1 from public.user_profile p where p.id = document.owner_id and p.auth_user_id = (select auth.uid())));
create policy document_delete on public.document for delete to authenticated using (not is_included_library and exists (select 1 from public.user_profile p where p.id = document.owner_id and p.auth_user_id = (select auth.uid())));

grant select, insert, update, delete on public.knowledge_confidence to authenticated;
create policy knowledge_confidence_read on public.knowledge_confidence for select to authenticated using (exists (select 1 from public.user_profile p where p.id = knowledge_confidence.user_id and p.auth_user_id = (select auth.uid())));
create policy knowledge_confidence_insert on public.knowledge_confidence for insert to authenticated with check (exists (select 1 from public.user_profile p where p.id = knowledge_confidence.user_id and p.auth_user_id = (select auth.uid())));
create policy knowledge_confidence_update on public.knowledge_confidence for update to authenticated using (exists (select 1 from public.user_profile p where p.id = knowledge_confidence.user_id and p.auth_user_id = (select auth.uid()))) with check (exists (select 1 from public.user_profile p where p.id = knowledge_confidence.user_id and p.auth_user_id = (select auth.uid())));
create policy knowledge_confidence_delete on public.knowledge_confidence for delete to authenticated using (exists (select 1 from public.user_profile p where p.id = knowledge_confidence.user_id and p.auth_user_id = (select auth.uid())));

grant select, insert, update, delete on public.review_item to authenticated;
create policy review_item_read on public.review_item for select to authenticated using (exists (select 1 from public.user_profile p where p.id = review_item.user_id and p.auth_user_id = (select auth.uid())));
create policy review_item_insert on public.review_item for insert to authenticated with check (exists (select 1 from public.user_profile p where p.id = review_item.user_id and p.auth_user_id = (select auth.uid())));
create policy review_item_update on public.review_item for update to authenticated using (exists (select 1 from public.user_profile p where p.id = review_item.user_id and p.auth_user_id = (select auth.uid()))) with check (exists (select 1 from public.user_profile p where p.id = review_item.user_id and p.auth_user_id = (select auth.uid())));
create policy review_item_delete on public.review_item for delete to authenticated using (exists (select 1 from public.user_profile p where p.id = review_item.user_id and p.auth_user_id = (select auth.uid())));

grant select, insert, update, delete on public.assessment to authenticated;
create policy assessment_read on public.assessment for select to authenticated using (exists (select 1 from public.user_profile p where p.id = assessment.user_id and p.auth_user_id = (select auth.uid())));
create policy assessment_insert on public.assessment for insert to authenticated with check (exists (select 1 from public.user_profile p where p.id = assessment.user_id and p.auth_user_id = (select auth.uid())));
create policy assessment_update on public.assessment for update to authenticated using (exists (select 1 from public.user_profile p where p.id = assessment.user_id and p.auth_user_id = (select auth.uid()))) with check (exists (select 1 from public.user_profile p where p.id = assessment.user_id and p.auth_user_id = (select auth.uid())));
create policy assessment_delete on public.assessment for delete to authenticated using (exists (select 1 from public.user_profile p where p.id = assessment.user_id and p.auth_user_id = (select auth.uid())));

grant select, insert, update, delete on public.reading_session to authenticated;
create policy reading_session_read on public.reading_session for select to authenticated using (exists (select 1 from public.user_profile p where p.id = reading_session.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = reading_session.document_id));
create policy reading_session_insert on public.reading_session for insert to authenticated with check (exists (select 1 from public.user_profile p where p.id = reading_session.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = reading_session.document_id));
create policy reading_session_update on public.reading_session for update to authenticated using (exists (select 1 from public.user_profile p where p.id = reading_session.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = reading_session.document_id)) with check (exists (select 1 from public.user_profile p where p.id = reading_session.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = reading_session.document_id));
create policy reading_session_delete on public.reading_session for delete to authenticated using (exists (select 1 from public.user_profile p where p.id = reading_session.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = reading_session.document_id));

grant select, insert, update, delete on public.word_lookup_event to authenticated;
create policy word_lookup_event_read on public.word_lookup_event for select to authenticated using (exists (select 1 from public.user_profile p where p.id = word_lookup_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = word_lookup_event.document_id));
create policy word_lookup_event_insert on public.word_lookup_event for insert to authenticated with check (exists (select 1 from public.user_profile p where p.id = word_lookup_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = word_lookup_event.document_id));
create policy word_lookup_event_update on public.word_lookup_event for update to authenticated using (exists (select 1 from public.user_profile p where p.id = word_lookup_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = word_lookup_event.document_id)) with check (exists (select 1 from public.user_profile p where p.id = word_lookup_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = word_lookup_event.document_id));
create policy word_lookup_event_delete on public.word_lookup_event for delete to authenticated using (exists (select 1 from public.user_profile p where p.id = word_lookup_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = word_lookup_event.document_id));

grant select, insert, update, delete on public.sentence_assistance_event to authenticated;
create policy sentence_assistance_event_read on public.sentence_assistance_event for select to authenticated using (exists (select 1 from public.user_profile p where p.id = sentence_assistance_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = sentence_assistance_event.document_id));
create policy sentence_assistance_event_insert on public.sentence_assistance_event for insert to authenticated with check (exists (select 1 from public.user_profile p where p.id = sentence_assistance_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = sentence_assistance_event.document_id));
create policy sentence_assistance_event_update on public.sentence_assistance_event for update to authenticated using (exists (select 1 from public.user_profile p where p.id = sentence_assistance_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = sentence_assistance_event.document_id)) with check (exists (select 1 from public.user_profile p where p.id = sentence_assistance_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = sentence_assistance_event.document_id));
create policy sentence_assistance_event_delete on public.sentence_assistance_event for delete to authenticated using (exists (select 1 from public.user_profile p where p.id = sentence_assistance_event.user_id and p.auth_user_id = (select auth.uid())) and exists (select 1 from public.document d where d.id = sentence_assistance_event.document_id));

grant select, insert on public.evidence_log to authenticated;
create policy evidence_log_read on public.evidence_log for select to authenticated using (exists (select 1 from public.knowledge_confidence k where k.id = evidence_log.knowledge_confidence_id));
create policy evidence_log_insert on public.evidence_log for insert to authenticated with check (exists (select 1 from public.knowledge_confidence k where k.id = evidence_log.knowledge_confidence_id));

grant select, insert, update, delete on public.assessment_response to authenticated;
create policy assessment_response_read on public.assessment_response for select to authenticated using (exists (select 1 from public.assessment a where a.id = assessment_response.assessment_id));
create policy assessment_response_insert on public.assessment_response for insert to authenticated with check (exists (select 1 from public.assessment a where a.id = assessment_response.assessment_id));
create policy assessment_response_update on public.assessment_response for update to authenticated using (exists (select 1 from public.assessment a where a.id = assessment_response.assessment_id)) with check (exists (select 1 from public.assessment a where a.id = assessment_response.assessment_id));
create policy assessment_response_delete on public.assessment_response for delete to authenticated using (exists (select 1 from public.assessment a where a.id = assessment_response.assessment_id));

grant select, insert, update, delete on public.document_lexeme_freq to authenticated;
create policy document_lexeme_freq_read on public.document_lexeme_freq for select to authenticated using (exists (select 1 from public.document d where d.id = document_lexeme_freq.document_id));
create policy document_lexeme_freq_insert on public.document_lexeme_freq for insert to authenticated with check (exists (select 1 from public.document d where d.id = document_lexeme_freq.document_id and not d.is_included_library));
create policy document_lexeme_freq_update on public.document_lexeme_freq for update to authenticated using (exists (select 1 from public.document d where d.id = document_lexeme_freq.document_id and not d.is_included_library)) with check (exists (select 1 from public.document d where d.id = document_lexeme_freq.document_id and not d.is_included_library));
create policy document_lexeme_freq_delete on public.document_lexeme_freq for delete to authenticated using (exists (select 1 from public.document d where d.id = document_lexeme_freq.document_id and not d.is_included_library));


