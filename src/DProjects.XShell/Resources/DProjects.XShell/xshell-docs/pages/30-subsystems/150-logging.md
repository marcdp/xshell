# Logging

XShell Core registers the `logger` singleton by default. Core defines the service and provider contracts. Modules can contribute implementations and
their defaults, and the application selects the provider and overrides its options. A future optional module named `x-logger` can use the same
configuration as any other module.

## Logger contract

Inject `logger` by name using ordinary [service consumption](../10-architecture/100-services.md), such as a Page or Component controller.

```javascript
controller({logger}) {
    return {
        reportResponse(response) {
            logger.warn("Unexpected response", response);
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
`error`. For example, the call above reaches the provider as `log("warn", "Unexpected response", response)`.

XShell awaits logger initialization before starting module controllers. Initialization uses the standard ESM resolver and loader to import only
the selected implementation, constructs it once, and checks that it exposes a callable `log`. With logging disabled, startup skips provider
loading and construction.

The logging call invokes the provider directly. A synchronous exception propagates to the caller. Providers that do asynchronous work own its
completion and error handling. The logger ignores the return value of `log()`.

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
