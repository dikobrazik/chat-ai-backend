# Copilot instructions

## Commands

- Install dependencies: `npm ci` (CI) or `npm install` (local development).
- Build: `npm run build`.
- Lint: `npm run lint`. This command runs ESLint with `--fix`, so it modifies files.
- Format: `npm run format`. This command also writes changes.
- Generate a migration from entity changes: `npm run migration:generate`.
- Run migrations: `npm run migration:run`.
- Run compiled migrations: `npm run migration:run:prod`.
- Revert the latest migration: `npm run migration:revert`.
- Run all unit tests: `npm test`.
- Run one unit spec: `npx jest src/path/to/file.spec.ts --runInBand`.
- Run all E2E tests: `npm run test:e2e -- --runInBand`.
- Run one E2E spec: `npx jest --config test/jest-e2e.json test/path/to/file.e2e-spec.ts --runInBand`.

E2E payment tests use `@testcontainers/postgresql`, require a running Docker daemon, and require Node.js `>=22.22`. The GitHub Actions workflow uses Node 22.22.0.

## Architecture

- This is a NestJS/TypeScript REST backend. `src/main.ts` configures validation with transformation, cookie parsing, CORS, and the global `/api` route prefix. `AppModule` assembles the application.
- PostgreSQL is accessed through TypeORM with `synchronize: false`. Use versioned migrations for schema changes; the CLI DataSource is `src/database/data-source.ts`, compiled to `dist/src/database/data-source.js`. Both the app and CLI must register the same entities. The CLI uses relative entity imports so it works in the production image without TypeScript path aliases. `DatabaseSeedService` upserts providers, models, and promotions by ID and creates PostgreSQL prompt-search indexes before the application starts accepting requests; required tables must already exist. Fields present in each seed overwrite database values; omitted fields and unrelated records are preserved. Seeds do not delete records. Seed errors abort startup and roll back data changes. Entity columns and database-facing fields use snake_case.
- Model IDs are stable strings in the form `provider:API-model-name`; `Model.name` remains the name sent to the provider API. `Chat.model_id` and the create-chat DTO use string IDs.
- The main domains are auth and sessions, chats/prompts and AI model providers, files, promotions/tariffs, payments, and subscriptions.
- The payment flow is shared across T-Pay and SBP. `SubscriptionService` persists the subscription, `BasePaymentService` persists the payment, and `TinkoffKassaService` performs the external requests. T-Pay creates a payment link; SBP stores request parameters in cache, then completes the flow when the account-link webhook arrives.
- `TariffService` calculates tariff prices independently of a payment provider. `PaymentAmountService` owns provider-specific charge rules: a trial with `freeDays` costs `10 ₽` through SBP and `1 ₽` through T-Pay.
- `WebhookService` validates the Tinkoff token before processing notifications. Confirmed payment webhooks update `Payment`, `Subscription`, and `User` together; an `ACTIVE` account-link webhook delegates to `SbpPaymentService`.
- `SubscriptionCheckService` runs scheduled renewal checks: subscriptions with `rebill_id` charge through T-Pay, those with `account_token` charge through SBP, and subscriptions with neither are expired and reset on the user.

## Repository conventions

- Use absolute imports rooted at `src/` for application code. Jest maps this alias in both unit and E2E configurations.
- Services generally use property injection (`@Inject` and `@InjectRepository`) rather than constructor injection. Preserve that pattern when modifying existing services.
- Define request DTOs with `class-validator` and `class-transformer`; controllers receive typed DTOs and authenticated users through custom decorators such as `@User()` and `@Chat()`.
- Authentication is enforced globally by `JwtAuthGuard`; endpoints or controllers that do not require it use `@Public()`. Chat routes add `ChatGuard`, `PublicChatGuard`, or `ModelGuard` according to ownership, visibility, and tariff access.
- Place unit specs beside their domain in `__jest__/` directories. Use `@suites/unit` `TestBed.solitary()` and `Mocked<T>`; mock TypeORM repositories via `getRepositoryToken(Entity)`.
- Keep test names in Russian. Reset mocks between tests. For date-dependent logic, use Jest fake timers and a fixed clock.
- Put database integration tests under `test/` with the `.e2e-spec.ts` suffix. Migration integration tests live beside migrations in `src/database/migrations/__jest__/`, use the same suffix, and are included by `test/jest-e2e.json`. Start an isolated `PostgreSqlContainer`; application tests use `TypeOrmModule` with `synchronize: true` and only the entities needed by the scenario, while migration tests use a `DataSource` against the pre-migration schema with synchronization disabled. Mock external payment APIs and close database connections and containers in teardown.
