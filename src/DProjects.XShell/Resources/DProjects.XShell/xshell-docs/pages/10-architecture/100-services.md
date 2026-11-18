# Services

XShell services are named runtime capabilities. A contract is the stable public abstraction for a capability, while an implementation is the
concrete ES module class selected by `xshell.services`.

```jsonc
"xshell": {
    "services": {
        "audit": {
            "contract": "audit",
            "implementation": "/services/audit.js",
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
finalizes the registry. Configured service instances are not constructed during registration. The declarative `registry` service is then explicitly
resolved and initialized through `Services.initialize("registry")`. XShell next resolves the declarative `areas` service, validating its merged
`xshell.services.areas.options`, before module controllers execute. It then resolves the declarative `modules` singleton and explicitly awaits its
once-only initialization. Application definitions remain under top-level `config.modules`; Modules has no implementation options. After Modules
initialize, XShell explicitly invokes `Areas.init()` with that singleton to compose module contributions, then resolves the declarative `navigation`
service and awaits `Services.initialize("navigation")`. Each service's static `optionsSchema` validates its options immediately before lazy singleton
construction. This coordination is specific to startup ordering and does not introduce automatic dependency initialization.

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

## Lookup and construction

`Services.has(name)` reports whether a runtime or configured service name is registered. It only checks registry membership and never constructs a
configured service. `Services.resolve(name)` returns an existing runtime instance or lazily constructs the configured implementation as a singleton.
The implementation is validated against the contract's declared methods and properties when that singleton is first created.

Registration, construction, and asynchronous initialization are separate operations:

```js
await services.init();                 // Register configured implementations and freeze the topology
const service = services.resolve(id);  // Synchronously construct or retrieve the singleton
await services.initialize(id);         // Explicitly initialize the singleton and await readiness
```

`Services.resolve()` remains synchronous and never invokes a service's `init()` method. `Services.initialize(name)` resolves through that same
singleton path, requires a callable `init()`, and returns the service instance after initialization completes. Synchronous and asynchronous `init()`
implementations are both supported. Initialization runs once per service: concurrent callers share one operation, and later calls return the already
initialized singleton without invoking `init()` again. A thrown or rejected error is retained and propagated to every later caller without retry or
singleton reconstruction. The constructed service remains available through `resolve()` for inspection. A service without `init()` fails with a
descriptive error. Neither registration nor the mere presence of `init()` triggers initialization; XShell remains responsible for explicit ordering.

Parameterized service setup remains separate. In particular, Areas continues to use `areas.init({ modules })`, and services such as I18n retain their
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
validates and passes a new empty object. A missing or invalid `optionsSchema`, or options that fail it, produce a service-specific error without
invoking the constructor or emitting `xshell:service:created`; the service remains registered and may be resolved again. Validation does not mutate
the schema or options. Options remain private construction data and are not included in `services.registry` or `services.getServiceInfo()` metadata.

`Services` owns its mutable runtime service records internally. `services.registry` returns a read-only snapshot of the current service metadata:
each entry has `id`, construction `state`, `initializationState`, `contractId`, `contractUrl`, `description`, `icon`, `moduleId`,
`implementationName`, `url`, `size`, and `time`. Initialization state is `not-initialized`, `initializing`, `initialized`, or `failed`.
Unavailable values are `null`. The returned array and entries are frozen, contain no live instances or implementation classes, and may become
stale as services are resolved. `services.getServiceInfo(name)` returns the same projected metadata for one service, or `undefined` if absent.
Live services are obtained only through `services.resolve(name)`. The registry topology remains immutable after `Services.init()`, while internal
records change lifecycle state and acquire instances during lazy construction.

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
    -> Services.has(name)       existence only
    -> Services.resolve(name)   options validation, lazy singleton construction, and contract validation
    -> Services.initialize(name) explicit, asynchronous, once-only service initialization
    -> Services.registry        read-only snapshot of service metadata
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
`label`, `description`, `icon`, `types`, `properties`, `events`, `methods`, and `examples` fields are all optional. The accepted value
types are `string`, `number`, `integer`, `boolean`, `object`, `array`, `function`, `date`, and `any`; method returns additionally
accept `void`.

- `types` maps nonempty, contract-local names to reusable definitions. Each definition requires `type` and may set `description` and
  JSON Schema Draft 2020-12 `schema`.
- Properties select exactly one of direct `type` or local `ref`, and can describe labels, defaults, required/read-only status, string enums, and
  additional JSON Schema constraints.
- Events describe labels, descriptions, and a `detail` field map. Each detail field selects exactly one of `type` or `ref`.
- Methods describe labels, parameters, and returns. Each parameter requires a nonempty `name` and selects exactly one of `type` or `ref`;
  a return does the same and may add the semantic `format` `text`, `url`, or `blob-url` when its effective type is `string`.
- Examples require a valid `name` and nonempty `template`, with optional `description` and `state`.

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
negotiation, scopes, or selectable lifetimes.

See [Shared contract model](../20-components/10-manifest.md#shared-contract-model) for the common descriptor grammar used by other XShell elements.

## Resolution validation and core services

Declared methods must resolve to functions. Property validation finds descriptors on the instance/prototype chain, excluding Object.prototype;
it does not evaluate property getters. This validation runs when a configured singleton is constructed and when a directly registered built-in is
associated with a contract. Defaults, enums, readonly, and property types are descriptive, as are method parameters/returns and events. An
implementation must emit any promised events itself.

Construction receives the proxy resolving other services by name as its first argument and its implementation `options` as the second. Immediately
before construction, XShell validates those options against the implementation's mandatory static `optionsSchema`. Resolving a service already
being constructed detects a circular constructor dependency and reports the resolution chain. Failed options validation, construction, or contract
validation resets that record so a later resolve can retry.
Duplicate registrations, including collisions with core names, fail.

After a configured service is first constructed and validated, XShell emits `xshell:service:created` on the Bus with `{ id }`. Failed attempts emit no
created event. Consumers can re-read `services.registry` to inspect the current state.

The directly registered core names are `bus`, `config`, `loader`, `resolver`, `contracts`, and `services`. `areas`, `commands`, `dialog`, `i18n`,
`jsonValidator`, `modules`, `navigation`, `preferences`, `registry`, `runtime`, `secrets`, `tasks`, and `temp` are framework-owned configured services
registered through `xshell.services`. Modules still receives `bus`, `config`, `loader`, `resolver`, and `services` through normal constructor
injection; its controller provider continues to expose named singleton services plus module-specific `moduleAssetsPath` and `moduleConfig` values.
There is no auth/identity registration. A Diagnostics getter is not a registered service contract.

See [Bus](../30-subsystems/20-bus.md), [Dialogs](../30-subsystems/30-dialogs.md), [Temp](../30-subsystems/50-temp.md),
[Tasks](../30-subsystems/80-tasks.md), [Commands](../30-subsystems/90-commands.md), [Secrets](../30-subsystems/100-secrets.md), and
[Preferences](../30-subsystems/110-preferences.md).
