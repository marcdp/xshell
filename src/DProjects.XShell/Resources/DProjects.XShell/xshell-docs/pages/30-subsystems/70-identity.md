# Identity

The optional `x-identity` module registers `principal`, `signin`, and `session` services. This remains module functionality rather than a global
XShell Core identity subsystem; there is no `xshell.identity` configuration surface or `idp` resolver.

## Principal

Principal is browser-side application state synchronized from the authoritative server session. It is not proof of backend authentication or an
authorization boundary.

```text
principal.identities
principal.identity
principal.isAuthenticated
principal.status
```

`identities` is a defensive, read-only snapshot. Each identity has `authenticationType` and a read-only claims array. Empty Principal is anonymous;
an identity is authenticated when `authenticationType` is a non-empty string, and Principal is authenticated when at least one identity is. An
authentication-method claim remains an ordinary claim and is not substituted for `authenticationType`.

`status` distinguishes `initializing`, `anonymous`, `authenticated`, and `error`. Startup restores the current server session before initial module
UI is presented, with a bounded request so an unavailable identity server cannot block XShell indefinitely. Effective changes emit
`x-identity:principal:changed` with `isAuthenticated` and `status`.

The public methods remain `hasClaim`, `isInRole`, `setIdentities`, and `clear`; `setInitializing` and `setError` support explicit session lifecycle
transitions. `isInRole` uses the .NET role claim URI.

## Account UI

The Account Page preserves multiple identities but displays only an explicit allowlist of identity, name, email, and role claims. Unknown claims,
session identifiers, credentials, secrets, and tokens are not displayed. The Account and Shortcuts Pages expose retry UI for session retrieval
errors. Logout delegates to the Session service and never clears Principal when server logout fails.

## Related documentation

- [Subsystems](index.md)
- [Authentication](60-authentication.md)
