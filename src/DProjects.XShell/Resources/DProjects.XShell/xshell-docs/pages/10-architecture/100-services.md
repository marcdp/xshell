# Services

XShell services are named runtime capabilities. A contract is the stable public abstraction for a capability, while an implementation is the
concrete ES module class selected by `xshell.services`.

```jsonc
"xshell": {
    "services": {
        "audit": {
            "contract": "audit",
            "implementation": "/services/audit.js",
            "lifetime": "transient",
            "options": {
                "endpoint": "/api/audit"
            }
        }
    }
}
```

These are three separate objects:

- the **service contract** is a JSON document discovered from an inventoried `contracts/*.json` resource;
- the **service registration** is the `xshell.services.<name>` entry that selects a contract id and implementation resource; and
- the **service implementation** is the default-exported class loaded from that resource.

During startup, XShell discovers and validates contracts, registers its core/runtime service instances, and calls `Services.init()`. That method
validates every configured contract reference, eagerly loads each configured implementation class, registers the implementation metadata, and then
finalizes the registry. Configured service instances are not constructed during registration. XShell initializes the [Logger](../30-subsystems/150-logging.md)
singleton before module controllers run. XShell resolves the declarative `areas` and `menus` singletons to validate Area options and menu
selections and expose global menus. It then awaits initialization of the `modules` singleton. Module controllers can register named menu
sources during initialization. XShell initializes Menus to contextualize the selected definitions, then calls `Areas.init()` to compose
routes and derive each Area's home from its navigation menu. Navigation initializes next, followed by MenuShortcuts. Each service's static
`optionsSchema` validates its options before construction. Every declarative registration explicitly declares its `lifetime`.

The `theme` service is the one explicit startup exception. The X module controller declares `theme` as a constructor dependency, so normal service
injection resolves it while modules initialize. The service starts with `system` and restores a saved `system`, `light`, or `dark` mode asynchronously
through Preferences. It applies a saved forced mode to the root `data-theme` attribute when the read completes. The service remains the single source
of truth and emits `x:theme:changed` with `{ mode }` on the Bus when a selection or restoration changes the mode. A newer selection takes precedence
over an unfinished restore. Native CSS `color-scheme` and `light-dark()` continue to resolve the visual palette;
`system` is represented by an absent root attribute.

This startup integration does not run until asynchronous configuration, contract, and implementation discovery reaches `XShell.init()`. A saved forced
mode may take effect after the initial UI render because the preference read is asynchronous. Preventing an earlier host-document flash would require
integration before the current asynchronous bootstrap boundary.

`Services.register()` is therefore an initialization-time API. Core/runtime services are registered before `Services.init()`, and configured
services from `xshell.services` are registered during it. Once initialization completes, the registry topology is immutable: modules, Components,
and Pages can resolve existing services but cannot dynamically add or replace providers after startup. A later `Services.register()` call throws a
registry-immutability error. Service objects may still own mutable runtime state; freezing the registry does not freeze those objects.

This fixed topology provides deterministic service resolution and prevents provider mutation while the application is running.

## Lifetimes, scopes, and resource ownership

The application creates one root `Services` instance. `Services.beginScope()` creates another `Services` instance with the caller as its direct
parent. Scopes can be nested, and each parent tracks its immediate children. All scopes share the application's root registration records; a child
does not copy registrations and cannot call `register()` or initialize the registry with `init()`.

Each `xshell.services.<name>` registration must set `lifetime` to `singleton`, `scoped`, or `transient`. There is no configured-service default;
omitting the field, using `null`, an empty string, or any other value fails final merged-configuration validation. This is an intentional
configuration-contract change. Options-only module contributions remain valid inputs to composition when the final merged definition supplies the
required contract, implementation, and lifetime.

- A **singleton** is lazily constructed and cached by the root. Root, sibling, and nested scope resolutions return the same instance.
- A **scoped** service is lazily constructed and cached by the explicit child scope that resolves it. Sibling and nested scopes own different
  instances. Root resolution throws instead of creating an application-wide scoped instance.
- A **transient** is constructed on every resolution. A child scope owns disposable transients it creates; a transient resolved through the root is
  owned by the root until explicit root disposal.

Programmatically registered preconstructed core instances are separate from declarative configuration. `Services.register(name, instance)` keeps
those instances as application singletons without requiring an artificial configuration lifetime.

