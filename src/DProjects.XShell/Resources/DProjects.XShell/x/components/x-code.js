
function escapeHtml(text) {
    // Escape source text before inserting trusted highlighting spans.
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function token(type, text) {
    return `<span class="token ${type}">${escapeHtml(text)}</span>`;
}

function highlightTokens(source, pattern, classify) {
    // Preserve unmatched text exactly and escape every fragment.
    let result = "", position = 0;
    for (const match of source.matchAll(pattern)) {
        result += escapeHtml(source.slice(position, match.index));
        const type = classify(match[0], match.index, source);
        result += type ? token(type, match[0]) : escapeHtml(match[0]);
        position = match.index + match[0].length;
    }
    return result + escapeHtml(source.slice(position));
}

function normalizeCode(code) {
    // Remove leading and trailing blank lines.
    const lines = code.replace(/\r\n?/g, "\n").split("\n");
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    if (!lines.length) return "";

    // Remove only the indentation shared by every nonempty line.
    const indents = lines.filter(line => line.trim()).map(line => line.match(/^[ \t]*/)[0]);
    let indent = indents[0];
    for (const current of indents.slice(1)) {
        while (indent && !current.startsWith(indent)) indent = indent.slice(0, -1);
    }
    return lines.map(line => line.trim() ? line.slice(indent.length) : "").join("\n");
}

const JS_KEYWORDS = new Set(
    "async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static super switch this throw try typeof var void while with yield interface implements private protected public enum as satisfies".split(" ")
);
const JS_LITERALS = new Set(["true", "false", "null", "undefined", "NaN", "Infinity"]);

function highlightJavaScript(source) {
    // Match comments and strings before identifiers to preserve their contents.
    const pattern = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|`(?:\\[\s\S]|[^`\\])*`?|\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?[\d_]+)?n?)\b|[A-Za-z_$][\w$]*/g;
    return highlightTokens(source, pattern, (value, offset) => {
        if (value.startsWith("//") || value.startsWith("/*")) return "comment";
        if (/^["'`]/.test(value)) return "string";
        if (/^\d/.test(value)) return "number";
        if (JS_KEYWORDS.has(value)) return "keyword";
        if (JS_LITERALS.has(value)) return "literal";
        if (/^\s*\(/.test(source.slice(offset + value.length))) return "function";
        return null;
    });
}

function highlightJson(source) {
    // Distinguish property names from ordinary JSON strings.
    const pattern = /"(?:\\[\s\S]|[^"\\])*"?|[-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b(?:true|false|null)\b/g;
    return highlightTokens(source, pattern, (value, offset) => {
        if (value[0] === '"') return /^\s*:/.test(source.slice(offset + value.length)) ? "key" : "string";
        return value === "true" || value === "false" || value === "null" ? "literal" : "number";
    });
}

