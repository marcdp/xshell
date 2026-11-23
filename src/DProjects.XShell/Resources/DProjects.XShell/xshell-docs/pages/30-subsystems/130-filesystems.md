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
Filesystems directly imports the implementation, validates cloned authored options against `Implementation.optionsSchema`, adds the runtime `url`,
and calls `new Implementation(injectedServices, options)`. The first argument is a lazy proxy over the owning Services context, and the second
contains `url: "mem:workspace"`. The actual domain URL is the provider identity; no synthetic `filesystem:` Loader identity is created.

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
and optional `options` object. The selected provider class must expose a static `optionsSchema`; Filesystems validates cloned authored options
against that schema before adding runtime values and invoking the constructor.

~~~jsonc
"providers": {
    "mem": {
        "implementation": "/providers/filesystem-mem.js"
    }
}
~~~

A configurable provider can receive domain-specific declarative options without exposing materialization details. This hypothetical provider illustrates
the shape; it does not imply that WebDAV is implemented:

~~~jsonc
"providers": {
    "webdav": {
        "implementation": "/providers/filesystem-webdav.js",
        "options": {
            "credential": "work-webdav",
            "timeout": 30000
        }
    }
}
~~~

`url` is derived from the opened provider identity and is not authored inside `options`. Runtime-only constructor values such as a directly
supplied `FileSystemDirectoryHandle` also remain outside declarative JSON configuration.

Provider implementations decide whether instances are reused through an optional static method:

~~~js
static getCacheKey(url) {
    return url === "mem:" ? null : url;
}
~~~

A nonempty string is the provider-defined cache identity. Returning `null`, or omitting the method, constructs a new instance for every `open()`.
Filesystems owns concurrent sharing, completed instances, and failed-entry eviction; the provider owns only the identity policy. The memory
Filesystem therefore leaves anonymous `mem:` instances isolated while reusing named identities such as `mem:workspace`.

Another module can contribute a provider through ordinary XShell configuration composition by adding a new scheme key under the same Service
options object:

~~~jsonc
{
    "xshell": {
        "services": {
            "filesystems": {
                "options": {
                    "providers": {
                        "webdav": {
                            "implementation": "/providers/filesystem-webdav.js"
                        }
                    }
                }
            }
        }
    }
}
~~~

Configuration composition merges provider entries by scheme; no imperative provider registry or startup callback is required.

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
