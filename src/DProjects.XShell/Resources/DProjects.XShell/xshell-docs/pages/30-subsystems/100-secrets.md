# Secrets

The framework-owned `secrets` service stores named JSON-compatible values in a browser-local encrypted vault. Its default implementation is
`xshell/services/secrets.js`, its contract is `xshell/contracts/secrets.json`, and XShell Core registers it through `xshell.services.secrets`.
The management Page is `x/pages/secrets.js`; the dedicated initialization and unlock Page is `x/pages/secrets-unlock.js`.

Secrets V2 uses envelope encryption. Vault creation generates a random 256-bit data encryption key (DEK). The DEK, imported as a non-extractable
AES-GCM key for the active session, encrypts every secret. Each secret record has a fresh random 96-bit IV, authenticated ciphertext containing the
JSON value, and additional authenticated data that binds the ciphertext to its immutable UUID and V2 purpose. Its optional description and custom
label are encrypted independently with fresh IVs and distinct authenticated-data purposes. UUID-bound encryption lets a name change without
decrypting or re-encrypting the value or other encrypted metadata.

The master password does not encrypt individual secrets. PBKDF2-SHA-256 derives a key encryption key (KEK) from the password, a random 128-bit salt,
and 600,000 iterations. That KEK authenticates and decrypts one password-wrapped copy of the random DEK. The password mechanism is always retained
as the vault recovery path when passkeys are added or removed.

During first-time vault creation, the authentication Page offers **Set up a default passkey** when the secure browser context exposes both WebAuthn
credential creation and retrieval. The checkbox is selected by default. After the master-password vault is initialized and the selected **Keep
unlocked** policy is established, the Page automatically attempts enrollment with the label **This device** and description **Use this device to
unlock the vault.** The Page retains the initialization password in private controller closure state only for this optional step because
`addPasskey()` reauthenticates against the master password; it does not expose the password through reactive Page state or the dialog result.

The checkbox can be cleared to finish without enrollment. If automatic registration is cancelled or fails, the initialized vault remains intact
and the Page exposes **Create passkey** for a user-initiated retry and **Not now** to finish without one. A separate click can be necessary in browser
environments that require fresh user activation for `navigator.credentials.create()`. Automatic enrollment is therefore a best-effort convenience,
not a guarantee. The master password remains the permanent recovery method whether or not a passkey is enrolled.

## Lifecycle and API

Construction remains synchronous while IndexedDB discovery and an eligible remembered-session restoration attempt are asynchronous. Consumers can
use `await secrets.ready()` to wait for both and read the resulting `uninitialized`, `locked`, or `unlocked` status. Restoration does not derive a
password key or invoke WebAuthn. `restoreSession()` is an idempotent explicit attempt and reports whether it restored access.

```js
await secrets.ready();
await secrets.initialize({ password });
await secrets.unlock({ password });
await secrets.unlock({ password, rememberMinutes: 60 });
await secrets.unlockWithPasskey({ id }); // id may be omitted for browser selection
await secrets.unlockWithPasskey({ id, rememberMinutes: 60 });
const expiration = secrets.sessionExpiresAt; // ISO 8601 UTC string or null

await secrets.set("api-token", "secret", { label: "Production token", description: "Production API token" });
const token = await secrets.get("api-token");
const tokenWithoutPrompt = await secrets.get("api-token", { interactive: false });
const info = await secrets.getInfo("api-token"); // includes immutable id, name, effective label, timestamps, and revision
const entries = await secrets.list(); // the same metadata for every secret
await secrets.rename("api-token", "api-token-production");
await secrets.delete("api-token-production");

const registration = await secrets.addPasskey({ label: "Laptop", password, description: "Work computer" });
const registrations = await secrets.listPasskeys();
await secrets.updatePasskey(registration.id, { description: "Primary workstation" });
await secrets.removePasskey(registration.id);
secrets.lock();
```

Secret CRUD and metadata access, passkey enrollment, passkey metadata updates, and passkey removal require an unlocked vault. `get()` is the one
operation that can authenticate transparently: after the remembered-session restoration attempt, it opens the configured Page when the vault is
locked or uninitialized, waits for initialization or unlocking, verifies the actual Service status, and continues the original lookup. A missing
secret still returns `undefined`, including after creating an empty vault. Cancellation rejects with an `AbortError`; it is never represented by
`undefined`. Pass `{ interactive: false }` in automated Tasks, background work, or any call path where UI must not appear. Other methods retain their
existing non-interactive unlock requirement.

