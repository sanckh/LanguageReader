# Project requirements and workflow

- Support web, Android, and iOS from the initial release. Treat all three as first-class targets when selecting dependencies, implementing features, and validating changes.
- Trello workflow (explicit user instruction, September 9, 2026): move the card to **In Progress** when beginning work. Once implementation and agent checks are finished, move it to **Testing** so Corey can test it. Do not leave implemented cards in the backlog while awaiting user testing. Do not mark them Done merely because implementation is finished.
- Board: https://trello.com/b/4RMUkRvq/language-reader
- Read `PROJECT_REFERENCE.md` when available for retained product context and user decisions.
- Canonical local checkout: C:\Programming\LanguageReader. Shared web, Android, and iOS app code lives in frontend/.
- Supabase: use ONE shared main/production project for now to limit cost (user decision September 9, 2026), superseding card 04 separate-project criteria. Do not provision extra environments. Android and web are current user test targets; retain iOS compatibility.