function highlightEntities(source) {
    // Highlight character references in HTML and XML text nodes.
    return highlightTokens(source, /&(?:#x[\da-f]+|#\d+|[A-Za-z][\w.-]*);/gi, () => "literal");
}

function findTagEnd(source, start) {
    // Ignore closing brackets appearing inside quoted attributes.
    let quote = "";
    for (let i = start + 1; i < source.length; i++) {
        const character = source[i];
        if (quote) {
            if (character === quote) quote = "";
        } else if (character === '"' || character === "'") {
            quote = character;
        } else if (character === ">") {
            return i;
        }
    }
    return -1;
}

function highlightMarkup(source) {
    // Highlight tags, attributes, values, comments, and declarations.
    let result = "", position = 0;

    while (position < source.length) {
        const start = source.indexOf("<", position);
        if (start === -1) return result + highlightEntities(source.slice(position));
        result += highlightEntities(source.slice(position, start));

        const special = source.startsWith("<!--", start) ? "-->" : source.startsWith("<![CDATA[", start) ? "]]>" : null;
        if (special) {
            const end = source.indexOf(special, start + 4);
            const next = end < 0 ? source.length : end + special.length;
            result += token(special === "-->" ? "comment" : "literal", source.slice(start, next));
            position = next;
            continue;
        }

        if (source.startsWith("<!", start) || source.startsWith("<?", start)) {
            const end = findTagEnd(source, start);
            const next = end < 0 ? source.length : end + 1;
            result += token("keyword", source.slice(start, next));
            position = next;
            continue;
        }

        const opening = /^<(\/?)([A-Za-z_][\w:.-]*)/.exec(source.slice(start));
        if (!opening) {
            result += escapeHtml("<");
            position = start + 1;
            continue;
        }

        const end = findTagEnd(source, start);
        if (end < 0) return result + escapeHtml(source.slice(start));

        const attributes = source.slice(start + opening[0].length, end);
        const attrPattern = /"(?:\\[\s\S]|[^"\\])*"?|'(?:\\[\s\S]|[^'\\])*'?|[^\s=/>]+(?=\s*=)/g;

        result += escapeHtml("<" + opening[1]) + token("tag", opening[2]);
        result += highlightTokens(attributes, attrPattern, value => /^["']/.test(value) ? "string" : "attribute");
        result += escapeHtml(">");

        position = end + 1;
    }

    return result;
}

function highlightYamlValue(source) {
    // Highlight scalar values, anchors, aliases, and comments.
    const pattern = /"(?:\\[\s\S]|[^"\\])*"?|'(?:''|[^'])*'?|#[^\n]*|[&*][\w.-]+|![\w:.-]+|\b(?:true|false|null|yes|no|on|off)\b|[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?\b/gi;
    return highlightTokens(source, pattern, (value, index) => {
        if (value[0] === '"' || value[0] === "'") return "string";
        if (value[0] === "#") return index === 0 || /\s/.test(source[index - 1]) ? "comment" : null;
        if (value[0] === "&" || value[0] === "*" || value[0] === "!") return "attribute";
        if (/^[-+]?\d/.test(value)) return "number";
        return "literal";
    });
}

function highlightYaml(source) {
    // Highlight mapping keys separately from their scalar values.
    return source.split("\n").map(line => {
        const match = /^(\s*(?:-\s+)?)([A-Za-z_][\w .-]*|"(?:\\.|[^"\\])*"|'(?:''|[^'])*')(\s*:\s*)(.*)$/.exec(line);
        if (!match) return highlightYamlValue(line);
        return escapeHtml(match[1]) + token("key", match[2]) + escapeHtml(match[3]) + highlightYamlValue(match[4]);
    }).join("\n");
}

function highlightCode(source, language) {
    // Highlight supported languages and escape unsupported source as plain text.
    switch (language.toLowerCase().trim()) {
        case "javascript":
        case "js":
        case "mjs":
        case "cjs":
            return highlightJavaScript(source);
        case "json":
            return highlightJson(source);
        case "html":
        case "xml":
        case "svg":
        case "xhtml":
            return highlightMarkup(source);
        case "yaml":
        case "yml":
            return highlightYaml(source);
        default:
            return escapeHtml(source);
    }
}