Concurrent interactive `get()` calls share one authentication dialog and resume independently, so each caller receives the value for its own name.
Cancellation rejects every caller waiting on that dialog. The pending attempt is cleared after success, cancellation, or load failure, and a later
request may open a new dialog. A non-interactive caller neither opens nor joins an interactive attempt. Expiration and epoch checks run again before
and during decryption, so authentication success cannot make a later lock or expiration return plaintext.

Each secret has three distinct identity fields. `id` is an immutable UUID generated with `crypto.randomUUID()` and used as the IndexedDB primary
key and encryption identity. `name` is the required, unique, case-sensitive identifier used by `set()`, `get()`, `getInfo()`, `rename()`, and
`delete()`. `label` is a non-unique display value. A missing or cleared custom label falls back to the current name; a custom label survives a
rename. Labels cannot retrieve secrets. Renaming removes the old name without creating an alias, so application references to it must be updated.

`getInfo()` and `list()` return `id`, `name`, the effective decrypted `label`, decrypted `description`, immutable `createdAt`, latest `modifiedAt`,
and current `revision`, without secret values. A new secret receives one timestamp for both `createdAt` and `modifiedAt` and starts at revision `1`.
Every successful `set()` preserves `id` and `createdAt`, replaces `modifiedAt`, and increments the revision exactly once, even when the value is
unchanged. A successful `rename()` also updates `modifiedAt` and increments the revision; renaming to the current name is a no-op. Renaming to a
name owned by another secret fails atomically without changing either record.

Descriptions default to an empty string. Passing `{ description }` or `{ label }` to `set()` changes that encrypted field; omitting a field
preserves it. An empty description clears the description, while an empty label removes the custom label and restores name fallback.

Revisions are current metadata, not stored historical versions. The Secrets service provides no revision history, rollback, or optimistic-
concurrency guarantee. Callers cannot supply ids, timestamps, or revisions through `set()` options.

`listPasskeys()` is safe while locked and returns only `id`, `label`, `description`, and `createdAt`. `addPasskey()` intentionally requires the
master password as well as an unlocked session. It reauthenticates the password-wrapped DEK and creates another wrapping without exporting the
active non-extractable DEK. A wrong password fails before registration. `updatePasskey()` changes only the description; it does not invoke WebAuthn
or alter the label, creation time, PRF salt, or wrapped DEK.

`lock()` immediately invalidates the session epoch, clears the active DEK reference, revokes the current tab's remembered material, and aborts
active IndexedDB writes. Operations verify the epoch after asynchronous cryptographic, WebAuthn, and storage work so a late completion cannot
restore an unlocked session. `secrets:status-changed` reports lifecycle changes and the current `sessionExpiresAt` on the Bus. Leaving the Secrets
Page clears its password, decrypted value, and secret-description editor state but does not lock the Service; Lock remains an explicit security
action. The Secrets Manager delegates initialization and unlocking to the dedicated authentication Page while retaining secret CRUD, passkey
management, metadata display, and explicit Lock. The authentication Page calls only `ready()`, `listPasskeys()`, `initialize()`, `addPasskey()`,
`unlock()`, and `unlockWithPasskey()`; it never calls `get()`, so transparent authentication cannot recurse. Passwords, keys, and secret values are
neither Page context nor dialog results. The Page closes with only `{ unlocked: true }`, and the Service treats that as a UI result rather than
proof of access.

## Unlock-session policy

`page` is a Secrets implementation option using the ordinary Service options mechanism. The framework's headless default is `null`, so applications
without the `x` UI module never prompt. The `x` module supplies the default UI Page when it participates in the application:

```jsonc
"xshell": {
    "services": {
        "secrets": {
            "options": {
                "page": "page:x:/pages/secrets-unlock.js",
                "rememberMinutes": 0,
                "maxRememberMinutes": 43200
            }
        }
    }
}
```

Set `page: null` to disable automatic dialogs. A non-null value must be a Page resource reference. The Service does not hardcode or navigate to an
`x` resource; it asks the existing Dialog Service to open the configured Page with an empty context. A configured Page is an interaction policy,
not an authorization boundary for same-origin Services.

Memory-only sessions are the most restrictive mode. `rememberMinutes: 0` keeps the non-extractable DEK only in the current JavaScript process, does
not create session material, and requires password or passkey authentication after an application reload. Both duration values default to zero when
omitted.

