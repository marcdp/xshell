# Architecture

XShell starts from a host-selected root module reference, resolves a stable module graph through ordered repository indexes, normalizes selected
descriptors and file inventories, and composes one effective `app`, `modules`, and `xshell` configuration. The root module is the resolution entry
point, not the complete application. Dependencies merge before dependents and the root merges last.

The host fixes the effective virtual asset namespace at `/_assets`. Service Worker mappings connect generation-qualified virtual paths to expanded
resources or supported ZIP packages. Resolvers interpret logical resource references and select URLs/loaders; loaders obtain or construct resources.
At runtime, one module instance exists per effective module id.

Definition-based Components and Pages keep an inline public contract distinct from implementation. Their loaders orchestrate properties, controllers,
lifecycle, dependencies, and engine selection. State engines own reactive state and render engines own output. Module engine defaults are distinct
from global `xshell.ui` infrastructure.

Areas define routes and select named Menus definitions for each navigation context. Navigation translates friendly
routes separately from canonical Page/resource hrefs.

## Inspection registries

Subsystems that own collections expose read-only `registry` snapshots for observation. Reading a registry does not create, resolve, or load an item;
operational APIs such as `services.resolve(...)` and `loader.load(...)` remain separate.

### Diagnostics console

Open **Diagnostics console** from the global menu to use it in the dock. Choose a group in the header, then choose a diagnostic Page in its tab bar.

| Group | Diagnostic Pages |
| --- | --- |
| Application | App, Config, Modules |
| Runtime | Runtime, Errors, Bus, Tasks, Logs and Live Logs (with `x-logs`) |
| Resources | Resolver, Loader, Schemas |
| UI | Components, Pages, Navigation, Icons, I18n |
| APIs | Services, Contracts, Commands, Queries |
| Browser | Storage, Service Worker |

The console remembers the last tab in each group and the last active group through Preferences. A tab loads on its first visit and keeps its Page
state while the console stays mounted. Contract Detail, Service Inspector, and Task Details open from their diagnostic Pages in the Stack.
The optional `x-logs` module contributes [Logs and Live Logs](../30-subsystems/150-logging.md#logs-and-live-logs) after Tasks.

Friendly links such as `/xshell-diagnostics/modules` still resolve. Direct Page references and asset links to the old flat files must use the group
directory, for example `page:xshell-diagnostics:/pages/application/modules.js`, `page:xshell-diagnostics:/pages/apis/services.js`, and
`page:xshell-diagnostics:/pages/runtime/tasks.js`. The console entry and detail Page hrefs keep their existing paths.

### Diagnostics contract reference

Activate a row in **UI → Components**, **UI → Pages**, or **APIs → Contracts** to open **Contract Detail** in the Stack.
In **APIs → Services**, activate a row to open the interactive **Service Inspector**, then choose **View Contract** to read the same reference.
The Inspector can read live properties, invoke methods, and monitor events. Contract Detail reads Service registrations without constructing a Service.
Contract Detail opens on **Overview** and shows tabs for the contract sections and examples that are present.

Open the reference directly with a Page href such as `page:xshell-diagnostics:/pages/detail/contract-detail.js?kind=command&id=demo.operation`.
Use [Navigation](120-navigation.md) to open it in the Stack. Navigation serializes the `kind` and `id` query parameters,
which the Page reads on initial navigation and reload.

```javascript
await navigation.navigate({
    href: "page:xshell-diagnostics:/pages/detail/contract-detail.js",
    page,
    open: "stack",
    classes: ["size-wide"],
    params: { kind: "component", id: "x-button" }
});
```

| `kind` | Example `id` |
| --- | --- |
| `component` | `x-button` |
| `page` | `/_assets/x/pages/workspace.js` |
| `service` | `areas` |
| `command` | `demo.operation` |
| `contract` | `navigation` |

Page IDs can use the effective asset path from **Pages**, the module-qualified alias `x:/pages/workspace.js`, or the version-independent
asset form shown above.

The reference lists the declared properties, methods, events, slots, and named types when available. It presents a Command's `execute`
signature with its parameters and return metadata. Examples show copyable template and code blocks and expandable initial state. A template example
also offers **Try it**, which opens an editor beside a live preview rendered by the normal XTemplate renderer. Preview updates are debounced while
typing; **Reset** restores the authored template and a fresh clone of its initial state, and **Close** disposes the preview. Edits and interactive
state remain local to the open playground and are not persisted or written back to the contract. Programmatic `code` examples remain read-only and
are never executed. The preview is an explicit rendering tool for trusted bundled examples, not a security sandbox.

### Diagnostics tags

The **Commands**, **Components**, **Pages**, **Contracts**, **Modules**, and **Services** listings show authored classification tags as read-only chips
and provide a local, case-insensitive partial tag filter. Commands, Components, and Pages read generated `file.resource.tags`; Contracts read public
contract tags; Modules read their own authored configuration tags; Services read tags from their registered public contracts, not from implementation
options schemas. Contract Detail and Service Inspector also show the public contract's tags. Diagnostics preserves authored order and does not infer,
sort, deduplicate, edit, or otherwise manage tags.

## Documents

- [Bootstrap](10-bootstrap.md) — Repository resolution, startup, validation, and initialization order.
- [Browser Platform Baseline](15-browser-platform.md) — Baseline 2026 and secure-context requirements.
- [Configuration](20-configuration.md) — Effective configuration and merge rules.
- [Modules](30-modules.md) — Definitions, references, root composition, params, and live instances.
- [Hosting](40-hosting.md) — ASP.NET middleware, generated bootstrap, and SPA fallback.
- [Packaging](50-packaging.md) — Reusable packaging and the incomplete legacy application-pack integration.
- [Components](60-components.md) — Web Component architecture and loader ownership.
- [Pages](70-pages.md) — Component-based presentation plus Page navigation context.
- [Resolvers](80-resolvers.md) — Logical resource interpretation.
- [Loaders](90-loaders.md) — Resource acquisition and construction.
- [DataSets](95-datasets.md) — Static, URL, and module-owned tabular JSON resources.
- [Services](100-services.md) — Contracts, registration, and lazy singleton resolution.
- [Service Worker](110-service-worker.md) — Virtual resource mappings and ZIP consumption.
- [Navigation](120-navigation.md) — Hash/path navigation, routes, and Area context.

## Related documentation

- [Component guides](../20-components/)
- [Subsystems](../30-subsystems/)
- [Specifications](../50-specifications/)
- [Architecture Decision Records](../60-adr/)
