- look all components and look if improvement of ui and usage of layout primitives etc

- finegrain app layer -> seo and consistency!

- i18n translations work bout not for our external data might also need translation but because its dynamic we need like google translator or sth like this

- quick link,location skeleton?

- client.ts missing in map module

- default Open Graph image (the favicon exists)

- ability to disable ratelimiting (only possible in dev)

- export const SMART_CITY_CATEGORIES = ['sustainability', 'mobility', 'energy', 'other'] as const;
  not good approach i think

- pagination in data-sources how to know from api the limit? (look in docs or what)

- live monitoring of data sources and datasets. they could change format which breaks our system

- media storage

- legal pages

- scripts

- website delete and page delete/edit and page

- color palette previews

- confirm dialog everywhere where uload guard?

- ci only validate docker image no generate and migration but idk how to handle it because of standalone setting

- navbar is loaded shortly and then got to sign in panel

- Update-Verlauf always one step behind

- release "Veröffentlicht von einem ehemaligen Mitglied" but i am logged in currently when i did this release?!?

- details in component verlauf ui improvement

- component updates conflicts > redirect to the causing elements on builder and highlight?

- pre-commit and setup command

## Open from the architecture review

- Brand repository into `website` (cycle `booking → website → builder → component-platform → booking` blocks it): make `website` stop depending on `builder`.
  - A) Provision the home page lazily when the builder first opens a website (small; loses atomic create + rollback). Recommended.
  - B) Keep it atomic and move the orchestration up a level (bigger refactor).
  - Afterwards: booking mail should use the published theme colour, not the draft one.
- Map: zoom/pan driven loading. Needs a bounding-box parameter in the data-source pagination strategies; offset alone cannot express "another place".
- Verify against a real database and mail server (nothing ran here): invitation flow end to end, SMTP with `MAIL_SMTP_USER`/`MAIL_SMTP_PASSWORD`, user directory query, employee scoping, `npm run test:integration`.
- Chart windows for the other dataset-scale components (donut, dashboard grid); only the trend chart has zoom/pan today.
- Window semantics: category filter runs inside the window; consider fetching more when a category is set.
- E2E tests for critical journeys: accept invitation, employee calendar, chart zoom/pan.
- Replace `docker-compose.yml` hardcoded demo secrets (DB password, `AUTH_SECRET`) with env interpolation.
- Rerender issue when hovering over component palette for preview