The authentication Page shows the **Keep unlocked** selector during both vault creation and later password or passkey authentication. During vault
creation, zero leaves the session memory-only. A positive selection initializes the vault and then establishes the requested remembered session
before optional passkey enrollment begins. If remembered-session establishment fails, the vault metadata remains initialized but the Page returns
to locked authentication so the user can retry; it does not report successful completion with a silently different policy.

`xshell.services.secrets.options.rememberMinutes` is the default used when an unlock call omits a duration. `maxRememberMinutes` in the same options
object is the application-enforced maximum. Both are nonnegative integer minutes, are limited to 43,200 (30 days), and `rememberMinutes` cannot exceed
`maxRememberMinutes`. Zero maximum disables persistence. An application that allows an optional one-hour session overrides the service options:

```jsonc
"services": {
    "secrets": {
        "options": {
            "rememberMinutes": 0,
            "maxRememberMinutes": 43200
        }
    }
}
```

Setting both values to `60` remembers successful unlocks for one hour by default. A caller may explicitly request any permitted integer duration;
values above the maximum fail rather than being clamped. The authentication Page offers session-only, 15-minute, and 60-minute choices when
allowed, plus a configured non-preset default.

A positive duration creates a remembered session with an absolute expiration. Reloading or using secrets never extends it. A timer updates state
promptly while per-operation checks enforce expiration after tab suspension or delayed timers. Expiration and explicit Lock invalidate the epoch,
abort active writes, discard the active key, remove the tab metadata, and delete its session-key record.

Remembered metadata is stored in `sessionStorage`, so restoration is scoped to the current browser tab under normal browser behavior. Each tab has
its own session id and wrapping key record. Explicit Lock revokes the current tab's remembered session; it does not synchronize unlocked state to
other tabs. Browser tab duplication and session restoration policies vary, so tab closure must not be treated as a cryptographic revocation event.

## Passkey wrapping

Passkey enrollment and unlocking require a secure origin, user verification, WebAuthn, and a credential/authenticator combination that implements
the WebAuthn PRF extension. These are distinct checkpoints: exposing `navigator.credentials.create()` means the browser can start credential
creation, not that the selected authenticator supports PRF or registration will succeed. Registration requests PRF capability and confirms
`prf.enabled`. If registration does not return a PRF evaluation, the service obtains one through a follow-up assertion. A stored registration proves
that enrollment completed locally, but later authentication can still be cancelled, return an unexpected credential, or omit a usable PRF output.
An assertion without a usable PRF result cannot unlock the vault.

Each local registration stores a random 256-bit PRF input salt. The credential-specific PRF output is passed through HKDF-SHA-256 with the stable
local vault user id as salt and credential-specific, domain-separated context. The resulting AES-256-GCM KEK authenticates and decrypts that
credential's independently wrapped copy of the same DEK. A successful WebAuthn assertion alone is insufficient.

Multiple passkeys do not duplicate or re-encrypt secret records. Removing a registration deletes only its local wrapped DEK. It does not remove the
credential from an authenticator, alter other registrations, or change master-password recovery.

## IndexedDB V2 layout

The database remains `xshell-secrets`. Database schema version 1 creates all four stores and the unique `name` index on `secrets`:

| Store | Contents |
| --- | --- |
| `metadata` | Format version, non-sensitive vault/WebAuthn user identity, PBKDF2 parameters, and the password-wrapped DEK with its IV. |
| `passkeys` | Base64url credential id, label, plaintext description, creation time, PRF salt, and that credential's wrapped DEK with its IV. |
| `secrets` | UUID primary key, plaintext indexed name, format version, timestamps, revision, and separate fresh-IV AES-GCM ciphertexts for the JSON value, description, and optional custom label. |
| `sessions` | Random session id and its structured-cloned, non-extractable AES-256-GCM session-wrapping `CryptoKey`. |

Secret names are plaintext at rest because IndexedDB uses them for efficient unique lookup. Secret values, secret descriptions, custom secret
labels, passwords, raw DEKs, derived KEKs, and PRF outputs are never persisted as plaintext. Passkey descriptions are
ordinary plaintext local metadata and must not contain sensitive information. For a remembered session, `sessionStorage` holds a version,
random session id, vault id, creation and absolute expiration times, and an AES-GCM-wrapped DEK with its fresh IV. The separate non-extractable
session-wrapping key is structured-cloned into IndexedDB. Additional authenticated data binds the wrapping to its purpose, session id, vault id,
creation time, and expiration. Persistence publishes tab metadata only after the key record and cleans up interrupted attempts.

