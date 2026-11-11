# AGENTS.md

## Scope and source of truth

Treat this repository as the complete XShell project. The primary implementation is under `src/DProjects.XShell/`; runtime resources under
`src/DProjects.XShell/Resources/DProjects.XShell/` may be referenced dynamically and are not unused merely because static imports do not find them.

Determine current behavior in this order:

1. implementation;
2. schemas and validation performed by runtime consumers;
3. .NET and client-runtime tests plus representative `x-demo` usages;
4. canonical documentation;
5. ADRs.

Do not infer behavior from other frameworks or repositories. Treat Draft, TODO, proposed, and future-work documentation as unimplemented. If sources
disagree, investigate and document the discrepancy.

## Important paths

```text
src/DProjects.XShell/                                      # .NET host, commands, middleware, and services
src/DProjects.XShell/Resources/DProjects.XShell/xshell/    # browser runtime, loaders, engines, schemas
src/DProjects.XShell/Resources/DProjects.XShell/x/         # core UI module
src/DProjects.XShell/Resources/DProjects.XShell/x-demo/    # representative examples
src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/ # canonical documentation
test/DProjects.XShell.Test/                                # .NET tests
test/DProjects.XShell.Client.Test/                         # Node client-runtime tests
```

Documentation section landing pages are named `index.md`. Use relative documentation links, preserve existing URLs and headings where practical,
and never create a second canonical documentation tree. ADRs live under `pages/60-adr/`; do not renumber them.

## Working procedure

For non-trivial work:

1. inspect the implementation and nearby analogous code;
2. search consumers and usages;
3. inspect relevant schemas, validation sites, tests, documentation, and ADRs;
4. make the smallest coherent change while preserving terminology and architectural boundaries;
5. update affected schemas, tests, demos, documentation, or ADRs only when the contract or behavior requires it;
6. run relevant validation and report only checks actually executed.

Do not change runtime behavior to make outdated documentation appear correct. Do not mass-format or refactor unrelated code.

## Architectural boundaries

Preserve these distinctions:

```text
resolver           != loader
contract           != implementation
public properties  != private state
state engine       != render engine
loader lifecycle   != engine responsibility
module definition  != module reference != runtime module instance
module defaults    != global xshell.ui configuration
module             != Area
Page               != Navigation
configuration      != runtime state
configUrl          != assets.url
package production != Service Worker package consumption
```

Use the canonical documentation for detailed behavior:

- [Architecture](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/10-architecture/index.md)
- [Components](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/20-components/index.md)
- [Subsystems](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/30-subsystems/index.md)
- [Specifications](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/50-specifications/index.md)
- [ADRs](src/DProjects.XShell/Resources/DProjects.XShell/xshell-docs/pages/60-adr/index.md)

In particular:

- preserve JSONC manifests and their useful comments;
- classify a manifest as the XShell framework manifest only when its immediate parent directory is `xshell`; all others are module manifests;
- keep the selected root module distinct from `config.app` and from the composed application;
- keep the host-fixed effective `/_assets` namespace and `xshell.assets.basePath` semantics aligned with ADR-0001;
- do not describe authored `configUrl` values as browser dependency discovery in the active repository-driven bootstrap;
- keep module `defaults.component` and `defaults.page` separate from global `xshell.ui` infrastructure;
- treat Areas as navigation contexts composed from module contributions, not as module instances;
- keep friendly navigation paths distinct from canonical Page/resource hrefs;
- keep reusable package creation distinct from Service Worker ZIP consumption, and do not describe repository-driven production application packing
  as complete while `Pack.cs` retains its legacy discovery/startup path.

## Components, Pages, and contracts

A Component module default-exports either a Web Component class or a definition object. A definition-based Component or Page declares its public
contract inline as the optional `contract` property of that default-exported definition:

```js
export default {
    contract: { properties: {}, events: {}, methods: {}, slots: {} },
    state: {},
    controller() { return {}; }
};
```

There is no separate named `export const contract` input to the current loaders. The shared vocabulary is defined by
`xshell/schemas/contract.schema.json`; complete Component and Page definitions are validated against `component.schema.json` and `page.schema.json`
at their loader validation sites. Service contracts are validated by `xshell/contracts.js`. Effective configuration schema validation is performed
by `xshell/xshell.js`; there is no general `xshell/validation/` directory for Component, Page, or configuration definitions.

Properties are public API and state is private reactive data. A property joins state only through `state: true`. Controller methods are private by
default; only methods declared in `contract.methods` become public element methods. Slot metadata documents and validates composition but does not
create `<slot>` elements. Definition dependencies use the ordinary Resolver -> Loader pipeline. A Page reuses the general definition model and adds
navigation responsibilities; do not move those responsibilities into generic Component infrastructure.

The loader orchestrates contracts, controllers, public API, lifecycle, and engines. A state engine owns reactive state; a render engine owns output.
Do not introduce a parallel Component model or infer X Template behavior from other template languages. The normative X Template specification is
`xshell-docs/pages/40-extensions/x-templates/10-specification.md`.

## Schemas, configuration, and compatibility

When changing a contract or configuration model, inspect the schema, its actual validation caller, runtime consumers, tests, and documentation.
Do not use documentation alone as proof that a field is supported, and do not assume descriptive fields are runtime-enforced.

Treat module/configuration fields and ids, custom-element names, public contracts, JavaScript exports, engine and loader names, resolver resource
types, X Template syntax, asset URLs, navigation semantics, and documentation URLs as potentially public. Intentional breaking changes require
updates to known consumers, schemas, tests/demo code, documentation, and relevant ADRs.

Generated file inventories belong to the owning module or framework descriptor. Do not manually maintain generated `files` metadata in authored
manifests, put `files` on module references, or contribute `xshell.files` from module/root descriptors.

## Coding and validation

Follow the style already used by the edited file and nearby implementation. The repository has no checked-in `.editorconfig`; do not claim one is
authoritative. For C#, preserve the existing block-scoped namespaces, four-space indentation, interface naming, nullable settings, and the local
section-comment convention where present. Existing code uses opening braces on the same line. For JavaScript, prefer native ES modules, browser APIs,
existing utilities, explicit APIs, minimal dependencies, and CSP-compatible code. Do not introduce TypeScript unless requested.

Keep documentation lines reasonably readable (approximately 150 characters where practical). Add comments only for non-obvious behavior. Preserve
public APIs unless the task explicitly changes them. Never claim a test or validation passed unless it was executed.

## Avoid

Do not merge the boundaries listed above; invent contract fields or X Template syntax; convert JSONC to JSON; rename `/_assets` casually; call the
inline Component/Page contract a manifest; treat menus as module references; classify dynamic runtime resources as dead code; introduce unnecessary
dependencies; create documentation `README.md` indexes; or document future work as implemented behavior.
