# Preferences

Preferences is the Core browser-local key/value service for non-secret application settings. Its implementation is
`xshell/services/preferences.js`, its contract is `xshell/contracts/preferences.json`, and XShell registers it as `xshell.services.preferences`.
The `x` module provides `page:x:/pages/preferences.js` for inspecting and managing records.
The X theme service and main layout use Preferences for the selected theme, menu state, dock source and position, and dock sizes. Their existing
`xshell.theme`, `xshell.toggled`, `xshell.dockSrc`, `xshell.dockPosition`, and `xshell.dockSize.*` keys are stored as strings. These settings are
restored asynchronously; changes made while a read is pending take precedence over the saved value.

## API

`set(key, value, options?)` creates or updates a preference. Names are unique, case-sensitive, nonempty strings. The optional `label` and
`description` metadata is intended for management interfaces; omitted metadata is preserved during updates.

```js
await preferences.set("x-editor:fontSize", 14);
await preferences.set("x-editor:fontSize", 16, {
    label: "Editor Font Size",
    description: "Font size in pixels"
});
```

`get(key, defaultValue?)` returns the stored value rather than the record. The default is returned only when the name is absent, so a stored
`undefined` remains distinct from a missing preference.

```js
const fontSize = await preferences.get("x-editor:fontSize", 14);
```

`list(keyPrefix?)` returns complete records in name order. An omitted or empty prefix lists everything; a nonempty prefix uses the `name` index.
`delete(key)` removes a matching record and succeeds when the name is absent.

```js
const editorPreferences = await preferences.list("x-editor:");
await preferences.delete("x-editor:fontSize");
```

## Storage model

The service lazily opens the origin-scoped IndexedDB database `xshell-preferences` at version `1`. It uses the `preferences` object store with
`id` as its primary key and a unique `name` index. A record has this shape:

```js
{
    id: "generated-uuid",
    name: "x-editor:fontSize",
    label: "Editor Font Size",
    description: "Font size in pixels",
    createdAt: "2026-11-17T10:00:00.000Z",
    modifiedAt: "2026-11-17T10:30:00.000Z",
    revision: 2,
    value: 16
}
```

Creation generates the UUID with `crypto.randomUUID()`, defaults `label` to `name` and `description` to an empty string, and starts revision at
one. An update preserves `id`, `name`, and `createdAt`, replaces `value`, updates `modifiedAt`, and increments revision in the same transaction.

## Structured-clone values

Values are written directly to IndexedDB. The service does not use JSON serialization, so the browser can preserve structured-clone values such
as arrays, plain objects, `Map`, `Set`, `Date`, `ArrayBuffer`, typed arrays, `Blob`, `File`, and supported filesystem handles. Unsupported values,
including functions and DOM elements, reject the write and leave an existing record unchanged.

Filesystem handles remain subject to browser support and permission rules. Preferences stores and restores a handle; it does not request,
persist, or manage access permission. The management Page edits strings and values with safe JSON round-trips. Other native values are summarized
and remain read-only while label and description changes preserve the original value.

## Scope and durability

IndexedDB data belongs to the browser origin and profile. It is not automatically shared across origins, profiles, devices, or browsers. The
service does not request persistent-storage status, and browsers may evict site data under their storage policies or when the user clears it.
There is no synchronization, deletion tombstone, history, or automatic backup.

Preferences data is **not encrypted**. Use [Secrets](100-secrets.md) for sensitive values requiring encrypted-at-rest storage and explicit vault
authentication. Secrets currently stores JSON values; Preferences is intended for non-sensitive settings and supports native structured-clone
values.
