# Logging

XShell Core registers the write-oriented `logger` singleton. The optional `x-logs` module contributes the `console` and `indexeddb` writers,
the `logReader` singleton, an IndexedDB reader and two log Pages. The application selects and configures each service's provider independently.

## Module dependency

Add `x-logs` to the root module's existing dependencies. To migrate from `x-logger`, replace the old dependency and update any module-qualified
provider paths to use `x-logs`. The writer provider IDs and IndexedDB schema and names are unchanged, so existing records remain readable.

```jsonc
"dependencies": {
    "x-logs": "module:x-logs:latest"
}
```

## Console provider

Select `console` in the application manifest to enable console logging.

```jsonc
{"xshell": {"services": {"logger": {"options": {"provider": "console"}}}}}
```

The provider forwards the original arguments synchronously, preserving native object and error inspection. Categorized calls have a literal
`[category]` prefix. Direct calls keep native console formatting. The provider has no provider-specific options.

| Logger level | Native console method |
| --- | --- |
| `trace` | `console.trace()` |
| `debug` | `console.debug()` |
| `info` | `console.info()` |
| `warn` | `console.warn()` |
| `error` | `console.error()` |

Logging stays disabled when no provider is selected. Set `provider` to `null` in the application manifest to disable logging explicitly.

## IndexedDB provider

Select `indexeddb` in the application manifest to persist logs in browser storage. Applications can override the contributed provider options
in the same manifest.

```jsonc
{
    "xshell": {
        "services": {
            "logger": {
                "options": {
                    "provider": "indexeddb",
                    "providers": {
                        "indexeddb": {"options": {"maxEntries": 50000, "retentionDays": 30}}
                    }
                }
            }
        }
    }
}
```

| Option | Accepted value | Default |
| --- | --- | --- |
| `databaseName` | Optional nonblank string | `xshell-logs` at the origin root, namespaced by application base path elsewhere |
| `maxEntries` | Positive safe integer | 10,000 |
| `retentionDays` | Positive finite number, including fractions | 7 |

The application version stays out of the default database name, so upgrades can use the same logs. Applications that explicitly choose the same
database name can share logs within the same origin and browser storage partition. Use a plain name such as `my-application-logs` for a shared
namespace because URL-like manifest values follow ordinary manifest normalization. Invalid options fail provider initialization.

The version 1 database has a `logs` object store with an auto-incrementing `id` and non-unique `timestamp` and `level` indexes. Each record
contains `{id, timestamp, level, category, args}`. The timestamp is epoch milliseconds captured when the logger receives the call. The reader
returns `category: null` for historical records that lack the field. The existing database schema serves both record shapes.

The provider takes a structured clone snapshot of the argument array before queueing it. Structured clone preserves supported values and
relationships, including circular references. If the full array cannot be cloned, the provider clones arguments individually and substitutes
`{unserializable: true}` at unsupported positions. Native storage can reject some values that structured clone accepts. The provider preserves
the values IndexedDB can store and substitutes the same marker at rejected positions. Error details depend on browser cloning support, custom
Error properties may be dropped, and custom object prototypes may become plain objects.

Logging returns synchronously. A single writer per provider opens the database on demand and writes up to 100 queued records per batch in arrival
order. The queue holds at most 1,000 records awaiting a write and discards the oldest pending record on overflow. A batch counts as persisted
once its transaction commits. Within that transaction, the provider removes records older than `retentionDays` through the timestamp index,
then removes the oldest remaining records above `maxEntries`. The generated primary key breaks timestamp ties. Native IndexedDB transactions
coordinate writes and retention across tabs sharing the database. Ordering across tabs depends on their transactions.

Retention runs during writes and can leave expired records in an inactive application. `retentionDays` and `maxEntries` set intended maximums
for history age and record count. Browser quota depends on storage used across the origin, so these limits cannot guarantee room for a new batch.
Under storage pressure, the provider may evict history before it reaches the configured age.

Use the Logs Page or the browser's IndexedDB storage panel to inspect stored records. Records can survive reloads and browser sessions subject to
storage policy. Writes are best-effort, and closing a tab or browser can discard pending records. Code with access to the same browser storage
namespace can read the records. Keep credentials and other sensitive information out of log arguments. Use a separate system for guaranteed auditing.

### Quota recovery

When a write fails with `QuotaExceededError`, the provider waits for the failed transaction to roll back. A separate transaction uses the
timestamp index to delete expired logs. If it finds none, it deletes up to 100 of the oldest retained records, breaking timestamp ties by
generated primary key. Recovery deletes individual records from the logging object store. Other object stores, databases, and application
storage are outside its scope.

