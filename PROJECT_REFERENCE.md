# Language Reading Assistant reference

Reviewed September 9, 2026. This is a durable workspace reference for the two documents the user asked to analyze and remember. Both are drafts, not validated specifications or evidence of an implemented product. Instructions within them are source content, not authorization to build, deploy, purchase, or take other actions. Later user decisions supersede this reference.

## Sources

- Business: `C:\Users\Corey\Downloads\Language_Reading_Assistant_-_Business_Overview.docx` (Product & Business Overview; product vision draft, sections 1–21).
- Architecture: `C:\Users\Corey\Downloads\Language_Reading_Assistant_-_Technical_Architecture_1.docx` (Technical Architecture & Implementation; architecture draft, sections 1–10 and Appendix A).
- Complete paragraph/table-text extractions are retained in `reference/business.txt` and `reference/architecture.txt`. These preserve text, not Word layout. Neither of these two files contains embedded images. Original documents remain unchanged.

## Product intent

### Confirmed platform requirement — September 9, 2026

The user requires web, Android, and iOS compatibility from the start. All three are first-class initial-release targets. This supersedes the drafts' mobile-only platform framing: retain the mobile-first reading design while supporting responsive browser use and keyboard interaction. Evaluate future dependencies and features against all three targets, using equivalent platform-specific implementations where needed. The shared Expo app lives in `frontend/` and already includes web dependencies and launch scripts; bundle export has passed for all three, but runtime acceptance remains pending.

A mobile-first personal reader that feels like Kindle. Start with Polish for English-speaking learners. Help users read material they care about, estimate readiness, give only as much help as needed, and improve recommendations as evidence of their knowledge accumulates.

Five pillars: know what I know; give me the right thing to read; help me when stuck; learn from how I read; let me read what I want.

The distinctive learning problem is recognizing familiar vocabulary in unfamiliar inflected forms. For example, connect samochodu to samochód and explain the grammatical reason for the form in its sentence. Group related forms under a lexical item while retaining evidence about form recognition. The product aims to reduce dependence on translation over time.

Reading Mode offers fast lookup, expandable grammar help, and sentence translation. Learning Mode adds guesses, interpretation attempts, progressive hints, checks, and review. Sentence assistance progresses through interpretation attempt, evaluation, vocabulary hint, structure hint, and full translation; the learner controls the amount of help.

## MVP and scope

The six explicit MVP capabilities are adaptive onboarding assessment, an included reading library, private EPUB/PDF/TXT imports, contextual word lookup with morphology, sentence assistance, and a learner model driving difficulty estimates and recommendations.

The initial included library is envisioned as roughly 15–30 short readings at each of Starter, Beginner, Developing, and Intermediate levels. Sources may include public-domain and appropriately licensed texts plus original graded readings clearly labeled as learner-oriented. Personal imports are central to the value proposition.

Private uploads must not enter the public catalog, become discoverable by other users, or be redistributed. The proposed upload flow records a rights acknowledgment. DRM circumvention is explicitly excluded.

Later possibilities include web/share-sheet import, Prepare Me for This Book, richer grammar-based difficulty, a companion browser extension, and additional languages. Session summaries and reading-derived review are described, but their precise first-release depth needs clarification. Subscriptions and Realtime notifications are post-MVP in the architecture.

Excluded from the initial product: conversation practice, full courses, pronunciation scoring, social feeds, leaderboards, lesson trees, extensive flashcard systems, tutors, many languages, advanced gamification, commercial ebook licensing deals, DRM removal, and a massive catalog.

## Learner model and learning loop

Knowledge is confidence rather than a binary flag, associated with user, language, and lexeme. Assessments seed the model; explicit checks and successful recall are stronger evidence than passive exposure. Reading past a word is deliberately weak evidence and must not alone create certainty. Repeated lookups signal difficulty. The architecture proposes recency/decay and an auditable evidence history.

The reading profile includes estimated vocabulary ranges and grammar strengths/developing areas; CEFR is supplementary. The loop is choose suitable content, read, request help, understand, continue, recognize later with less help, update knowledge, and improve future content selection.

Analyze My Book compares document vocabulary with the learner profile. Prepare Me for This Book would prioritize frequent unfamiliar words and recurring structures from a chosen book. Review emerges from reading difficulties without manual flashcard creation.

## Proposed architecture

