# Filesystems

The `filesystems` Service owns Filesystem provider selection, opens Filesystem instances, and supplies the actions and editors used by
`x-filesystem`. Providers, explicit filesystem Commands, and file editor Pages are separate configuration concepts under
`xshell.services.filesystems.options`.

## Opening a Filesystem

Pages, Components, and Commands obtain a Filesystem through the injected `filesystems` Service:

~~~js
controller({filesystems}) {
    return {
        async load() {
            const filesystem = await filesystems.open("mem:workspace");
        }
    };
}
~~~

`filesystems.open(url)` extracts the URL scheme and selects it from the Service's configured `options.providers` table. Filesystem provider URLs are not global
Resolver resources: ordinary `resolver.resolve("filesystem:...")` and `loader.load("filesystem:...")` calls cannot open them. After local matching,
Filesystems directly imports the implementation and applies the provider-owned configuration round trip:

~~~text
raw URL
    ↓ Implementation.optionsDefinition.parseUrl(url)
provider options
    ↓ merge cloned provider defaults
Implementation.optionsDefinition.schema validation
    ↓ Implementation.optionsDefinition.getUrl(options)
canonical URL
    ↓
new Implementation(injectedServices, options, credentials)
~~~

The first constructor argument is a lazy proxy over the owning Services context. The second contains only validated provider options; it never contains `url`.
The optional third argument is the provider `credentials` object and defaults to `null` for raw URL opening. Each provider derives its diagnostic `filesystem.url`
from the same options projection used by Filesystems. The actual domain URL is the provider identity; no synthetic `filesystem:` Loader identity is created.

The resulting Filesystem is a runtime provider instance, not an individually registered XShell Service. Filesystems owns result caching,
in-flight promise sharing, and failed-creation eviction. Provider construction does not create Loader registry diagnostics or Bus events.

The matching provider definition determines whether Filesystems retains an instance. The current memory definitions give anonymous and named identities different
semantics:

| Provider URL | Behavior |
| --- | --- |
| `mem:` | Uncached; each call opens a fresh isolated Filesystem. |
| `mem:<identity>` | Cached by the complete logical resource identity. Reopening the same identity returns the same Filesystem and state. |

Different named identities, such as `mem:workspace` and `mem:preview`, remain different instances. This is application resource-cache behavior,
not a singleton, scoped, or transient Services lifetime. Other provider URLs follow their own provider definitions; `open()` does not imply that
every provider is cached.

## Providers

`options.providers` is an object keyed by normalized URL scheme without the trailing colon. Each definition has a required `implementation` string
and optional `options` object containing provider-level defaults. Every selected provider class must expose one static provider options definition:

- `optionsDefinition.schema` is the authoritative JSON Schema for non-secret, declarative, user-editable provider options.
- `optionsDefinition.parseUrl(url)` returns the provider options object directly.
- `optionsDefinition.getUrl(options)` projects validated options into one canonical URL.

The mapping is deliberately reversible and has no secondary name or context channel:

~~~text
URL ──parseUrl──► options
URL ◄──getUrl──── options
~~~

If a value affects the canonical Filesystem URL, it belongs in the options object and must be described by `optionsDefinition.schema`.

Filesystems clones provider defaults, overlays URL-derived options, validates the merged object against `Implementation.optionsDefinition.schema`, and only then
calls `Implementation.optionsDefinition.getUrl()`. URL-derived fields win when the URL represents them directly. The authored provider definition is never mutated.

`Filesystems.optionsSchema` remains separate: it validates the Filesystems Service configuration, including each provider definition's authored `options`.
That authored object is validated against the selected provider's `Implementation.optionsDefinition.schema` during `open()`.

~~~jsonc
"providers": {
    "https": {
        "implementation": "/providers/filesystem-http.js",
        "options": {
            "isReadonly": true
        }
    }
}
~~~

A provider declares structured configuration suitable for validation and schema-generated forms. For example, the shared HTTP implementation describes `scheme`,
`host`, `path`, and `isReadonly`, so either an HTTP or HTTPS URL can be reconstructed from options alone:

~~~js
static optionsDefinition = {
    schema: {
        type: "object",
        required: ["scheme", "host"],
        properties: {
            scheme: {type: "string", title: "Scheme", enum: ["http", "https"]},
            host: {
                type: "string",
                title: "Host",
                description: "Server hostname, optionally including a port.",
                minLength: 1
            },
            path: {type: "string", title: "Path", default: "/"},
            isReadonly: {type: "boolean", title: "Read only", default: false}
        },
        additionalProperties: false
    },

    parseUrl(url) {
        const parsed = new URL(url);
        return {scheme: parsed.protocol.slice(0, -1), host: parsed.host, path: parsed.pathname};
    },

    getUrl(options) {
        const url = new URL(`${options.scheme}://${options.host}`);
        url.pathname = options.path;
        return url.href;
    }
};
~~~

The `http` and `https` implementations reject credentials, queries, and fragments. `isReadonly` is configuration rather than URL state, so it comes from
provider defaults or the schema-described default used when configuration is authored, rather than `parseUrl()`.

The memory provider represents its logical identity as the nullable string option `instance`. `mem:` parses as `{instance: null}`, while
`mem:workspace` parses as `{instance: "workspace"}`; projecting those options returns the same canonical URLs.
OPFS and local-file URLs project to the constant canonical forms `opfs:` and `file:`.

`url` is always derived and is not part of `Implementation.optionsDefinition.schema`, authored `options`, or constructor options. Runtime-only constructor values such as a
directly supplied `FileSystemDirectoryHandle` also remain outside declarative JSON configuration. Configuration UIs can therefore consume
`Implementation.optionsDefinition.schema` directly; there is no parallel `configurationSchema`.