This development schema has no upgrade or encrypted-record migration path from earlier experimental layouts. Existing development data using a
different database version or name-keyed secret records must be cleared and recreated.

## Browser-local boundary

The encrypted vault and passkey registration records live only in this browser profile's IndexedDB. A platform provider may synchronize a passkey,
but that does not synchronize the encrypted vault, its PRF salt, or its wrapped-DEK record. Clearing site data removes the local vault. Copying only
the database is also insufficient unless the user still has the master password or a matching PRF-capable credential.

PRF is optional in WebAuthn and support varies by browser, operating system, authenticator, and credential. The service reports unsupported PRF,
missing PRF results, unavailable or unexpected credentials, user cancellation/timeouts, and damaged encrypted records without falling back to an
insecure unlock. Password initialization and unlocking do not require WebAuthn.

This design is local encryption, not server-verified authentication. XShell does not validate assertion signatures against a server-side public
key or make claims about the user's remote identity. WebAuthn origin and relying-party restrictions are enforced by the browser.

Remembered sessions are weaker than fresh password or passkey authentication. A non-extractable `CryptoKey` cannot be exported through Web Crypto,
but same-origin JavaScript can still ask it to decrypt; this mechanism does not protect against script execution in the application origin. Expiry
is application logic based on the local clock, not hardware-backed cryptographic expiry. `sessionStorage` is tab-scoped by browser policy, but tab
duplication, browser session restoration, and browser closing behavior vary and must not be treated as guaranteed deletion. Storage restrictions,
missing Web Crypto, malformed metadata, policy changes, missing keys, and authentication failures leave the vault locked.

## Release validation

The client test suite deterministically covers vault initialization, password and mocked-PRF passkey unlock, optional automatic enrollment,
registration failure and retry, remembered restoration and expiration, explicit locking, secret CRUD and rename behavior, encrypted metadata,
revision tracking, concurrent writes, in-flight locking, authentication dialog closure, Manager refreshes, and Page/dialog hash isolation. Run:

```sh
node --test test/DProjects.XShell.Client.Test/secrets.test.mjs
node --test test/DProjects.XShell.Client.Test/secrets-page.test.mjs
node --test test/DProjects.XShell.Client.Test/secrets-unlock-page.test.mjs
cd test/DProjects.XShell.Client.Test && npm test
```

Mocked WebAuthn verifies XShell's request, response, error, and lifecycle handling but cannot prove browser, operating-system, or authenticator
compatibility. Before release, serve XShell from its normal secure origin and complete this checklist with a real PRF-capable authenticator in each
supported browser:

- Create a fresh vault with **Set up a default passkey** enabled and a positive **Keep unlocked** duration. Complete automatic registration, confirm
  that the dialog closes only after registration, and verify **This device** appears in the Manager.
- Repeat after cancelling the browser ceremony and after reproducing a missing-user-activation rejection. Confirm the vault remains initialized,
  **Create passkey** retries from a fresh click, and **Not now** finishes without a passkey.
- Clear **Set up a default passkey** and verify that vault creation completes without a WebAuthn prompt. Repeat where credential creation is
  unavailable and confirm password initialization and unlocking remain usable.
- Lock and unlock with the registered passkey using zero and positive remembered durations. Then lock and recover with the master password.
- Reload before remembered-session expiration and confirm restoration prompts for neither password nor passkey and does not extend
  `sessionExpiresAt`. Verify expiration and explicit Lock require authentication again in that tab.
- Create text and structured secrets; edit values, labels, and descriptions; rename and delete them; and verify revision and `modifiedAt` changes
  while immutable ids and `createdAt` remain stable.
- Add, edit, and remove a passkey through the Manager and verify its list refreshes after every successful dialog or removal.
- Change the selected Manager tab while dialogs are open, complete or cancel those dialogs, and verify normal refreshes do not replace the tab hash.
- Reload the application and verify vault discovery, remembered restoration when eligible, and locked password/passkey authentication otherwise.
- Inspect IndexedDB and `sessionStorage`. Confirm they contain only the documented records and wrapping material—not passwords, plaintext secret
  values, raw DEKs, KEKs, or PRF outputs.

Record the browser version, operating system, authenticator, whether automatic enrollment retained user activation, PRF registration result, and
password/passkey unlock outcome. Chromium, Firefox, and WebKit/Safari may differ in WebAuthn PRF and user-activation behavior; a successful check in
one does not validate the others. Environments without credential creation, PRF support, a secure context, or an eligible authenticator remain
password-only and must not be reported as passkey-validated.