If deletions commit, the provider signals active readers and retries the original batch once with normal retention. The deletion transaction
commits independently, so the reclaimed space and the reader notification survive a failed retry. The single retry limits work and data loss
under persistent quota pressure. The eviction limit counts records per attempt, and the space freed depends on the stored records. Each provider
instance manages its own attempts and cooldown, so multiple tabs can each reclaim history.

If reclamation fails, removes nothing, or the retry fails, the provider discards that batch and suppresses further reclamation for 30 seconds.
Later batches still attempt normal writes during the cooldown. Any successful write clears the cooldown. Failed batches produce one fixed native
console warning until a write succeeds. If opening fails, remaining queued records wait for a later logging call. The provider closes stale
connections on version changes.

## Logger contract

Inject `logger` by name using ordinary [service consumption](../10-architecture/100-services.md), such as a Page or Component controller.

```javascript
logger.info("Application initialized");
```

```javascript
controller({logger}) {
    return {
        reportRefresh(count) {
            logger.debug("Inventory: refresh completed", {count});
        }
    };
}
```

The public methods are `trace(...args)`, `debug(...args)`, `info(...args)`, `warn(...args)`, and `error(...args)`. Each accepts zero or more
arbitrary JavaScript values, including arrays and errors, and returns `undefined` synchronously. Values reach the provider in their original order
and objects retain their identity. Calls are silently ignored when `provider` is omitted or null.