Scope creation does not construct or initialize services, and there is no ambient current scope. For example, a scope can combine application
singletons with scope-specific services:

```js
const scope = services.beginScope();

try {
    const preferences = scope.resolve("preferences");
    const editorSession = scope.resolve("editorSession");
    // preferences is shared; editorSession belongs to this scope.
} finally {
    await scope.dispose();
}
```

`scope.addDisposable(resource)` gives a scope explicit ownership of a resource with a callable synchronous or asynchronous `dispose()` method.
Each object is registered at most once per scope. Scoped and transient instances with a callable `dispose()` method are registered automatically
after successful construction. Non-disposable transients are not retained. Singleton services are never automatically added to child ownership.
The framework registers `events` and `timer` as disposable transient services, so every resolution creates a new scope-owned helper.

Disposal immediately closes the scope to new child scopes, resolutions, initialization requests, and disposable registrations. Descendants also
reject those operations as soon as an ancestor begins disposal. Cleanup recursively disposes immediate children in reverse creation order, then
directly owned resources in reverse registration order. It awaits asynchronous cleanup and continues after failures. One failure is rethrown; two
or more are reported with `AggregateError` after all cleanup attempts. Concurrent `dispose()` calls share one operation, later calls do not repeat
cleanup, and a completed child detaches from its parent. Disposing a child leaves its parent and siblings active. Disposing the root follows the same
hierarchy but does not automatically dispose its registered singleton instances, and XShell shutdown does not invoke root disposal in this phase.

Module controllers, definition-based Pages and Components, and Command and Query invocations automatically receive independent owner scopes.
Every automatic owner scope is a direct child of the application root, regardless of Module ownership, DOM, Page composition, or initiating UI. A
Module controller does not inherit a UI scope, a Component inside a Page does not inherit the Page scope, nested or sibling Components do not
inherit one another's scopes, and Commands and Queries do not inherit UI scopes. This intentionally avoids DOM lookup, scope reparenting,
invocation-supplied ownership, and ambient current-scope state. A Module with no `/module.js` controller creates no owner scope.

Their controller providers keep the existing special injections and resolve ordinary service names through the owner scope. The special
`controller({ services })` injection returns that same owner scope, so controller code can explicitly resolve or initialize additional services or
create nested scopes. Global `xshell.services` still returns the root container. Page and Component owner scopes survive temporary Page
unmount/remount and Component disconnect/reconnect cycles, then are awaited and disposed after controller unload and existing non-service cleanup
during final unload. A Command retains its scope until execution settles, and `Command.dispose()` then disposes it and clears Command-owned
references. The Modules service privately retains one scope for each Module controller: `start()` and `stop()` run while it is active, and Modules
disposes it after `stop()` completes. Consequently, repeated scoped resolution within one Module controller returns one instance, while different
Module controllers receive different scoped instances; application singletons remain shared and transients remain per-resolution.

`beginScope({ context })` optionally supplies explicit owner-specific construction context. It is not a registered service and is available only as
the reserved `scopeContext` constructor dependency while that scope constructs scoped or transient instances. Singleton construction always uses
the root context and cannot capture child owner state. Disposal releases the scope's context reference.

Module, Page, and Component scopes provide an `invokeController` context callback. The transient `events` and `timer` services use it for string
listeners, preserving constructor/controller injection and controller `this` binding without ambient state. Function listeners work in any scope,
including Command scopes with no owner callback; a string listener in such a scope reports a clear error. Module shutdown, final Page unload, and
final Component unload dispose their scopes, remove listeners, cancel timers, and release callback references exactly once.

Command controller providers similarly resolve ordinary services through the Command-owned scope, while `controller({ services })` returns that
scope and `controller({ task })` retains the Task execution context. The high-level Commands service and direct framework construction paths await
`Command.dispose()` after execution, so Task completion waits for scope cleanup. Cancellation remains cooperative: aborting the Task does not
dispose a scope while Command code is still running. Foreground and background Commands use the same independent ownership model.

The Queries service creates an owner scope for each invocation and awaits its disposal after execution and return validation. Query controllers
resolve ordinary services through that scope and receive it through `controller({ services })`.

Class-based Page and Component exports remain unchanged and do not receive definition-loader integration.

## Lookup and construction

`Services.has(name)` reports whether a runtime or configured service name is registered. It only checks root registry membership and never
constructs a service. `Services.resolve(name)` remains synchronous and selects the instance owner from the registration lifetime. Singleton and
scoped instances are cached by their root or child owner; transient instances are not cached. Every newly constructed instance is validated against
the contract's declared methods and properties.

