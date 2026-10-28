
export default {
    meta: {
        title: "Editors",
        description: "Demonstrates code editors, rich-text editing, syntax modes, and reactive content."
    },

    template: `
        <p>XShell provides specialized editors for source code and formatted content. They can be used directly or through <code>x-datafield</code>.</p>

        <h2>Code editor</h2>
        <p>Use <code>x-code-editor</code> to edit source code with syntax highlighting. The <code>mode</code> property selects the language.</p>
        <x-code-editor mode="javascript" x-model="state.javascript"></x-code-editor>
        <p>
            <x-button label="Set example" command="setCode"></x-button>
            <x-button label="Clear" command="clearCode"></x-button>
        </p>
        <p>Current JavaScript:</p>
        <pre x-text="state.javascript"></pre>
        <pre x-pre><code>&lt;x-code-editor mode="javascript" x-model="state.javascript"&gt;&lt;/x-code-editor&gt;</code></pre>

        <h2>Syntax modes</h2>
        <p>The same Component supports different languages through its <code>mode</code> property.</p>
        <x-datafields columns="1">
            <x-datafield type="css" label="CSS" x-model="state.css"></x-datafield>
            <x-datafield type="html" label="HTML" x-model="state.html"></x-datafield>
            <x-datafield type="xml" label="XML" x-model="state.xml"></x-datafield>
            <x-datafield type="markdown" label="Markdown" x-model="state.markdown"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="css" label="CSS" x-model="state.css"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="html" label="HTML" x-model="state.html"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="xml" label="XML" x-model="state.xml"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="markdown" label="Markdown" x-model="state.markdown"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Readonly editor</h2>
        <p>Use <code>readonly</code> to display source code without allowing modifications.</p>
        <x-code-editor mode="javascript" readonly x-prop:value="state.readonlyCode"></x-code-editor>
        <pre x-pre><code>&lt;x-code-editor mode="javascript" readonly x-prop:value="state.readonlyCode"&gt;&lt;/x-code-editor&gt;</code></pre>

        <h2>Rich-text editor</h2>
        <p>Use <code>x-richtext</code> to edit formatted HTML content. The toolbar supports text formatting, alignment, lists, and undo/redo.</p>
        <x-richtext class="standalone" x-model="state.richtext"></x-richtext>
        <p>
            <x-button label="Set example" command="setRichtext"></x-button>
            <x-button label="Clear" command="clearRichtext"></x-button>
        </p>
        <p>HTML value:</p>
        <pre x-text="state.richtext"></pre>
        <pre x-pre><code>&lt;x-richtext class="standalone" x-model="state.richtext"&gt;&lt;/x-richtext&gt;</code></pre>

        <h2>Rich text as a datafield</h2>
        <p>Set <code>type="richtext"</code> to use the rich-text editor inside a form field.</p>
        <x-datafields columns="1">
            <x-datafield type="richtext" label="Description" x-model="state.description"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="richtext" label="Description" x-model="state.description"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Change events</h2>
        <p>Both editors expose a <code>change</code> event containing <code>oldValue</code> and <code>newValue</code>.</p>
        <x-code-editor mode="javascript" x-on:change="onCodeChange"></x-code-editor>
        <p>Last change: {{ state.lastChange }}</p>
        <pre x-pre><code>&lt;x-code-editor mode="javascript" x-on:change="onCodeChange"&gt;&lt;/x-code-editor&gt;</code></pre>
    `,

    state: {
        javascript: "const answer = 42;",
        css: "body { color: blue; }",
        html: "<h1>Hello world</h1>",
        xml: "<root><item>Example</item></root>",
        markdown: "# Hello\nMarkdown example.",
        readonlyCode: "const configuration = { enabled: true };",
        richtext: "<p>Hello <strong>world</strong>.</p>",
        description: "<p>Enter a description.</p>",
        lastChange: "None"
    },

    controller({ state }) {
        return {
            setCode() { state.javascript = "function greet(name) {\n    return `Hello, ${name}!`;\n}"; },
            clearCode() { state.javascript = ""; },
            setRichtext() { state.richtext = "<h3>Example</h3><p>This is <strong>formatted</strong> content.</p>"; },
            clearRichtext() { state.richtext = ""; },
            onCodeChange({ event }) {
                const { oldValue, newValue } = event.detail;
                state.lastChange = `${oldValue.length} → ${newValue.length} characters`;
            }
        };
    }
};
