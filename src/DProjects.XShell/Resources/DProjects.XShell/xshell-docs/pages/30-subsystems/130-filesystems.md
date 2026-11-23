# Filesystems

The `filesystems` Service opens Filesystem instances and supplies the actions and editors used by `x-filesystem`. Explicit filesystem Commands and
file editor Pages are separate configuration concepts under `xshell.services.filesystems.options`.

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

`filesystems.open(url)` delegates the provider URL through Resolver → Loader → `instance-js` → `Provider.create()`. The resulting Filesystem is a
runtime resource/provider instance, not an individually registered XShell Service. Provider factories retain their separate internal `create()`
contract.

The matching Resolver rule determines whether Loader retains an instance. The current memory rules give anonymous and named identities different
semantics:

| Provider URL | Behavior |
| --- | --- |
| `mem:` | Uncached; each call opens a fresh isolated Filesystem. |
| `mem:<identity>` | Cached by the complete logical resource identity. Reopening the same identity returns the same Filesystem and state. |

Different named identities, such as `mem:workspace` and `mem:preview`, remain different instances. This is application resource-cache behavior,
not a singleton, scoped, or transient Services lifetime. Other provider URLs follow their own Resolver rules; `open()` does not imply that every
provider is cached.

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