Registration, construction, and asynchronous initialization are separate operations:

```js
await services.init();                 // Register configured implementations and freeze the topology
const scope = services.beginScope();
const service = scope.resolve(id);      // Synchronously resolve according to the configured lifetime
await scope.initialize(id);             // Explicitly initialize a singleton or this scope's scoped instance
```

`Services.resolve()` never invokes `init()`. `Services.initialize(name)` requires a callable `init()` and supports synchronous or asynchronous
implementations. Singleton initialization runs once per application and remains shared across scopes. Scoped initialization runs once per owning
scope; sibling scopes retain independent success, failure, and in-flight operations. Concurrent callers for the same owned instance share one
operation, and a failure is retained without automatic retry or reconstruction. Scope disposal waits for its in-flight scoped initialization to
settle before disposing that instance. It does not wait for singleton initialization owned by the root.

Name-based transient initialization is intentionally unsupported because no cached instance corresponds to the registration name.
`scope.initialize("formatter")` throws for a transient; callers explicitly resolve and initialize the particular instance they own. Neither
registration nor the mere presence of `init()` triggers initialization.

## Constructor dependency lifetimes

The implementation constructor still receives a lazy service provider and validated options:

```js
constructor({ preferences, documentState }, options) {
    this.preferences = preferences;
    this.documentState = documentState;
}
```

Dependencies resolve through the context that owns the constructed instance. Singleton constructors use the root context. Scoped constructors use
their child scope. Transients use the context in which that transient was requested. This explicit propagation lets a scoped service and its
transient dependencies share the same scoped dependency without global current-scope state.

The reserved `constructor({ services })` dependency returns that same construction context rather than resolving the registered root `services`
singleton. A singleton therefore receives root Services, while scoped and transient instances receive the scope that owns their construction.
This constructor-only behavior does not change `scope.resolve("services")`, which continues to return the registered root singleton.

A singleton may depend on other singletons and on transients whose complete constructor graph is scope-free. It cannot capture a scoped service
directly or through one or more transients. Scoped services may depend on singletons, same-scope scoped services, and transients. A transient may
depend on a scoped service only when created in an active child scope and outside a singleton construction graph. Violations report the constructor
dependency chain and never promote the scoped instance to application lifetime.

One construction stack detects cycles across every lifetime combination, including singleton-to-singleton, scoped-to-transient-to-scoped, and
transient-to-singleton-to-transient paths. Failed options validation, construction, contract validation, lifetime validation, or cycle detection
does not leave an invalid cached instance.

Parameterized service setup remains separate. Areas uses `areas.init({ modules, menus })`, and services such as I18n retain their
existing parameterized semantics rather than using `Services.initialize(name)`.

Each configured service may declare an optional `options` object. Every configured implementation class must declare a static `optionsSchema`
JSON Schema object describing that private constructor configuration. XShell passes the existing lazy service-injection proxy as the first
constructor argument and the validated `options` object as the second:

```js
export default class Audit {
    static optionsSchema = {
        type: "object",
        properties: {
            endpoint: { type: "string", minLength: 1 }
        },
        required: ["endpoint"],
        additionalProperties: false
    };

    constructor({ bus, loader }, options = {}) {
        this._bus = bus;
        this._loader = loader;
        this._endpoint = options.endpoint;
    }
}
```

An implementation with no configurable settings still declares a restrictive schema:

```js
static optionsSchema = {
    type: "object",
    additionalProperties: false
};
```

`optionsSchema` uses JSON Schema Draft 2020-12 syntax and belongs to the implementation class, not the public service contract. Injected services,
implementation configuration, and the public contract remain distinct: dependencies resolve by name through the first constructor argument,
`options` is private implementation configuration, and the contract describes the public runtime API.

`Services.resolve()` validates the complete configured options object immediately before invoking the constructor. When `options` is absent, it
validates and passes a new empty object. A missing or invalid `optionsSchema`, or options that fail it, produce a service-specific error before
invoking the constructor. The service remains registered and may be resolved again. Validation does not mutate
the schema or options. Options remain private construction data and are not included in `services.registry` or `services.getServiceInfo()` metadata.

