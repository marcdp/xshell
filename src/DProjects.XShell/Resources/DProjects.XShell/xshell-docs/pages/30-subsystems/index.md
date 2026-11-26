# Subsystems

Implemented V0 runtime capabilities:

- [Areas](10-areas.md) — Module menus, routes, and navigation homes.
- [Bus](20-bus.md) — Asynchronous application messages.
- [Dialogs](30-dialogs.md) — Helpers and results from dialog Pages.
- [i18n](40-i18n.md) — Language configuration, translations, and date/time formatting.
- [Temp](50-temp.md) — Upload/download identifiers and server cleanup.
- [Authentication](60-authentication.md) — Optional server-driven sign-in and cookie-backed session endpoints.
- [Identity](70-identity.md) — Optional Principal state synchronized from the authoritative server session.
- [Tasks](80-tasks.md) — Asynchronous execution, reporting, cancellation, ownership, and global visibility.
- [Commands](90-commands.md) — Command resolution, argument validation, and Task-backed execution.
- [Queries](95-queries.md) — Read-only operations with validated arguments and results.
- [Secrets](100-secrets.md) — Browser-local envelope encryption with password and passkey unlocking.
- [Preferences](110-preferences.md) — Browser-local structured-clone settings persisted with IndexedDB.
- [Stores](120-stores.md) — Provider-independent, schema-described JSON document collections.
- [Filesystems](130-filesystems.md) — Filesystem actions, file editor selection, and declarative editor contributions.
- [Search](140-search.md) — Lazy federated provider discovery, ranking, cancellation, and failure isolation.

Authentication and identity are supplied by the optional `x-identity` module; they do not introduce an `xshell.identity` Core configuration section.

See [Services](../10-architecture/100-services.md) for runtime registrations and configured service contracts.
