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

Authentication and identity are supplied by the optional `x-identity` module; they do not introduce an `xshell.identity` Core configuration section.

See [Services](../10-architecture/100-services.md) for runtime registrations and configured service contracts.