`Services` owns its mutable runtime service records internally. `services.registry` returns a read-only snapshot of application registration metadata:
each entry has `id`, `lifetime`, construction `state`, `initializationState`, `contractId`, `contractUrl`, `description`, `icon`, `moduleId`,
`implementationName`, `url`, `size`, and `time`. Initialization state is `not-initialized`, `initializing`, `initialized`, or `failed`.
Unavailable values are `null`. The returned array and entries are frozen, contain no live instances or implementation classes, and may become
stale as singleton services are resolved. `services.getServiceInfo(name)` returns the same projected metadata for one service, or `undefined` if
absent. Because the registry is global, scoped and transient entries remain `registered` and `not-initialized`; per-scope instances and initialization
state are deliberately not exposed. Live services are obtained only through `resolve(name)`. The topology remains immutable after `Services.init()`.

For a declared contract property, V0 validation succeeds when a descriptor with that name exists on the instance or its prototype chain. Validation
checks presence only: it does not read values, invoke getters, or validate runtime property types. `readonly: true` is contract metadata, and V0
does not require non-readonly properties to have a setter or writable descriptor; mutability semantics are not enforced.

```text
startup
    -> register core/runtime instances
    -> Services.init()
    -> load configured implementation classes
    -> register implementation metadata
    -> finalize registry topology

runtime
    -> Services.has(name)        existence only
    -> Services.beginScope()     explicit child ownership context
    -> Services.resolve(name)    lifetime selection, validation, and synchronous construction
    -> Services.initialize(name) once per singleton or scope-owned instance; unsupported for transients
    -> Services.dispose()        hierarchical reverse-order cleanup
    -> Services.registry         read-only application registration metadata
```

## Module requirements and controller access

A module may declare `requires` as service names that must already exist in the finalized registry:

```jsonc
"orders": {
    "requires": ["toast"]
}
```

XShell checks these names with `Services.has()` before loading or starting any module controller. A requirement validates availability without
constructing the service. These concepts remain distinct:

- `module.requires` declares services the module expects the runtime to provide;
- implementation `dependencies` declares concrete resources for a Component or Page and loads them through Resolver and Loader; and
- `controller({ serviceName })` resolves and injects an existing runtime service when the controller accesses it.

See [Modules](30-modules.md), [Module Specification](../50-specifications/module.md), and [Loaders](90-loaders.md).

## Contract discovery and identity

`/contracts/*.json` resources (including nested paths) enter the XShell framework or module inventory. Bootstrap converts their relative path
without `.json` into a global id and generates an exact `contract:<id>` rule. Resolver selects `object-json`; Loader reads JSON; Contracts validates
it against `service.schema.json`, which reuses `contract.schema.json`, and records physical ownership. Duplicate global ids or conflicting exact
resolver entries fail bootstrap.
A module prefix is not required unless it is part of the chosen id. Registration names are independent: multiple services can use one contract.

For example, `x/contracts/toast.json` defines id `toast` and registration `xshell.services.toast.contract = "toast"`.
The implementation URL is imported through `esm:` and must default-export a class.

Framework contracts use the same JSON format and validation. For example, `xshell/contracts/temp.json` defines `temp`; XShell associates it with
the framework-owned default provider declared as `xshell.services.temp`, whose implementation is selected by that registration. Bootstrap
normalizes framework implementation paths into the framework asset namespace and generates an `esm:` resolver rule with `moduleId: "xshell"`,
so framework services use the same loading and inspection pipeline as module-provided services. Applications may replace the Temp implementation
through normal configuration merging without assigning it to the `x` module.

## Service contract schema

`service.schema.json` specializes the common contract by referencing `contract.schema.json` and closing the top-level object. The common
`label`, `description`, `icon`, `tags`, `types`, `properties`, `events`, `methods`, and `examples` fields are all optional. The accepted value
types are `string`, `number`, `integer`, `boolean`, `object`, `array`, `function`, `date`, and `any`; method returns additionally
accept `void`.

- `types` maps nonempty, contract-local names to reusable definitions. Each definition requires `type` and may set `description` and
  JSON Schema Draft 2020-12 `schema`.
- Properties select exactly one of direct `type` or local `ref`, and can describe labels, defaults, required/read-only status, string enums, and
  additional JSON Schema constraints.
- Events describe labels, descriptions, and a `detail` field map. Each detail field selects exactly one of `type` or `ref`.
- Methods describe labels, parameters, and returns. Each parameter requires a nonempty `name` and selects exactly one of `type` or `ref`;
  a return does the same and may add the semantic `format` `text`, `url`, or `blob-url` when its effective type is `string`.
