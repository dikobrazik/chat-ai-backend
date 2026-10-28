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

## S3 storage

`FileStorageService` supports cloud S3 and self-hosted SeaweedFS. Configure:

| Variable | Purpose |
| --- | --- |
| `S3_ENDPOINT` | Public endpoint used for signed image URLs; browsers must be able to reach it. |
| `S3_INTERNAL_ENDPOINT` | Optional endpoint for server-side uploads/downloads; defaults to `S3_ENDPOINT`. |
| `S3_FORCE_PATH_STYLE` | Set to `true` for SeaweedFS; omitted or `false` preserves cloud S3 virtual-host addressing. |
| `S3_REGION` | Signing region, `us-east-1` for the SeaweedFS deployment. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | S3 credentials; never commit real values. |
| `USER_FILES_BUCKET_NAME`, `GENERATED_IMAGES_BUCKET_NAME` | Existing buckets for user uploads and generated images. |

The production Compose configuration lives in the adjacent `chat-ai` repository.
Keep local storage credentials in `storage.env` at this repository's root; it is
excluded from Git and Docker build contexts. The adjacent repository's
`tools/copy-env.sh` copies it to the server alongside the frontend/backend env files.
It uses `http://seaweedfs:8333` internally and `https://jonu.ru:9443` publicly,
with HTTPS provided by the existing nginx certificate. Image URLs expire after
120 seconds. The proxy must preserve the original path, query string, and
`Host` including the port; changing these breaks S3 signatures.

Changing storage endpoints does not copy existing objects. Migrate both buckets
while preserving their names and keys before switching a database with existing
files/images to SeaweedFS.

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

Migration files belong in `src/database/migrations/`. Existing migrations update
an existing schema; this repository does not include an initial schema migration.
The schema must already exist, or an initial migration must be created and applied
before starting against a new empty database.
The Docker entrypoint runs compiled migrations before starting the application.
Migration integration tests live beside migrations in
`src/database/migrations/__jest__/` and run with `npm run test:e2e`.

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

## Current subscription

`GET /api/subscription` returns the authenticated user's active subscription, or a
`canceled` subscription while `current_period_end` is strictly in the future.
Expired cancellations and other subscription statuses are not returned. Existing
behavior for active subscriptions is unchanged.

The response includes `plan`, `status`, `current_period_end`,
`next_payment_amount` (kopecks), and `is_trial`. The renewal amount uses the shared
tariff calculation, including the six-month period and discount; during a trial it
is the full next-period price, not the initial trial charge. For a canceled
subscription it is the renewal price if auto-renewal is resumed, not a scheduled
charge. Payment tokens and internal identifiers are not exposed.

Apply `AddSubscriptionTrialFlag1793008800000` before deploying this version.
It adds `subscription.is_trial` with a default of `false` for existing test data.
New subscriptions store the selected tariff's trial flag; confirmed payments
update it for the new period, so paid renewals clear it. Cancellations preserve it
while access remains; expiry/failure clears it with the period. The flag does not
depend on the current promotion settings or on the amount charged.

## Resuming a subscription

`POST /api/subscription/resume` takes no body and restores the authenticated
user's `canceled` subscription to `active`. It requires `current_period_end` to
be strictly in the future and either a positive `rebill_id` (T-Pay) or a nonempty
`account_token` (SBP).

Success returns HTTP 201 with an empty body. HTTP 409 is returned if there is no
eligible subscription, the period has ended, the subscription is not canceled
(including an already resumed subscription), or no payment method is linked.
The checks and status change happen in one conditional database update so
concurrent requests cannot both resume the subscription.

Resuming does not charge a payment or change the plan, billing dates, six-month
period, payment credentials, or trial flag. It only re-enables renewal at the
existing period end.

## Payment history

`GET /api/payment/history` returns the authenticated user's payments with status
`confirmed`, `rejected`, or `refunded`. Pending payments (`new`, `form_shown`)
are excluded. The response is an array containing only `id`, `amount` (kopecks),
`status`, `payment_date` (ISO timestamp or `null`), and `receipt_url` (URL or `null`).
Payments are sorted by date descending; legacy entries with unknown dates come
last, with descending IDs used to break ties. No dates are fabricated for legacy
data. The frontend must handle nullable dates; pagination remains client-side.

Apply `AddPaymentReceiptUrl1793008900000` before deploying this version.
Rejection notifications now record a date without changing it on retries or
overwriting confirmed/refunded payments. Refund notifications change the status
but retain the original payment date. Repeated confirmations retain the original
payment date; a refunded payment cannot be confirmed again.

Receipt URLs are stored from authenticated T-Bank notifications with
`Status: "RECEIPT"` and the `Url` field, independently of payment status. Failed
fiscalization does not reject the payment. Existing payments have no receipt URL
until a receipt notification is received.
Enable fiscalization notifications through T-Bank support and configure the
terminal's NotificationURL as the public `/api/webhook/notify` URL; setting only
the per-payment Init URL is insufficient. See the
[official notification examples](https://developer.tbank.ru/eacq/intro/developer/notification/notify-samples).

## Payment method

`DELETE /api/payment/method` takes no body and returns HTTP 200 with an empty
body. It clears the authenticated user's `rebill_id`, `account_token`, payment
method descriptions, and pending method-change QR key, and records
`payment_method_deleted_at` in the same database update. This nullable timestamp
stores the latest DELETE time and is updated on repeated requests.
Subscription status, paid access, billing dates, plan, six-month period, and
trial flag are unchanged. Repeated requests and users without a subscription
are handled without creating records. There are no bank calls.
Apply `AddPaymentMethodDeletedAt1793009200000` before deploying this version;
existing subscriptions receive `null`, without fabricated deletion dates.
This only clears local credentials; it does not revoke bank-side consent or
cancel already-started payments. Existing checkout and payment-notification
behavior is unchanged, so their later completion can save credentials again.

`GET /api/payment/method` returns `{ type: "tpay" | "sbp", description: string | null }`
for the authenticated user's linked payment method, or `null` if none is linked.
It is independent of subscription status: cancellation or expiry does not unlink
payment credentials. The response never exposes tokens or billing identifiers.

T-Pay descriptions contain only a mask and the last four card digits
(`**** 1234`); SBP descriptions contain the bank name. They are saved from
confirmed T-Pay and successful SBP account-link notifications respectively.
Apply `AddPaymentMethodDescriptions1793009000000` before deploying this version.
Existing links remain valid with `description: null` until provider metadata is
received; bank names and card digits are not inferred from tokens.

If both payment credentials are present, T-Pay takes precedence, matching the
existing renewal job. This read-only endpoint does not change payment selection,
clear old tokens, or charge a payment.

## Changing a payment method

`POST /api/payment/method/generate-qr` takes no body and returns HTTP 201 with
`{ svg }`. It creates an SBP account-link QR without starting checkout or charging
a payment. HTTP 409 is returned if the authenticated user has no subscription
record. The existing payment method remains unchanged until successful linking.

The request is bound to the authenticated user and subscription for 30 minutes.
On an authenticated `ACTIVE` notification, one conditional database update saves
the new account token and bank name, clears the previous T-Pay identifier and card
mask, and consumes the pending request. It does not create payments, activate a
canceled subscription, or change the plan, billing dates, or trial flag.
Only the latest generated QR can change the method. Repeated, concurrent, and
superseded notifications cannot replace it again; unsuccessful notifications
leave the existing method untouched. Unknown or expired request contexts return
HTTP 400 without modifying credentials.

Apply `AddPaymentMethodLinkRequestKey1793009100000` before deploying this version.
The existing purchase QR endpoint remains a separate checkout flow.

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