// component
export default {
    contract: {
        description: "Displays read-only code with normalization, syntax highlighting, and optional copying.",
        tags: ["code", "syntax-highlighting", "developer-tools"],
        events: {
            copy: {
                description: "Raised after the displayed code has been copied to the clipboard.",
                detail: {
                    value: {type:"string"}
                }
            }
        },
        properties: {
            value:     {type:"string", default:"", attribute:true, state:true, description:"Original source code. Overrides inline source content when set."},
            language:  {type:"string", default:"", attribute:true, state:true, description:"Language used for syntax highlighting."},
            normalize: {type:"boolean", default:true, attribute:true, state:true, description:"Removes surrounding blank lines and common indentation."},
            wrap:      {type:"boolean", default:false, attribute:true, state:true, description:"Indicates whether long lines should wrap."},
            copyable:  {type:"boolean", default:true, attribute:true, state:true, description:"Indicates whether the Copy button is displayed."}
        },
        methods: {},
        slots: {
            "": {
                description: "Static inline source used when value is empty. Use x-pre to keep X Template syntax literal."
            }
        },
        examples: [
            {
                name: "basic",
                description: "Display highlighted, copyable JavaScript.",
                template: `<x-code language="javascript" value="const total = 3;"></x-code>`
            },
            {
                name: "inline",
                description: "Display inline X Template source without evaluating it.",
                template: `<x-code language="html" x-pre>&lt;p&gt;{{ state.message }}&lt;/p&gt;</x-code>`
            },
            {
                name: "wrap",
                description: "Wrap a long line without a Copy button.",
                template: `<x-code wrap x-prop:copyable="false" value="This long line wraps within the available space."></x-code>`
            }
        ]
    },
    style: `
        :host {
            display:block;
            position:relative;
            min-width:0;
        }

        .container {position:relative;}

        pre {
            margin:0;
            padding:var(--x-code-padding, 1em);
            overflow:auto;
            background:var(--x-code-background);
            color:var(--x-code-color);
            border:var(--x-code-border);
            border-radius:var(--x-code-border-radius, var(--x-datafield-border-radius));
            font-family:var(--x-code-font-family, monospace);
            font-size:var(--x-code-font-size, .9em);
            line-height:var(--x-code-line-height, 1.45);
            tab-size:4;
        }

        code {
            font-family:inherit;
            font-size:inherit;
        }

        pre.wrap {
            white-space:pre-wrap;
            overflow-wrap:anywhere;
        }

        pre:not(.wrap) {
            white-space:pre;
        }

        /* Syntax highlighting */
        .token.comment {
            color:var(--x-code-comment-color, var(--x-color-text-gray));
            font-style:italic;
        }
        .token.keyword {color:var(--x-code-keyword-color, var(--x-color-primary));}
        .token.string {color:var(--x-code-string-color, light-dark(#16753c, #7ee787));}
        .token.number {color:var(--x-code-number-color, light-dark(#a45416, #ffa657));}
        .token.literal {color:var(--x-code-literal-color, var(--x-color-secondary));}
        .token.function {color:var(--x-code-function-color, var(--x-color-primary-light));}
        .token.tag {color:var(--x-code-tag-color, var(--x-color-primary));}
        .token.attribute, .token.key {color:var(--x-code-attribute-color, light-dark(#8b4cb3, #d2a8ff));}

        .tools {
            position:absolute;
            top:.5em;
            right:.5em;
            z-index:1;
            display:flex;
            align-items:center;
            gap:.4em;
        }

        .language, .play, .copy {
            border:0;
            border-radius:.35em;
            padding:.3em .55em;
            background:var(--x-code-copy-background);
            color:var(--x-code-copy-color);
            font-size:var(--x-font-size-small);
        }

        .language {
            font-family:var(--x-code-font-family, monospace);
        }

        .play, .copy {
            cursor:pointer;
        }
        .play:hover, .copy:hover {background:var(--x-code-copy-background-hover);}
        .play:active, .copy:active {background:var(--x-code-copy-background-active);}

         
    `,
    template: `
        <div class="container">
            <div x-if="state.language || state.copyable" class="tools">
                <span x-if="state.language" class="language" x-text="state.language"></span>
                <button x-if="state.playable" class="play" type="button" x-on:click="play">Play</button>
                <button x-if="state.copyable" class="copy" type="button" x-on:click="copy">Copy</button>
            </div>

            <pre x-class:wrap="state.wrap" x-attr:data-language="state.language"><code x-html="state.highlighted"></code></pre>
        </div>
    `,
    state: {
        contentValue: "",
        displayValue: "",
        highlighted: "",
        playable: false
    },
    controller({ state, host, events, dialog }) {
        return {
            load() {
                // Compute the initial representation and react to public property changes.
                this.update();
                events.on(state, ["change:value", "change:language", "change:normalize"], "update");
            },

            mount() {
                // Capture static inline source after the render engine has attached the light DOM children.
                state.contentValue = host.textContent ?? "";
                this.update();
            },

            update() {
                // Prefer the public value and otherwise generate safe highlighted HTML from inline source.
                const original = state.value || state.contentValue || "";
                state.displayValue = state.normalize ? normalizeCode(original) : original;
                state.highlighted = highlightCode(state.displayValue, state.language ?? "");
                state.playable = (state.language ?? "").toLowerCase().trim() === "html";
            },

            async play() {
                // Open the XTemplate playground with the currently displayed HTML source.
                await dialog.open({
                    href: "page:x:/pages/playground.js",
                    context: {template:state.displayValue},
                    classes: ["size-wide"]

                });
            },

            async copy() {
                // Copy the displayed source text without highlighting markup.
                await navigator.clipboard.writeText(state.displayValue);

                host.dispatchEvent(new CustomEvent("copy", {
                    detail: {value:state.displayValue},
                    bubbles:true,
                    composed:false
                }));
            }
        };
    }
};