- Declare [usage examples](../20-components/10-manifest.md#usage-examples) in the top-level `examples` array of the Service contract JSON file.
- Declare optional lowercase kebab-case classification identifiers in the top-level `tags` array. They describe the public Service contract,
  appear in generated `file.resource.tags`, and never belong to the implementation's `optionsSchema`, constructor options, or instance state.

`type` declares an XShell value category directly. `ref` names a definition in the same contract's `types` map and cannot be combined with
`type` or `schema`. A direct type descriptor or named type definition may add a JSON Schema object or boolean in `schema`; nested object and
array constraints use standard JSON Schema keywords there.

For method returns, `type` describes the runtime value shape and optional `format` describes its semantic meaning and preferred presentation.
An omitted format uses the default presentation for the declared type. Formats do not wrap or coerce the value returned by the Service method:
for example, a method with `returns: { "type": "string", "format": "url" }` still returns the URL string itself. `blob-url` presentation does
not transfer ownership of the object URL or revoke it.

A named type can be reused throughout one service contract:

```json
{
    "label": "Tasks",
    "types": {
        "task": {
            "type": "object",
            "description": "A task record",
            "schema": {
                "type": "object",
                "required": ["id"],
                "properties": { "id": { "type": "string" } }
            }
        }
    },
    "properties": {
        "selectedTask": { "ref": "task", "readonly": true }
    },
    "methods": {
        "save": {
            "parameters": [{ "name": "task", "ref": "task" }],
            "returns": { "ref": "task" }
        }
    },
    "events": {
        "changed": { "detail": { "task": { "ref": "task", "required": true } } }
    }
}
```

Contract registration checks the schema shape, the object/boolean form of `schema`, and that every property, event-detail, parameter, and return
`ref` names a type in that same contract.
Named types and references are descriptive metadata. They do not validate runtime property values, method arguments or returns, or event payloads.
There is no recursive reference resolution, cross-contract type lookup, type generation, generics, inheritance, parameter checking, version
negotiation, or DOM-derived Services scope inheritance.

See [Shared contract model](../20-components/10-manifest.md#shared-contract-model) for the common descriptor grammar used by other XShell elements.

## Resolution validation and core services

Declared methods must resolve to functions. Property validation finds descriptors on the instance/prototype chain, excluding Object.prototype;
it does not evaluate property getters. This validation runs whenever a configured instance is constructed and when a directly registered built-in is
associated with a contract. Defaults, enums, readonly, and property types are descriptive, as are method parameters/returns and events. An
implementation must emit any promised events itself.

Construction receives the proxy resolving other services by name as its first argument and its implementation `options` as the second. Immediately
before construction, XShell validates those options against the implementation's mandatory static `optionsSchema`. Resolving a service already
being constructed detects a circular constructor dependency and reports the resolution chain. Failed options validation, construction, or contract
validation resets any singleton or scoped cache record so a later resolve can retry; a failed transient is never cached.
Duplicate registrations, including collisions with core names, fail.

Successful singleton construction updates the state reported by `services.registry`. The Services diagnostics Page reads a fresh registry snapshot
on load, when its filters change, and when the user clicks Refresh.

The directly registered core names are `bus`, `config`, `loader`, `resolver`, `contracts`, and `services`; these preconstructed registrations are
singletons. `areas`, `commands`, `dialog`, `i18n`,
`jsonValidator`, `modules`, `navigation`, `preferences`, `queries`, `registry`, `runtime`, `secrets`, `tasks`, and `temp` are framework-owned services
registered through `xshell.services`. Modules still receives `bus`, `config`, `loader`, `resolver`, and `services` through normal constructor
injection; each Module controller provider exposes its owner scope as `services`, resolves named services through that scope, and retains the
module-specific `moduleAssetsPath` and `moduleConfig` values.
There is no auth/identity registration. A Diagnostics getter is not a registered service contract.

See [Bus](../30-subsystems/20-bus.md), [Dialogs](../30-subsystems/30-dialogs.md), [Temp](../30-subsystems/50-temp.md),
[Tasks](../30-subsystems/80-tasks.md), [Commands](../30-subsystems/90-commands.md), [Queries](../30-subsystems/95-queries.md), [Secrets](../30-subsystems/100-secrets.md), and
[Preferences](../30-subsystems/110-preferences.md).
