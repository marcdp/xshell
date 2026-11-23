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

`filesystems.open(url)` resolves the URL against the Service's configured `options.providers` table. Filesystem provider URLs are not global
Resolver resources: ordinary `resolver.resolve("filesystem:...")` and `loader.load("filesystem:...")` calls cannot open them. After local matching,
the Service gives Loader an already-resolved internal identity such as `filesystem:mem:workspace`; Loader then materializes it through
`instance-js` → provider options validation → runtime `url` composition → `new Implementation(services, options)`. The implementation constructor
receives a lazy Services proxy as its first argument and final options containing `url: "mem:workspace"` as its second. The internal `filesystem:`
prefix is not part of that URL.

The resulting Filesystem is a runtime provider instance, not an individually registered XShell Service. Loader still owns result caching,
in-flight promise sharing, failed-cache eviction, registry diagnostics, Bus events, and materialization timing.

The matching provider definition determines whether Loader retains an instance. The current memory definitions give anonymous and named identities different
semantics:

| Provider URL | Behavior |
| --- | --- |
| `mem:` | Uncached; each call opens a fresh isolated Filesystem. |
| `mem:<identity>` | Cached by the complete logical resource identity. Reopening the same identity returns the same Filesystem and state. |

Different named identities, such as `mem:workspace` and `mem:preview`, remain different instances. This is application resource-cache behavior,
not a singleton, scoped, or transient Services lifetime. Other provider URLs follow their own provider definitions; `open()` does not imply that
every provider is cached.

## Providers

`options.providers` is an object keyed by provider URL pattern. Each definition has a required `implementation` string and optional `cache`,
`cacheMode`, and `options` fields. Patterns use the same literal and placeholder semantics as Resolver definitions, but they belong only to
Filesystems. Filesystems uses the generic `instance-js` loader internally; provider configuration does not select or expose that Loader
implementation. The selected provider class owns the schema for its `options`; Filesystems validates only that the value is an object.

~~~jsonc
"providers": {
    "mem:": {
        "implementation": "/js/filesystem-mem.js"
    },
    "mem:{identity}": {
        "implementation": "/js/filesystem-mem.js",
        "cache": true
    }
}
~~~

A configurable provider can receive domain-specific declarative options without exposing Loader details. This hypothetical provider illustrates
the shape; it does not imply that WebDAV is implemented:

~~~jsonc
"providers": {
    "webdav:{url}": {
        "implementation": "/js/filesystem-webdav.js",
        "cache": true,
        "options": {
            "credential": "work-webdav",
            "timeout": 30000
        }
    }
}
~~~

`url` is derived from the opened provider identity and is not authored inside `options`. Runtime-only constructor values such as a directly
supplied `FileSystemDirectoryHandle` also remain outside declarative JSON configuration.

`cacheMode` retains Loader's ordinary `full` and `path` meanings. Filesystems does not maintain a second instance cache and does not expose the
provider table as mutable public API.

Another module can contribute a provider through ordinary XShell configuration composition by adding a new pattern key under the same Service
options object:

~~~jsonc
{
    "xshell": {
        "services": {
            "filesystems": {
                "options": {
                    "providers": {
                        "webdav:{url}": {
                            "implementation": "/js/filesystem-webdav.js"
                        }
                    }
                }
            }
        }
    }
}
~~~

Configuration composition merges provider entries by pattern key; no imperative provider registry or startup callback is required.

## Commands

`options.commands` is an array of explicit actions shown for matching filesystem entries. A descriptor has an `id`, `label`, optional `icon`,
a `type` of `file`, `directory`, or `entry`, optional file `extensions`, and an `actions` array. Command IDs normally use the `command:`
resource prefix. The explorer continues to invoke them through the Commands invocation Page and Tasks execution path.

~~~jsonc
"commands": [
    {
        "id": "command:filesystem.entry.encrypt.aes",
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