Providers that require sensitive configuration may additionally expose an optional `credentialsDefinition`:

~~~js
static credentialsDefinition = {
    schema: {
        type: "object",
        required: ["username", "password"],
        properties: {
            username: {type: "string", minLength: 1},
            password: {type: "string", writeOnly: true}
        },
        additionalProperties: false
    }
};
~~~

The provider metadata and construction responsibilities remain separate:

~~~text
Filesystem provider
├── optionsDefinition
│   ├── schema
│   ├── parseUrl(url) → options
│   └── getUrl(options) → URL
├── credentialsDefinition?
│   └── schema
├── getCacheKey(url)?
└── constructor(services, options, credentials)
~~~

`credentialsDefinition.schema` describes sensitive provider configuration passed separately as constructor argument three. Providers without credentials omit
`credentialsDefinition`; the bundled memory, HTTP, OPFS, and local-file providers all omit it. Credentials never participate in `parseUrl()`, `getUrl()`,
`filesystem.url`, or cache identity, and they must never be encoded in provider URLs. In particular, the HTTP provider continues to reject embedded usernames
and passwords.

Filesystems recognizes and can validate the optional descriptor internally, but `open(url)` does not currently accept, acquire, or persist credential payloads.
Raw URL opening therefore supplies `null`, and providers remain unaware of any persistence mechanism. A future management UI may use
`optionsDefinition.schema` for non-secret configuration and `credentialsDefinition.schema` for secret configuration, but no Filesystems Preferences Page or
Secrets-backed credential registry is implemented.

For raw URL opening, the round trip prevents the URL from becoming an independent configuration source:

~~~text
https://example.test/files/
    ↓ parseUrl
{scheme: "https", host: "example.test", path: "/files"}
    ↓ optionsDefinition.schema validation
    ↓ getUrl
https://example.test/files
~~~

Filesystems uses the canonical result for diagnostics and provider cache identity. The provider constructor independently derives the same URL from its validated
options rather than receiving that projection as construction input.

Another module can contribute a provider through ordinary XShell configuration composition by adding a new scheme key under the same Service
options object:

~~~jsonc
{
    "xshell": {
        "services": {
            "filesystems": {
                "options": {
                    "providers": {
                        "archive": {
                            "implementation": "/providers/filesystem-archive.js"
                        }
                    }
                }
            }
        }
    }
}
~~~

Configuration composition merges provider entries by scheme; no imperative provider registry or startup callback is required.

Provider implementations decide whether instances are reused through an optional static method:

~~~js
static getCacheKey(url) {
    return url === "mem:" ? null : url;
}
~~~

A nonempty string is the provider-defined cache identity. Filesystems calls this method with the canonical projected URL, never the raw input. Returning
`null`, or omitting the method, constructs a new instance for every `open()`.
Filesystems owns concurrent sharing, completed instances, and failed-entry eviction; the provider owns only the identity policy. The memory
Filesystem therefore leaves anonymous `mem:` instances isolated while reusing named identities such as `mem:workspace`.

## Commands

`options.commands` is an array of explicit actions shown for matching filesystem entries. A descriptor has an `id`, `label`, optional `icon`,
a `type` of `file`, `directory`, or `entry`, optional file `extensions`, and an `actions` array. Command IDs normally use the `command:`
resource prefix. The explorer continues to invoke them through the Commands invocation Page and Tasks execution path.

~~~jsonc
"commands": [
    {
        "id": "filesystem.entry.encrypt.aes",
        "label": "Encrypt",
        "icon": "x-lock",
        "type": "file",
        "extensions": ["txt", "json", "md"],
        "actions": []
    }
]
~~~

Editor Pages do not belong in this array.

## Editors

`options.editors` is an object keyed by a stable editor ID. The ID is configuration identity and is independent of the Page resource path. Each
descriptor declares the Page to open, its context-menu label and optional icon, and the supported extensions without a leading dot.

~~~jsonc
"editors": {
    "text": {
        "page": "page:x-filesystem:/pages/editor-text.js",
        "label": "Open",
        "icon": "x-preview",
        "extensions": ["txt", "txt.aes", "json", "jsonc", "md", "md.aes"]
    },
    "image": {
        "page": "page:x-filesystem:/pages/editor-image.js",
        "label": "Open",
        "icon": "x-preview",
        "extensions": ["png", "png.aes", "jpg", "jpg.aes"]
    }
}
~~~

`filesystems.editors` and `filesystems.commands` return defensive copies of the effective configuration. `filesystems.getEditor(path)` returns
a defensive copy of the matching editor descriptor or `null`. Matching is case-insensitive and requires a dot-delimited extension. The longest
configured extension wins, so `txt.aes` takes precedence over `aes`; ties are resolved by editor ID. This produces one editor for a file even
when multiple descriptors match.

Activating a directory navigates into it. Activating a file, including context-menu **Open**, calls `getEditor(path)` and opens the selected Page
in the existing stack with `src` and `path` parameters. Explicit Commands remain separate context-menu entries.

## Contributing an editor

Another module can contribute an editor through ordinary XShell configuration composition by adding a new key to the same options object:

~~~jsonc
{
    "xshell": {
        "services": {
            "filesystems": {
                "options": {
                    "editors": {
                        "archive": {
                            "page": "page:my-module:/pages/editor-archive.js",
                            "label": "Open",
                            "icon": "x-preview",
                            "extensions": ["zip", "tar.gz"]
                        }
                    }
                }
            }
        }
    }
}
~~~

No editor registry or imperative registration is required. Configuration composition merges editor entries by their stable keys.
