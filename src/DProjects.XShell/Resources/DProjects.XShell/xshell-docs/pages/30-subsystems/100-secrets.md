# Secrets

The framework-owned `secrets` service stores named JSON-compatible values in a browser-local encrypted vault. Its default implementation is
`xshell/services/secrets.js`, its contract is `xshell/contracts/secrets.json`, and XShell Core registers it through `xshell.services.secrets`.
The management Page is `x/pages/secrets.js`.

Secrets V2 uses envelope encryption. Vault creation generates a random 256-bit data encryption key (DEK). The DEK, imported as a non-extractable
AES-GCM key for the active session, encrypts every secret. Each secret record has a fresh random 96-bit IV, authenticated ciphertext containing the
JSON value, and additional authenticated data that binds the ciphertext to its secret identifier and V2 purpose.

The master password does not encrypt individual secrets. PBKDF2-SHA-256 derives a key encryption key (KEK) from the password, a random 128-bit salt,
and 600,000 iterations. That KEK authenticates and decrypts one password-wrapped copy of the random DEK. The password mechanism is always retained
as the vault recovery path when passkeys are added or removed.

## Lifecycle and API

Construction remains synchronous while IndexedDB discovery is asynchronous. Consumers can use `await secrets.ready()` to wait for discovery and
read the resulting `uninitialized`, `locked`, or `unlocked` status. An initialized vault normally starts locked after a reload; there is no silent
passkey assertion or persisted unlocked session.

```js
await secrets.ready();
await secrets.initialize({ password });
await secrets.unlock({ password });
await secrets.unlockWithPasskey({ id }); // id may be omitted for browser selection

await secrets.set("api-token", "secret");
const value = await secrets.get("api-token");
const entries = await secrets.list();
await secrets.delete("api-token");

const registration = await secrets.addPasskey({ label: "Laptop", password });
const registrations = await secrets.listPasskeys();
await secrets.removePasskey(registration.id);
secrets.lock();
```

CRUD, passkey enrollment, and passkey removal require an unlocked vault. `listPasskeys()` is safe while locked and returns only `id`, `label`, and
`createdAt`. `addPasskey()` intentionally requires the master password as well as an unlocked session. It reauthenticates the password-wrapped DEK
and creates another wrapping without exporting the active non-extractable DEK. A wrong password fails before registration.

`lock()` immediately invalidates the session epoch, clears the active DEK reference, and aborts active IndexedDB writes. Operations verify the
epoch after asynchronous cryptographic, WebAuthn, and storage work so a late completion cannot restore an unlocked session.
`secrets:status-changed` reports lifecycle changes on the Bus.

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

The database remains `xshell-secrets` and contains three object stores:

| Store | Contents |
| --- | --- |
| `metadata` | Format version, non-sensitive vault/WebAuthn user identity, PBKDF2 parameters, and the password-wrapped DEK with its IV. |
| `passkeys` | Base64url credential id, label, creation time, PRF salt, and that credential's wrapped DEK with its IV. |
| `secrets` | Secret id, format version, fresh IV, and AES-GCM ciphertext of the JSON value. |

Plaintext values, passwords, raw DEKs, derived KEKs, PRF outputs, and active session keys are never persisted. AES-GCM additional authenticated data
separates secret ciphertext, password-wrapped keys, and credential-specific passkey-wrapped keys.

The database schema upgrade adds the `passkeys` store but does not overwrite metadata. Metadata from Secrets V1 is rejected with an unsupported
version error. There is no V1 migration or parallel legacy decryption path.

## Browser-local boundary

The encrypted vault and passkey registration records live only in this browser profile's IndexedDB. A platform provider may synchronize a passkey,
but that does not synchronize the encrypted vault, its PRF salt, or its wrapped-DEK record. Clearing site data removes the local vault. Copying only
the database is also insufficient unless the user still has the master password or a matching PRF-capable credential.

PRF is optional in WebAuthn and support varies by browser, operating system, authenticator, and credential. The service reports unsupported PRF,
missing PRF results, unavailable or unexpected credentials, user cancellation/timeouts, and damaged encrypted records without falling back to an
insecure unlock. Password initialization and unlocking do not require WebAuthn.

This design is local encryption, not server-verified authentication. XShell does not validate assertion signatures against a server-side public
key or make claims about the user's remote identity. WebAuthn origin and relying-party restrictions are enforced by the browser.

## Manual PRF verification

Automated client tests use deterministic WebAuthn responses while retaining native Web Crypto operations. Real compatibility still depends on the
browser, platform, and authenticator. To verify an environment, serve XShell from its normal secure origin and:

1. Create a vault, store both a text value and a structured JSON value, and add a labeled passkey.
2. Lock and reload the Page, choose **Unlock with passkey** from a direct button click, complete user verification, and confirm both values decrypt.
3. Add a second passkey, confirm either credential unlocks the same values, remove one, and confirm the other and the master password still work.
4. Inspect the `xshell-secrets` IndexedDB database and confirm it contains only V2 metadata, registration metadata/wrapped keys, and encrypted secret
   records—not passwords, plaintext values, raw DEKs, KEKs, or PRF outputs.
5. Repeat with a credential that lacks PRF support or cancel the ceremony and confirm the Page reports the failure while password unlock still works.
