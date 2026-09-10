# Project requirements and workflow

- Support web, Android, and iOS from the initial release. Treat all three as first-class targets when selecting dependencies, implementing features, and validating changes.
- Trello workflow (explicit user instruction, September 9, 2026): move the card to **In Progress** when beginning work. Once implementation and agent checks are finished, move it to **Testing** so Corey can test it. Do not leave implemented cards in the backlog while awaiting user testing. Do not mark them Done merely because implementation is finished.
- Board: https://trello.com/b/4RMUkRvq/language-reader
- Read `PROJECT_REFERENCE.md` when available for retained product context and user decisions.
- Canonical local checkout: C:\Programming\LanguageReader. Shared web, Android, and iOS app code lives in frontend/.
- Supabase: use ONE shared main/production project for now to limit cost (user decision September 9, 2026), superseding card 04 separate-project criteria. Do not provision extra environments. Android and web are current user test targets; retain iOS compatibility.

## Coding conventions

- Shared types live in dedicated folders, in both `frontend/src` and `backend/src`: `interfaces/` for contract and DTO shapes (the shapes crossing the API boundary), and `models/` for domain models and unions. Never declare a domain interface, DTO, or model type inline in a component, screen, route, or service — import it from `interfaces/` or `models/`. (Small React prop bags for a single presentational component are not domain types and may stay local.)
- Keep comments to the minimum necessary: explain a non-obvious reason or constraint, never narrate what the code plainly does.
