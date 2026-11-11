# XVault

The `x-vault` module provides the `xvault` service for editing Python XVault V1/V2 documents. It supports ENV, JSON, JSONC, YAML, Markdown,
and OpenVPN. The service has exactly two methods:

```js
async decrypt(text, password, options = {}) // -> { text, context }
async encrypt(text, password, context)     // -> encrypted document string
```

`decrypt` intentionally returns an object instead of the old placeholder's string. Its editable `text` retains `enc:VALUE` and `${enc:VALUE}`
markers but excludes the document's metadata entry. Unrelated nested `_xvault` keys and literal text remain untouched. Keep `context` in application
memory, associated with the original document and separate from the editor. The service performs no file I/O or persistent credential storage.

```js
const vault = xshell.services.resolve("xvault");
const opened = await vault.decrypt(encryptedFile, password, { format: "env" });
editor.value = opened.text;
let context = opened.context;

const saved = await vault.encrypt(editor.value, password, context);
// after the caller successfully saves the document, refresh the editing context
const refreshed = await vault.decrypt(saved, password, { format: context.format });
context = refreshed.context;
editor.value = refreshed.text;
```

An existing context contains `kind: "existing"`, `format`, `cryptoVersion`, version-specific `metadata`, and the complete encrypted `originalText`.
It contains no password, raw AES key, KEK, or DEK. Encryption validates it against metadata parsed from `originalText` and authenticates the password
again. Failures never initialize a replacement vault or mutate the supplied context.

## Formats and metadata

Use `options.format` to select `env`, `json`, `jsonc`, `yaml` (`yml`), `markdown` (`md`), or `ovpn`. The two-argument decrypt call recognizes ENV and
OpenVPN metadata directives, JSON/JSONC objects, and leading Markdown front matter. Ambiguous documents require an explicit format, including
ordinary YAML mappings. JSON and JSONC accept JSON5 syntax, matching Python.

Metadata is removed and restored through the appropriate format handler: an ENV entry, top-level JSON property, top-level YAML mapping entry,
leading Markdown front-matter entry, or commented OpenVPN directive. Source ranges retain unrelated comments, whitespace, ordering, and line
endings. No-op saves return the original encrypted string exactly; value-only edits retain the original metadata bytes and placement. Structural
edits use original neighboring properties or lines when restoring metadata.

## Initialization

Create a new vault explicitly:

```js
const encrypted = await vault.encrypt("API_KEY=enc:my-secret", password, { kind: "new", format: "env" });
```

New contexts default to V2. Set `cryptoVersion: 1` to initialize V1 deliberately. A document without metadata can also yield a new context from
`decrypt`. Present malformed or duplicate metadata always fails. Ciphertext-like markers without metadata are rejected conservatively, since their
original keys cannot be recovered; long base64url plaintext can also trigger this check. Missing metadata cannot establish a document's history.

## Editing and compatibility

Unchanged secrets reuse their individual original ciphertext. Matching follows Python's edit model: unchanged document structure identifies each
occurrence; structural edits use unique line surroundings and occurrence positions. Repeated plaintext in different fields retains distinct
ciphertext. Insertion, deletion, and reordering are supported when occurrences can be identified safely. Ambiguous matches fail. Newly exposed
copies of an original plaintext secret, including removal of a protected field's marker, fail rather than silently saving that value in plaintext.
This conservative check can also reject intentional copies into unprotected text or structural edits when a secret also appears in public text.

Marker recognition follows Python's textual delimiters. Markers must be nonempty and single-line. Unwrapped markers stop at a double quote or
line break in JSON/JSONC, YAML, and Markdown; ENV also stops at a single quote or `#`. OpenVPN unwrapped markers start at column zero. Wrapped
markers end at `}` and support inline surrounding text. JSON escapes are treated as source text, as in Python, rather than decoded string values.
Values that cannot be represented losslessly by these delimiters are rejected for editing. Overlapping markers are rejected. Use a format-safe
representation for delimiter-containing secrets that cannot be expressed with a wrapped marker.

JSON/JSONC and YAML require a top-level object/mapping so metadata has a defined home. YAML metadata must be an unaliased string scalar. Changing
an existing YAML metadata container between block and flow styles or removing original Markdown front-matter delimiters is rejected. Legacy V1
metadata without an authenticating `check` is rejected. These stricter editing checks do not change the encrypted byte format.

Both versions use Argon2id v19 with a 16-byte hexadecimal salt, time cost 5, memory cost 131072 KiB, parallelism 4, and a 32-byte output. V1 encrypts
values directly with that derived key and verifies the encrypted `check` value `xvault`. V2 derives a KEK and authenticates/unlocks the existing
32-byte DEK using AAD `xvault:v2:dek`. An initialized vault retains its salt and check or wrapped DEK; V1 is never upgraded automatically.
AES-256-GCM uses 12-byte random nonces and 16-byte tags. Secret values have no AAD. All encrypted blobs are padded base64url of
`nonce || ciphertext || tag`; the V2 wrapped key is 60 bytes. Metadata uses `xvault:` plus base64url-encoded JSON with Python's field names.

## Runtime and validation

AES-GCM and secure randomness use Web Crypto, requiring a secure browser context such as HTTPS or localhost. Argon2id uses bundled
`@noble/hashes` 2.4.0 JavaScript with asynchronous event-loop yields. JSON5 2.2.3 and YAML 2.8.1 provide syntax parsing. Supporting implementation
files are under `x-vault/js/`, and third-party bundles and licenses are under `x-vault/vendor/`; normal XShell file inventories package them.
No CDN, WASM, eval, or Python is required in the browser, and the default CSP is unchanged. Allow roughly 128 MiB per concurrent KDF and avoid
concurrent bulk opening on memory-constrained devices.

Client tests include canonical Python fixtures, real V1/V2 crypto, editing safety, and contract validation. The dedicated interoperability workflow
also imports the pinned Python source and tests Python-generated input and JavaScript-generated/edited output across all formats and both versions.
Neither implementation authenticates field identity or the unmarked document structure; preserve the context's association with its own document.

See [Services](../10-architecture/100-services.md) for contract loading and service resolution.
