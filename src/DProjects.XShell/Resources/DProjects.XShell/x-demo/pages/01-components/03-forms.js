
export default {
    meta: {
        title: "Form Inputs",
        description: "Demonstrates the different x-datafield types, validation properties, and reactive form values."
    },

    template: `
        <p>The <code>x-datafield</code> Component provides a common interface for text inputs, selections, editors, files, and structured values. Use <code>x-datafields</code> to organize related fields.</p>

        <h2>Text inputs</h2>
        <p>Standard input types use native HTML controls with XShell styling and validation.</p>
        <x-datafields columns="2">
            <x-datafield type="text" label="Text" placeholder="Enter text"></x-datafield>
            <x-datafield type="string" label="String" placeholder="Enter a string"></x-datafield>
            <x-datafield type="password" label="Password" placeholder="Password"></x-datafield>
            <x-datafield type="email" label="Email" placeholder="name@example.com"></x-datafield>
            <x-datafield type="url" label="URL" placeholder="https://example.com"></x-datafield>
            <x-datafield type="tel" label="Telephone" placeholder="+34 600 000 000"></x-datafield>
            <x-datafield type="search" label="Search" placeholder="Search..."></x-datafield>
            <x-datafield type="number" label="Number" min="0" max="100" step="1"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="text" label="Name" placeholder="Enter name"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="email" label="Email" required&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="number" label="Age" min="0" max="120"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Dates and times</h2>
        <p>Date and time fields use the corresponding native input types.</p>
        <x-datafields columns="2">
            <x-datafield type="date" label="Date"></x-datafield>
            <x-datafield type="time" label="Time"></x-datafield>
            <x-datafield type="datetime-local" label="Date and time"></x-datafield>
            <x-datafield type="month" label="Month"></x-datafield>
            <x-datafield type="week" label="Week"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="date" label="Date"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="datetime-local" label="Date and time"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Other native inputs</h2>
        <x-datafields columns="2">
            <x-datafield type="color" label="Color" value="#3366cc"></x-datafield>
            <x-datafield type="range" label="Range" min="0" max="100" value="50"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="color" label="Color" value="#3366cc"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="range" label="Range" min="0" max="100" value="50"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Text areas</h2>
        <p>Use <code>textarea</code> for longer plain-text content.</p>
        <x-datafields columns="2">
            <x-datafield type="textarea" label="Description" placeholder="Write a description"></x-datafield>
            <x-datafield type="textarea" label="Limited text" maxlength="200" placeholder="Maximum 200 characters"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="textarea" label="Description" maxlength="200"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Selections</h2>
        <p>Selection fields use a <code>domain</code> containing value and label pairs.</p>
        <x-datafields columns="2">
            <x-datafield type="select" label="Select" placeholder="Choose a country" x-prop:domain="state.countries"></x-datafield>
            <x-datafield type="select" label="Multiple select" multiple x-prop:domain="state.countries"></x-datafield>
            <x-datafield type="radios" label="Radio buttons" x-prop:domain="state.priorities"></x-datafield>
            <x-datafield type="checkboxes" label="Checkbox group" x-prop:domain="state.channels"></x-datafield>
            <x-datafield type="checkbox" label="Checkbox" label-secondary="Enable notifications"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="select" label="Country" x-prop:domain="state.countries"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="radios" label="Priority" x-prop:domain="state.priorities"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="checkboxes" label="Channels" x-prop:domain="state.channels"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="checkbox" label="Enabled" label-secondary="Enable feature"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Files and pickers</h2>
        <p>Use <code>file</code> to select files and <code>picker</code> for a value selected through XShell's picker dialog.</p>
        <x-datafields columns="2">
            <x-datafield type="file" label="File" accept=".txt,.pdf,.png"></x-datafield>
            <x-datafield type="file" label="Multiple files" multiple></x-datafield>
            <x-datafield type="picker" label="Picker" value="Example value"></x-datafield>
        </x-datafields>
        <p>File handling and picker dialogs depend on the services configured in the application.</p>
        <pre x-pre><code>&lt;x-datafield type="file" label="File" accept=".pdf,.png"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="file" label="Files" multiple&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="picker" label="Picker"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Rich text</h2>
        <p>Use <code>richtext</code> for formatted HTML content.</p>
        <x-datafields columns="1">
            <x-datafield type="richtext" label="Rich text" x-model="state.richtext"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="richtext" label="Description" x-model="state.richtext"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Code editors</h2>
        <p>These types use the XShell code editor with the corresponding syntax mode.</p>
        <x-datafields columns="1">
            <x-datafield type="javascript" label="JavaScript" x-model="state.javascript"></x-datafield>
            <x-datafield type="css" label="CSS" x-model="state.css"></x-datafield>
            <x-datafield type="html" label="HTML" x-model="state.html"></x-datafield>
            <x-datafield type="xml" label="XML" x-model="state.xml"></x-datafield>
            <x-datafield type="markdown" label="Markdown" x-model="state.markdown"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="javascript" label="JavaScript"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="css" label="CSS"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="html" label="HTML"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="xml" label="XML"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="markdown" label="Markdown"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Multilingual fields</h2>
        <p>Types ending in <code>_i18n</code> edit localized values using the configured languages.</p>
        <x-datafields columns="1">
            <x-datafield type="text_i18n" label="Localized text" x-model="state.textI18n"></x-datafield>
            <x-datafield type="textarea_i18n" label="Localized description" x-model="state.textareaI18n"></x-datafield>
            <x-datafield type="richtext_i18n" label="Localized rich text" x-model="state.richtextI18n"></x-datafield>
            <x-datafield type="markdown_i18n" label="Localized Markdown" x-model="state.markdownI18n"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="text_i18n" label="Name" x-model="state.textI18n"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="textarea_i18n" label="Description" x-model="state.textareaI18n"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="richtext_i18n" label="Content" x-model="state.richtextI18n"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="markdown_i18n" label="Documentation" x-model="state.markdownI18n"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Structured data</h2>
        <p>The <code>object</code> type contains nested fields. The <code>list</code> type manages repeated items.</p>
        <x-datafields columns="1">
            <x-datafield type="object" label="Address" x-model="state.address">
                <x-datafields columns="2">
                    <x-datafield type="text" label="Street" x-model="state.address.street"></x-datafield>
                    <x-datafield type="text" label="City" x-model="state.address.city"></x-datafield>
                </x-datafields>
            </x-datafield>
            <x-datafield type="list" label="Contacts" add x-model="state.contacts" x-prop:item-default="state.contactDefault">
                <x-datafields x-for="contact in state.contacts" class="grid" columns="2" move remove>
                    <x-datafield type="text" label="Name" x-model="contact.name"></x-datafield>
                    <x-datafield type="email" label="Email" x-model="contact.email"></x-datafield>
                </x-datafields>
            </x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="object" label="Address" x-model="state.address"&gt;
    &lt;x-datafields&gt;...&lt;/x-datafields&gt;
&lt;/x-datafield&gt;
&lt;x-datafield type="list" label="Contacts" add x-model="state.contacts"&gt;
    &lt;x-datafields x-for="contact in state.contacts"&gt;...&lt;/x-datafields&gt;
&lt;/x-datafield&gt;</code></pre>

        <h2>X Template field</h2>
        <p>The <code>x-template</code> type renders a custom editing template for an object value.</p>
        <x-datafields columns="1">
            <x-datafield type="x-template" label="Customer" x-prop:template="state.customerTemplate" x-model="state.customer"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="x-template" label="Customer" x-prop:template="state.customerTemplate" x-model="state.customer"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Custom content</h2>
        <p>When <code>type</code> is omitted, the field displays its slotted content.</p>
        <x-datafields columns="2">
            <x-datafield label="Status"><x-badge value="Active"></x-badge></x-datafield>
            <x-datafield label="Size"><x-file-size value="2048"></x-file-size></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield label="Status"&gt;&lt;x-badge value="Active"&gt;&lt;/x-badge&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Field states and validation</h2>
        <p>Fields support required values, readonly and disabled states, descriptions, and validation constraints.</p>
        <x-datafields columns="2">
            <x-datafield type="text" label="Required" placeholder="Required value" required></x-datafield>
            <x-datafield type="text" label="Readonly" value="Readonly value" readonly></x-datafield>
            <x-datafield type="text" label="Disabled" value="Disabled value" disabled></x-datafield>
            <x-datafield type="text" label="With description" description="Additional information about this field."></x-datafield>
            <x-datafield type="number" label="Minimum and maximum" min="1" max="10"></x-datafield>
            <x-datafield type="text" label="Limited length" minlength="3" maxlength="20"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="text" label="Required" required&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="text" label="Readonly" readonly&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="number" label="Quantity" min="1" max="10"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Reactive form values</h2>
        <p>The <code>x-model</code> directive synchronizes field values with private Page state.</p>
        <x-form>
            <x-datafields columns="2">
                <x-datafield type="text" label="Name" x-model="state.name"></x-datafield>
                <x-datafield type="number" label="Age" x-model="state.age"></x-datafield>
            </x-datafields>
        </x-form>
        <p>Hello <strong>{{ state.name }}</strong> ({{ state.age }})</p>
        <pre x-pre><code>&lt;x-datafield type="text" label="Name" x-model="state.name"&gt;&lt;/x-datafield&gt;
&lt;p&gt;Hello {{ state.name }}&lt;/p&gt;</code></pre>


        <h2>Lists</h2>
        <x-datafields label="Client">
            <x-datafield label="Name" type="text" x-model="state.client.name"></x-datafield>
            <x-datafield label="Addresses" type="list" add x-model="state.client.addresses" x-prop:item-default="state.addressDefault">
                <x-datafields x-for="address in state.client.addresses" class="grid" columns="2" move remove __x-key="address">
                    <x-datafield label="Street" type="text" x-model="address.street"></x-datafield>
                    <x-datafield label="City" type="text" x-model="address.city" required style="flex:1" placeholder="Enter city"></x-datafield>
                    <x-datafield label="File" type="file" x-model="address.file" style="width:15em;"></x-datafield>
                </x-datafields>
            </x-datafield>
        </x-datafields>
        <x-json x-prop:value="state.client"></x-json>

    `,

    state: {
        name: "Ada",
        age: 36,
        countries: [
            { value: "es", label: "Spain" },
            { value: "fr", label: "France" },
            { value: "de", label: "Germany" }
        ],
        priorities: [
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" }
        ],
        channels: [
            { value: "email", label: "Email" },
            { value: "sms", label: "SMS" },
            { value: "push", label: "Push" }
        ],
        richtext: "<p>Hello <strong>world</strong>.</p>",
        javascript: "const answer = 42;",
        css: "body { color: blue; }",
        html: "<p>Hello world</p>",
        xml: "<root><item>Example</item></root>",
        markdown: "# Hello\nMarkdown example.",
        textI18n: "i18n:en=Hello|i18n:es=Hola",
        textareaI18n: "i18n:en=English description|i18n:es=Descripción en español",
        richtextI18n: "i18n:en=<p>Hello</p>|i18n:es=<p>Hola</p>",
        markdownI18n: "i18n:en=# Hello|i18n:es=# Hola",
        address: { street: "Main Street", city: "Barcelona" },
        contacts: [{ name: "Ada", email: "ada@example.com" }],
        contactDefault: { name: "", email: "" },
        customer: { name: "Ada", age: 36 },
        customerTemplate: `
            <x-datafields columns="2">
                <x-datafield type="text" label="Name" x-model="state.name"></x-datafield>
                <x-datafield type="number" label="Age" x-model="state.age"></x-datafield>
            </x-datafields>
        `,
        client: {
            name: "Peter",
            age: 50,
            active: true,
            addresses: [
                { street: "11", city: "22", file: null },
                { street: "33", city: "44", file: null }
            ]
        },
        addressDefault: { street: "", city: "", file:null },
    }
};
