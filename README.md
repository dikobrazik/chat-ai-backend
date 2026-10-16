<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="200" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Database initialization

Schema synchronization is disabled (`synchronize: false`). Apply versioned
migrations before starting an application version that requires schema changes.
The CLI DataSource is `src/database/data-source.ts`; after `npm run build`, the
production file is `dist/src/database/data-source.js`.

```bash
# Generate a migration from entity changes (review its SQL before applying)
npm run migration:generate

# Apply pending migrations locally
npm run migration:run

# Apply compiled migrations in the production image
npm run migration:run:prod
```

Migration files belong in `src/database/migrations/`. There are currently no
schema migrations in this repository: the schema must already exist, or an initial
migration must be created and applied before starting against a new empty database.
The Docker entrypoint runs compiled migrations before starting the application.

`DatabaseSeedService` runs automatically during application initialization, before
the HTTP server accepts requests. In one transaction, it adds missing providers,
models, and promotions, updates existing records by `id`, and creates the
PostgreSQL prompt-search indexes. Fields explicitly present in each seed are
authoritative and overwrite database values on startup. Omitted fields are left
unchanged; an explicit `null` clears a nullable field. Creation timestamps and
existing chat/promotion-usage references are preserved. Records removed from
seed files are not deleted from the database. Changing an ID creates a new record
rather than renaming the old one; provider IDs must remain fixed.
Seed errors abort startup and roll back seed inserts and updates.
The database role must be allowed to install `pg_trgm` (or the extension must
already be installed). Search indexes are excluded from TypeORM synchronization
and created with `IF NOT EXISTS` so they survive subsequent startups.

Seed data lives in `src/database/seeds/`: providers in
`providers/providers.seed.ts`, promotions in `promotions/promotions.seed.ts`, and
models in `models/<provider>/models.seed.ts`. `models/index.ts` combines the
provider catalogs; `DatabaseSeedService` handles the startup transaction.

## Subscription promotions

Startup creates or updates subscription promotions:
`first_subscription` grants 3 trial days to new users, and
`six_months_subscription` provides a 10% discount on a six-month subscription.
Seed-defined fields on existing promotions with these IDs are updated.

## Model catalog

Startup also seeds five providers with the IDs required by the
API handlers: `1=openai`, `2=google`, `3=grok`, `4=deepseek`, `5=claude`.
Provider names are updated by their fixed IDs. A provider name already assigned
to a different ID aborts startup instead of silently changing routing.
Models are created or updated by their string ID; unrelated records are preserved.