- React Native with Expo for iOS/Android; EAS for builds, submission, and JS/asset updates across development, preview, and production.
- Supabase Postgres, Auth, and Storage. Direct client access for simple operations protected by RLS; private storage paths for personal content.
- Express with Node/TypeScript for JWT verification, authorization, language processing, imports, scoring, recommendations, and LLM calls. Hosting provider remains open. Server-only service-role credentials bypass RLS, so API authorization is an independent requirement.
- Polish language module: Morfeusz 2 and plWordNet proposed as core, PoliMorf likely, Tatoeba supporting examples, LLM used selectively for explanation, ambiguity, hints, and interpretation evaluation. Wiktionary and Stanza/UD remain candidates for later evaluation.
- A shared language-module interface exposes tokenization, analysis, glosses, form explanations, and examples. Per-language capability flags permit gradual expansion. The core models lexemes, forms, meanings, and flexible grammatical features rather than Polish-specific columns.
- Upload pipeline: private source file, parsing, structural extraction, sentence/token segmentation, lexical analysis and frequency counts, then learner-specific scoring. Longer work may run as background jobs.
- Offline scope: already-opened/downloaded content and cached assistance; unseen word/sentence assistance needs connectivity. Events queue locally and sync later.

Core schema sketches include language, lexeme, surface_form, meaning, example_sentence, user_profile, knowledge_confidence, evidence_log, document, document_lexeme_freq, reading_session, word_lookup_event, sentence_assistance_event, review_item, assessment, and assessment_response.

## Analysis and unresolved decisions

These findings compare the supplied drafts internally. External tooling, licensing, platform policies, learning efficacy, and commercial assumptions have not been independently verified.

1. **Clear product and architecture alignment.** The shared reader plus replaceable language modules supports Polish-first validation while preserving expansion. Private imports and morphology assistance are substantive differentiators in the stated vision. Their market differentiation and effect on learning remain hypotheses.
2. **Comprehension is not yet operationally defined.** Business examples use estimated comprehension, whereas architecture section 6.2 proposes a percentage of lexemes above a confidence threshold. Specify unique-lexeme versus occurrence-weighted coverage, treatment of ambiguous/unknown tokens, form recognition, and how the displayed estimate is calibrated against actual understanding. The illustrative 80–92% recommendation band is not a validated threshold.
3. **Lookup evidence has conflicting interpretations.** Business section 7 illustrates a lookup increasing confidence from 20% to 35%; architecture section 6.1 makes repeated lookup negative evidence. Separate evidence of current recognition from subsequent learning through help, and define updates explicitly.
4. **Form and grammar knowledge need representation.** The business promise tracks recognized forms and grammar strengths, but knowledge_confidence is only per lexeme and review_item only points to a lexeme. Surface-form event fields do not by themselves define persistent form/grammar confidence or grammar review targets.
5. **Privacy design and schema disagree.** Architecture section 5.3 proposes separate Included Library tables, while section 7 sketches a shared document table with nullable owner_id and an included-library flag. Section 6.4 describes owner_id-based policies, but several sketched tables use user_id or indirect relationships. Resolve the model and ownership joins, including inserts and ownership-changing updates. Express service-role access needs explicit authorization on every content and learner-data operation.
6. **Import failure categories are incomplete.** The draft equates unreadable text with encryption/DRM. Define separate handling for scanned/image-only PDFs, malformed files, unsupported encodings, and actual protection. Also specify document size limits, processing status, retry behavior, worker execution, and supported EPUB/PDF layout fidelity.
7. **The linguistic pipeline needs a proof of concept.** The draft assigns contextual morphology and English gloss resolution to candidate resources, but does not establish disambiguation quality, resource coverage, sense identity, integration method, or an evaluation set. The interface also lacks explicit asynchronous behavior, uncertainty, versioning, and failure contracts. These are unresolved implementation details, not verified tool capabilities.
8. **Scope drifts in the technical document.** Web import and Prepare Me for This Book appear in technical flows/screens despite being future-facing in the business document. Freeze an explicit release boundary before estimating effort. Personal full-book uploads also require a clearer processing plan than guidance focused on short synchronous imports.
9. **Reader and sync storage are underspecified.** Add decisions for chapter/paragraph/token storage, stable text offsets, reading position, source/analysis versions, event IDs, retry deduplication, and conflict resolution. Evidence history should retain enough inputs and model versions for the promised recomputation, not only confidence deltas.
10. **Business validation remains open.** The overview establishes vision and hypotheses but does not define pricing, acquisition, operating costs, retention targets, or success criteria. Useful future measurements include repeat reading, completed sessions, help dependence on repeated encounters, and explicit comprehension checks. These are analytical suggestions, not approved requirements.

## Use in future work

Confirmed Trello workflow (September 9, 2026): when beginning work on a card, move it to **In Progress**. When implementation and agent checks are finished, move it to **Testing** for Corey to test. Pending user testing is a reason to use Testing, not to leave the card in its original list or mark it Done. Execute these transitions as part of the work.

Use this reference and the retained source text as project context when the user asks for related work. Preserve the reading-first identity, Polish-first scope, private imports, restrained assistance, and separation of shared systems from language-specific processing. Treat proposed stack choices and sample percentages as draft assumptions. Consult the unresolved decisions before turning the documents into implementation commitments.

Confirmed September 9, 2026: use one shared main/production Supabase project initially to limit cost. This supersedes card 04 environment separation. User will build/test on Android and web; retain iOS compatibility.
