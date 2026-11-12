# Services

XShell services are named runtime capabilities. A contract is the stable public abstraction for a capability, while an implementation is the
concrete ES module class selected by `xshell.services`.

```jsonc
"xshell": {
    "services": {
        "toast": {
            "contract": "toast",
            "implementation": "/services/toast-default.js"
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
finalizes the registry. Configured service instances are not constructed during initialization.

The `theme` service is the one explicit startup exception. The X module controller declares `theme` as a constructor dependency, so normal service
injection resolves it while modules initialize and before navigation renders UI. The saved `system`, `light`, or `dark` mode is therefore applied to
the root `data-theme` attribute without waiting for a Page or layout. The service remains the single source of truth and emits
`x:theme:changed` with `{ mode }` on the Bus when the selected mode changes. Restoring the selected mode at startup and operating-system appearance
changes while `system` is selected do not emit this event. Native CSS `color-scheme` and `light-dark()` continue to resolve the visual palette;
`system` is represented by an absent root attribute.

This startup integration does not run until asynchronous configuration, contract, and implementation discovery reaches `XShell.init()`. It avoids
an incorrect theme during XShell UI rendering, but it cannot guarantee that a browser will not paint the host document once before a saved forced
mode is restored. Preventing that earlier host-document flash would require integration before the current asynchronous bootstrap boundary.

`Services.register()` is therefore an initialization-time API. Core/runtime services are registered before `Services.init()`, and configured
services from `xshell.services` are registered during it. Once initialization completes, the registry topology is immutable: modules, Components,
and Pages can resolve existing services but cannot dynamically add or replace providers after startup. A later `Services.register()` call throws a
registry-immutability error. Service objects may still own mutable runtime state; freezing the registry does not freeze those objects.

This fixed topology provides deterministic service resolution and prevents provider mutation while the application is running.

## Lookup and construction

`Services.has(name)` reports whether a runtime or configured service name is registered. It only checks registry membership and never constructs a
configured service. `Services.resolve(name)` returns an existing runtime instance or lazily constructs the configured implementation as a singleton.
The implementation is validated against the contract's declared methods and properties when that singleton is first created.

`Services` owns its mutable runtime service records internally. `services.registry` returns a read-only snapshot of the current service metadata:
each entry has `id`, `state`, `contractId`, `contractUrl`, `description`, `icon`, `moduleId`, `implementationName`, `url`, `size`, and `time`.
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
    -> Services.resolve(name)   lazy singleton construction and contract validation
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
the framework-owned default provider declared as `xshell.services.temp`, whose implementation is `xshell/temp.js`. Bootstrap normalizes framework
implementation paths into the framework asset namespace and generates an `esm:` resolver rule with `moduleId: "xshell"`, so framework services
use the same loading and inspection pipeline as module-provided services. Applications may replace the Temp implementation through normal
configuration merging without assigning it to the `x` module.

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

Construction receives a proxy resolving other services by name. Resolving a service already being constructed detects a circular constructor
dependency and reports the resolution chain. A failed construction/validation resets that record so a later resolve can retry.
Duplicate registrations, including collisions with core names, fail.

After a configured service is first constructed and validated, XShell emits `xshell:service:created` on the Bus with `{ id }`. Failed attempts emit no
created event. Consumers can re-read `services.registry` to inspect the current state.

The directly registered core names are `areas`, `bus`, `config`, `dialog`, `i18n`, `loader`, `modules`, `navigation`, `resolver`,
`runtime`, `contracts`, and `services`. `temp` is a framework-owned configured service registered through `xshell.services`; its compatibility
`xshell.temp` accessor resolves that same lazy singleton. There is no auth/identity registration. A Diagnostics getter is not a registered service
contract.

See [Bus](../30-subsystems/20-bus.md), [Dialogs](../30-subsystems/30-dialogs.md), and [Temp](../30-subsystems/50-temp.md).