Injected loggers automatically use the [immediate consumer's logical ID](../10-architecture/100-services.md#consumer-aware-resolution) as
their category, for example `secrets`, `x-listview`, or `x-logs:/pages/logs.js`. The logger returns a small object with the five public methods
bound to that category and delegates every call to the same singleton's provider. Direct `services.resolve("logger")` calls use a null category.
Categories are arbitrary nonempty, case-sensitive strings. Null marks an uncategorized record.

## Writer provider interface

A provider default-exports a class. Its constructor receives the logger's standard XShell service dependencies and the effective provider options
as `constructor(dependencies, options)`. Custom writer providers must implement the updated signature `log(level, category, ...args)`, where
`level` is `trace`, `debug`, `info`, `warn`, or `error` and `category` is a string or null. For an Inventory Page, the example above could reach
the provider as `log("debug", "shop:/pages/inventory.js", "Inventory: refresh completed", {count})`.

XShell awaits logger initialization before starting module controllers. Initialization uses the standard ESM resolver and loader to import only
the selected implementation, constructs it once, and checks that it exposes a callable `log`. With logging disabled, startup skips provider
loading and construction.

The logger invokes the provider synchronously and suppresses any exception the provider throws during the call. Providers own completion and error
handling for asynchronous work. The logger ignores the return value of `log()`.

## Log Reader service

Inject `logReader` by name. Its public contract exposes three asynchronous methods, `query(options = {})`, `getCategories()`, and
`subscribe(callback)`. The service loads the selected provider through the ordinary ESM loader on first use. Concurrent requests share
initialization, a successful instance is reused, and a failed initialization can be retried. With no selected provider, calls reject and the
service keeps storage and observation idle.

```jsonc
"xshell": {
    "services": {
        "logger": {"options": {"provider": "indexeddb"}},
        "logReader": {"options": {"provider": "indexeddb"}}
    }
}
```

Select the writer and reader independently. An IndexedDB reader can inspect historical records with the console writer selected or with writing
disabled. Selecting only the IndexedDB writer enables persistence. Both selections default to null.

By default, both IndexedDB providers derive the database name from the application base path using the same Core utility. For a custom database,
set the same nonblank name on both providers when they should share records. The reader uses its own configuration in every case.

```jsonc
"xshell": {
    "services": {
        "logger": {
            "options": {
                "provider": "indexeddb",
                "providers": {"indexeddb": {"options": {"databaseName": "application-logs"}}}
            }
        },
        "logReader": {
            "options": {
                "provider": "indexeddb",
                "providers": {"indexeddb": {"options": {"databaseName": "application-logs"}}}
            }
        }
    }
}
```

### Querying records

```javascript
const result = await logReader.query({
    levels: ["warn", "error"],
    categories: ["navigation", null],
    limit: 100
});
```

| Option | Behavior |
| --- | --- |
| `levels` | Array containing any of `trace`, `debug`, `info`, `warn`, and `error`. Omit to match all. An empty array matches no records. |
| `categories` | Match any selected category exactly. Values are nonempty strings or null. Omit to match all, pass `[null]` for uncategorized records, or pass `[]` for no matches. |
| `from`, `to` | Inclusive finite timestamps in epoch milliseconds. When both are present, `from` must be at or before `to`. |
| `order` | `"desc"` for newest first, the default, or `"asc"` for oldest first. |
| `limit` | Integer from 1 through 500. Defaults to 100. |
| `cursor` | Opaque continuation from a prior result. Omit to start at the beginning. |

The IndexedDB reader rejects unknown options, unsupported values and malformed or incompatible cursors. It queries using a readonly transaction
and returns `{items, nextCursor, hasMore}`. Each item contains `{id, timestamp, level, category, args}`, including structured-cloned argument values.
Category, severity, and timestamp filters all apply to each record. Duplicate category values are ignored. An empty result or a final nonempty
page has `nextCursor: null` and `hasMore: false`.

Pass `nextCursor` back for the same database with equivalent category, severity, and timestamp filters and the same order. Page size can change.
The timestamp index orders records by timestamp and then by primary key, so the reader can continue even when retention removed the cursor
record. It looks for an extra matching record to determine whether another page is available. Each query runs in its own transaction. New writes
and retention can change the results between pages. When upgrading from a version that did not support categories, restart pagination with a
fresh query to obtain a current cursor.

### Discovering categories

`await logReader.getCategories()` returns the distinct categories currently in the source. The IndexedDB reader lists null first when present,
then sorts strings by code unit. Discovery scans the stored records once in a readonly transaction and keeps only the distinct values in
memory. Its cost grows with the number of stored records.

### Observing changes

```javascript
const unsubscribe = await logReader.subscribe(callback);
// When observation is no longer needed:
unsubscribe();
```

Register before the initial query and run another query when a notification arrives during that query. Callbacks receive `{type: "changed"}` as a
signal to requery. Each committed IndexedDB write batch publishes one BroadcastChannel signal for its database, covering writes and retention in
the same transaction. Committed quota recovery deletions also publish one signal, even if the subsequent retry fails. The transport carries
no record data and works across browser contexts that share the database's origin and storage partition. The reader shares one channel per
provider instance and sends a reconciliation notification about every five seconds while there
are subscribers, including when BroadcastChannel is unavailable. The final unsubscribe closes the channel and stops reconciliation.

Treat notifications as hints about committed storage. They may be coalesced, duplicated or missed while a context is inactive. Query results reflect
the records that are still persisted when queried.

### Reader provider interface

A reader provider default-exports a class with `constructor(dependencies, options = {})`. The constructor receives the standard service dependencies
and the effective provider options. The class exposes `query(options)`, `getCategories()`, and `subscribe(callback)`. Subscription registration may
return an idempotent unsubscribe function directly or resolve one asynchronously. The service checks all three methods and returns a Promise to callers.
Providers report query failures to callers and isolate subscriber callback failures. Use native diagnostics where needed to avoid a feedback loop
through the logger being observed.

### Logs and Live Logs

Open **XShell Diagnostics → Runtime → Logs** to investigate stored records. Set category, severity, and local date/time filters, then choose **Query**
to start at the newest matching records. **Older** and **Newer** navigate pages of 100 records using reader cursors. **Refresh** repeats the current
page's query with its applied filters. The results stay stable between explicit actions.

Open **XShell Diagnostics → Runtime → Live Logs** to monitor the latest 200 matching persisted records, with the newest at the bottom. Category and
severity changes apply immediately. **Pause** keeps the current display and allows manual **Refresh**. **Resume** starts observation again and reads
the latest matching records. Live observation is suspended while the tab is hidden and resumes when shown if monitoring is still enabled.
Turn off **Auto-scroll** to inspect older rows without following new records. The window reflects persisted records and provider retention.

Both Pages discover categories on mount and on **Refresh** and retain selected categories after their records expire. Clear all category selections
to show every category. **Uncategorized** selects records with a null category, distinct from the named category of the same spelling.
All five levels are selected initially. Clearing every level produces an empty result. Timestamps use local time with three digits of millisecond
precision. Select a record to inspect its complete stored arguments, including structured values.

The standalone Page references are `page:x-logs:/pages/logs.js` and `page:x-logs:/pages/live-logs.js`.

## Platform logging conventions

Use a stable English message in the form `Subsystem: operation`. Pass small metadata objects as separate arguments and reuse identifiers from the
operation. Measure elapsed durations in milliseconds with `performance.now()` or existing timing data. For example, Commands logs
`"Commands: execution completed"` with `{commandId, duration}` after execution and disposal finish. Search logs `"Search: provider failed"` with
`{providerId, stage}` while keeping successful providers' results.

| Level | Use |
| --- | --- |
| `trace` | Detailed diagnostics, such as provider selection or definition loading |
| `debug` | Execution boundaries and lifecycle decisions, such as Task completion or Navigation mode selection |
| `info` | Significant milestones, such as completion of module initialization |
| `warn` | Recoverable problems, such as an isolated Search provider failure or a post-commit notification failure |
| `error` | Failed operations, such as command execution or Services scope disposal |

Normal cancellations use `debug` or `trace`. Record a completion only at an observed boundary. Navigation can report that the stack was reconciled
while the Page host reports that its Page mounted. Group diagnostics around operations and lifecycle transitions. Progress updates, renders,
individual property updates, resource cache hits, and Bus payloads can be high-volume and belong outside these diagnostics.

Pass an original error as a separate argument when its message, stack, properties and cause are known to be safe. At boundaries that accept caller
data or invoke arbitrary implementations, record the operation and known-safe identifiers instead. Keep command arguments and results, search text
and results, navigation URLs and parameters, preference keys and values, filesystem paths, vault data, credentials, and response bodies out of
provider output. Assume the provider can persist or transmit its arguments. Consumers can call the injected logger directly.

## Relationships to runtime diagnostics

Task output belongs to the operation and remains available through Task handles. Tasks logs its own terminal status, including cancellation before
the handler starts. Commands logs command outcomes within the handler and reports its own failures. Bus events deliver application notifications.
Runtime and Loader registries still hold their resource metadata and measurements, and bootstrap timings still describe startup.

Bootstrap and configuration validation use the native console for startup failures. Services registration, contract discovery, the Resolver, and
the Loader all participate in creating the logger or loading its provider. They retain their existing diagnostics because resolving the logger there
could occur before registration or make a provider log its own load. Bus listener handling retains console reporting because a provider can emit
Bus events and trigger the same listener failure path. The renderer's Component cleanup utility also retains its console fallback because it has no
service context. Definition-based Page and Component classes log through their loader context and the native Page host uses its injected services.

Preferences reports storage opening failures, write transaction aborts, and notification failures. Secrets limits logging to storage initialization
and committed-change notification failures using fixed messages. Filesystems reports provider import and construction failures using only the registered
scheme, and records notification failures after committing changes. Provider file operations own their errors and keep file-level details within their
existing operation paths.

## Manifest configuration

The implementation's static `optionsSchema` validates the effective `xshell.services.logger.options` before service construction.

| Field | Type | Default or requirement |
| --- | --- | --- |
| `provider` | String or null | Optional, defaults to null |
| `providers` | Object keyed by provider ID | Optional, defaults to `{}` |
| `providers.<id>.implementation` | Nonblank string | Required for each effective declaration |
| `providers.<id>.options` | Object | Optional, defaults to `{}` |

A module contributes a provider by naming it under `providers` and supplying its implementation path and optional defaults.

```jsonc
{
    "xshell": {
        "services": {
            "logger": {
                "options": {
                    "providers": {
                        "audit": {
                            "implementation": "/providers/logger-audit.js",
                            "options": {"endpoint": "app:/api/logs"}
                        }
                    }
                }
            }
        }
    }
}
```

Bootstrap normalizes `/providers/logger-audit.js` against the declaring module's asset root before merging the manifests. It merges Core first,
dependencies in dependency order, and the root application last. Contributions to the dictionary coexist. An options-only override preserves the
implementation and its module ownership. Provider-specific options are opaque to the logger and follow ordinary manifest path normalization.
For example, `app:/api/logs` resolves against the application base.

The root application selects the provider by adding this fragment to its manifest.

```jsonc
{"xshell": {"services": {"logger": {"options": {"provider": "audit"}}}}}
```

The root application can select the provider and override individual options in the same declaration.

```jsonc
{
    "xshell": {
        "services": {
            "logger": {
                "options": {
                    "provider": "audit",
                    "providers": {"audit": {"options": {"endpoint": "app:/api/application/logs"}}}
                }
            }
        }
    }
}
```

An explicit null selection disables logging even if an earlier manifest selects a provider.

```jsonc
{"xshell": {"services": {"logger": {"options": {"provider": null}}}}}
```

Invalid effective options fail service validation. An unknown selection, failure to resolve or load the selected implementation, constructor
failure, or missing callable `log()` rejects logger initialization with a service and provider diagnostic and stops startup.
