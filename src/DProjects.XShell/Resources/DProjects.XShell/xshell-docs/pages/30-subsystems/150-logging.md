# Logging

XShell Core registers the `logger` singleton by default. Core defines the service and provider contracts. Modules can contribute implementations and
their defaults, and the application selects the provider and overrides its options.

## Console provider

The optional `x-logger` module provides one logging provider, `console`. Add `x-logger` to the root module's existing dependencies to make it available.

```jsonc
"dependencies": {
    "x-logger": "module:x-logger:latest"
}
```

Select `console` in the application manifest to enable console logging.

```jsonc
{"xshell": {"services": {"logger": {"options": {"provider": "console"}}}}}
```

The provider forwards the original arguments synchronously, preserving native console formatting and stack traces. It has no provider-specific options.

| Logger level | Native console method |
| --- | --- |
| `trace` | `console.trace()` |
| `debug` | `console.debug()` |
| `info` | `console.info()` |
| `warn` | `console.warn()` |
| `error` | `console.error()` |

Logging stays disabled when no provider is selected. Set `provider` to `null` in the application manifest to disable logging explicitly.

## Logger contract

Inject `logger` by name using ordinary [service consumption](../10-architecture/100-services.md), such as a Page or Component controller.

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

## Provider contract

A provider default-exports a class. Its constructor receives the logger's standard XShell service dependencies and the effective provider options
as `constructor(dependencies, options)`. The class implements `log(level, ...args)`, where `level` is `trace`, `debug`, `info`, `warn`, or
`error`. For example, the call above reaches the provider as `log("debug", "Inventory: refresh completed", {count})`.

XShell awaits logger initialization before starting module controllers. Initialization uses the standard ESM resolver and loader to import only
the selected implementation, constructs it once, and checks that it exposes a callable `log`. With logging disabled, startup skips provider
loading and construction.

The logger invokes the provider synchronously and suppresses any exception the provider throws during the call. Providers own completion and error
handling for asynchronous work. The logger ignores the return value of `log()`.

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