| Provider | Model | Minimum user status |
| --- | --- | --- |
| openai | gpt-5.4-mini | active |
| openai | gpt-5.4 | subscription_plus |
| openai | gpt-6-astra | subscription_plus |
| openai | gpt-6.1-sol | subscription_plus |
| openai | gpt-6-luna | subscription_plus |
| openai | gpt-image-2.5-sunburst | subscription_plus |
| openai | gpt-image-2.5-flare | subscription_plus |
| openai | gpt-4o | subscription_plus |
| openai | gpt-4o-mini | guest |
| openai | gpt-image-1-mini | subscription_plus |
| openai | gpt-6-sol | subscription_plus |
| openai | gpt-5.6-sol | subscription_plus |
| openai | gpt-5.6-terra | subscription_plus |
| openai | gpt-5.6-luna | subscription_plus |
| openai | gpt-5.5 | subscription_plus |
| openai | gpt-5.5-pro | subscription_pro |
| openai | gpt-5.4-nano | active |
| openai | gpt-5.2 | subscription_plus |
| openai | gpt-5.1 | subscription_plus |
| openai | gpt-5-mini | active |
| openai | gpt-5 | subscription_plus |
| openai | gpt-4.1-mini | active |
| openai | gpt-4.1-nano | active |
| openai | o3-mini | active |
| openai | gpt-image-2 | subscription_plus |
| openai | gpt-image-1.5 | subscription_plus |
| openai | gpt-image-1 | subscription_plus |
| openai | chatgpt-image-latest | subscription_plus |
| google | gemini-3.8-flash | active |
| google | gemini-4-argon | subscription_plus |
| google | gemini-3.6-flash | active |
| google | gemini-3.5-flash-lite | active |
| google | gemini-3.1-flash-lite | guest |
| google | gemini-nano-banana-2.1 | subscription_plus |
| google | gemini-3.1-flash-image | subscription_plus |
| google | gemini-3.1-flash-lite-image | subscription_plus |
| google | gemini-3.1-pro-preview | subscription_plus |
| google | gemini-3-flash-preview | active |
| google | gemini-2.5-flash | active |
| google | gemini-2.5-flash-image | subscription_plus |
| google | gemini-2.5-flash-lite | active |
| google | gemini-2.5-pro | subscription_plus |
| grok | grok-4.7 | subscription_plus |
| grok | grok-4.6 | subscription_plus |
| grok | grok-4.5 | subscription_plus |
| grok | grok-4.3 | subscription_plus |
| grok | grok-imagine-image-2.0 | subscription_plus |
| grok | grok-imagine-image | subscription_plus |
| grok | grok-imagine-image-quality | subscription_plus |
| deepseek | deepseek-flash | guest |
| deepseek | deepseek-v4-pro | subscription_plus |
| claude | claude-haiku-5-5 | active |
| claude | claude-sonnet-5-5 | subscription_pro |
| claude | claude-fable-5-1 | subscription_pro |
| claude | claude-opus-5-5 | subscription_pro |
| claude | claude-fable-5 | subscription_pro |
| claude | claude-opus-5 | subscription_pro |
| claude | claude-sonnet-5 | subscription_pro |
| claude | claude-opus-4-8 | subscription_pro |
| claude | claude-opus-4-7 | subscription_pro |
| claude | claude-opus-4-6 | subscription_pro |
| claude | claude-sonnet-4-6 | subscription_pro |
| claude | claude-opus-4-5-20251101 | subscription_pro |
| claude | claude-haiku-4-5-20251001 | subscription_plus |

OpenAI models named `gpt-image-*` and `chatgpt-image-latest`, Google models
named `gemini-*-image` or `gemini-nano-banana-2.1`, and Grok models named
`grok-imagine-image*` have `for_image=true`;
all other seeded models have `for_image=false`. OpenAI text mini/nano models are available
from `active` (`gpt-4o-mini` from `guest`), `gpt-5.5-pro` requires `subscription_pro`, and other OpenAI models
require `subscription_plus`. Google text Flash/Flash-Lite models are available
from `active` (`gemini-3.1-flash-lite` from `guest`); Argon, Pro, and Google image models require `subscription_plus`.
All Claude models are text-only; Haiku 5.5 requires `active` and Haiku 4.5 requires `subscription_plus`, while
Sonnet, Opus, and Fable require `subscription_pro`.
All Grok models require `subscription_plus`.
The seed only populates the
catalog; it does not update provider integrations or verify API-key access.
In particular, Claude 5.5 requires adapting the existing manual thinking
configuration before using thinking mode.
Google image generation also needs an integration update: the current handler
uses the Imagen `generateImages` API rather than Gemini image generation.

## Model IDs

Models use stable string IDs in the form `<provider>:<API-model-name>`, for
example `openai:gpt-5.4`. The separate `name` field remains the API model name.
`POST /api/chat` requires a string `model_id`, and model/chat responses also
return string IDs. Numeric IDs are no longer accepted.

The schema and seeds require string model IDs; there is no
automatic conversion of old numeric IDs or existing chat references. Coordinate
the API change with the frontend. Treat IDs as immutable; replacing an API model
should create a new catalog record rather than rename an existing ID.

## User profile

`PATCH /api/user/profile` updates the authenticated user's profile and returns
the updated user. The request accepts any subset of `name` (string, up to 255
characters), `email` (valid email, up to 255 characters), and `mailing_consent`
(boolean). Omitted fields remain unchanged; `null` and unknown fields are rejected.
An email already used by another user returns HTTP 409. Changing the email resets
its verification; subscription status is preserved.

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://kamilmysliwiec.com)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](LICENSE).
