# Secrets

The framework-owned `secrets` service stores named JSON-compatible values in a browser-local encrypted vault. Its default implementation is
`xshell/services/secrets.js`, its contract is `xshell/contracts/secrets.json`, and XShell Core registers it through `xshell.services.secrets`.
The management Page is `x/pages/secrets.js`; the dedicated initialization and unlock Page is `x/pages/secrets-unlock.js`.

Secrets V2 uses envelope encryption. Vault creation generates a random 256-bit data encryption key (DEK). The DEK, imported as a non-extractable
AES-GCM key for the active session, encrypts every secret. Each secret record has a fresh random 96-bit IV, authenticated ciphertext containing the
JSON value, and additional authenticated data that binds the ciphertext to its secret identifier and V2 purpose. Its optional description is
encrypted independently with a fresh IV and a distinct authenticated-data purpose.

The master password does not encrypt individual secrets. PBKDF2-SHA-256 derives a key encryption key (KEK) from the password, a random 128-bit salt,
and 600,000 iterations. That KEK authenticates and decrypts one password-wrapped copy of the random DEK. The password mechanism is always retained
as the vault recovery path when passkeys are added or removed.

After first-time vault initialization, the authentication Page offers optional passkey enrollment when the browser supports WebAuthn credential
creation and retrieval. Enrollment starts only when the user selects **Create passkey**; **Not now** completes initialization without one. The Page
retains the initialization password privately only for this optional step because `addPasskey()` reauthenticates against the master password. A
failed or cancelled WebAuthn ceremony leaves the initialized vault intact and allows another attempt or completion without a passkey. The master
password remains the permanent recovery method whether or not a passkey is enrolled.

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

await secrets.set("api-token", "secret", { description: "Production API token" });
const token = await secrets.get("api-token");
const tokenWithoutPrompt = await secrets.get("api-token", { interactive: false });
const info = await secrets.getInfo("api-token");
const entries = await secrets.list();
await secrets.delete("api-token");

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

Concurrent interactive `get()` calls share one authentication dialog and resume independently, so each caller receives the value for its own id.
Cancellation rejects every caller waiting on that dialog. The pending attempt is cleared after success, cancellation, or load failure, and a later
request may open a new dialog. A non-interactive caller neither opens nor joins an interactive attempt. Expiration and epoch checks run again before
and during decryption, so authentication success cannot make a later lock or expiration return plaintext.

`getInfo()` returns `id`, decrypted `description`, and immutable `createdAt`; `list()` returns the same metadata for each secret without values.
Descriptions default to an empty string. Passing `{ description }` to `set()` changes it, including clearing it with `""`; omitting the option
preserves the current description. Existing records without metadata report an empty description and `createdAt: null`, and an update does not
invent or change their creation time.

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

`xshell.services.secrets.options.rememberMinutes` is the default used when an unlock call omits a duration. `maxRememberMinutes` in the same options
object is the application-enforced maximum. Both are nonnegative integer minutes, are limited to 1,440, and `rememberMinutes` cannot exceed
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

## Passkey wrapping

Passkey enrollment and unlocking require a secure origin, user verification, WebAuthn, and a credential/authenticator combination that implements
the WebAuthn PRF extension. Registration requests PRF capability and confirms `prf.enabled`. If registration does not return a PRF evaluation, the
service obtains one through a follow-up assertion. An assertion without a usable PRF output cannot unlock the vault.

Each local registration stores a random 256-bit PRF input salt. The credential-specific PRF output is passed through HKDF-SHA-256 with the stable
local vault user id as salt and credential-specific, domain-separated context. The resulting AES-256-GCM KEK authenticates and decrypts that
credential's independently wrapped copy of the same DEK. A successful WebAuthn assertion alone is insufficient.

Multiple passkeys do not duplicate or re-encrypt secret records. Removing a registration deletes only its local wrapped DEK. It does not remove the
credential from an authenticator, alter other registrations, or change master-password recovery.

## IndexedDB V2 layout

The database remains `xshell-secrets`. Database schema version 3 adds a fourth store without changing the Secrets V2 encryption format:

| Store | Contents |
| --- | --- |
| `metadata` | Format version, non-sensitive vault/WebAuthn user identity, PBKDF2 parameters, and the password-wrapped DEK with its IV. |
| `passkeys` | Base64url credential id, label, plaintext description, creation time, PRF salt, and that credential's wrapped DEK with its IV. |
| `secrets` | Secret id, format version, immutable creation time, and separate fresh-IV AES-GCM ciphertexts for the JSON value and description. |
| `sessions` | Random session id and its structured-cloned, non-extractable AES-256-GCM session-wrapping `CryptoKey`. |

Plaintext secret values, secret descriptions, passwords, raw DEKs, derived KEKs, and PRF outputs are never persisted. Passkey descriptions are
ordinary plaintext local metadata and must not contain sensitive information. For a remembered session, `sessionStorage` holds a version,
random session id, vault id, creation and absolute expiration times, and an AES-GCM-wrapped DEK with its fresh IV. The separate non-extractable
session-wrapping key is structured-cloned into IndexedDB. Additional authenticated data binds the wrapping to its purpose, session id, vault id,
creation time, and expiration. Persistence publishes tab metadata only after the key record and cleans up interrupted attempts.

Database upgrades do not overwrite vault metadata, passkeys, or secrets. Metadata from Secrets V1 is rejected with an unsupported version error.
There is no V1 migration or parallel legacy decryption path.

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

## Manual PRF verification

Automated client tests use deterministic WebAuthn responses while retaining native Web Crypto operations. Real compatibility still depends on the
browser, platform, and authenticator. To verify an environment, serve XShell from its normal secure origin and:

1. Create a vault, store both a text value and a structured JSON value, and add a labeled passkey.
2. Lock and reload the Page, choose **Unlock with passkey** from a direct button click, complete user verification, and confirm both values decrypt.
3. Add a second passkey, confirm either credential unlocks the same values, remove one, and confirm the other and the master password still work.
4. Enable a remembered duration, unlock, reload before expiry, and confirm restoration does not display WebAuthn or password UI and does not extend
   `sessionExpiresAt`; then use Lock and confirm reload requires authentication.
5. Inspect IndexedDB and `sessionStorage`. Confirm they contain only the documented vault/passkey/secret records, a non-extractable session key, and
   wrapped session metadata—not passwords, plaintext values, raw DEKs, KEKs, or PRF outputs.
6. Repeat with a credential that lacks PRF support or cancel the ceremony and confirm the Page reports the failure while password unlock still works.
