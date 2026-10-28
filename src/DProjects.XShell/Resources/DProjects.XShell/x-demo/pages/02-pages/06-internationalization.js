
export default {
    meta: {
        title: "Internationalization",
        description: "Demonstrates UI translations, multilingual values, localized fields, and date/time formatting."
    },

    template: `
        <p>XShell internationalization covers UI translation, multilingual application values, and locale-aware formatting. Each serves a different purpose.</p>

        <h2>Current language</h2>
        <p>The <code>i18n</code> service provides the active language and the configured languages.</p>
        <x-datafields columns="2">
            <x-datafield label="Current language">{{ state.language }}</x-datafield>
            <x-datafield label="Available languages">{{ state.languages }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>controller({state, i18n}) {
    return {
        load() {
            state.language = i18n.config.lang;
            state.languages = i18n.config.langs.map(lang => lang.label).join(", ");
        }
    };
}</code></pre>

        <h2>UI translation</h2>
        <p>Use <code>i18n.translate()</code> to translate application interface strings using the current language.</p>
        <x-datafields columns="2">
            <x-datafield label="Source">{{ state.translationSource }}</x-datafield>
            <x-datafield label="Translated">{{ state.translationResult }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>i18n.translate("Save")</code></pre>

        <h2>Declarative translation</h2>
        <p>The <code>x-i18n</code> Component provides a declarative alternative to calling <code>i18n.translate()</code>.</p>
        <p>Translated text: <strong><x-i18n text="Save"></x-i18n></strong></p>
        <p>Another example: <strong><x-i18n text="Hello"></x-i18n></strong></p>
        <pre x-pre><code>&lt;x-i18n text="Save"&gt;&lt;/x-i18n&gt;
&lt;x-i18n text="Hello"&gt;&lt;/x-i18n&gt;</code></pre>

        <h2>Missing translations</h2>
        <p>If no translation exists for a UI string, the original text is returned.</p>
        <p>Source: {{ state.fallbackSource }}</p>
        <p>Result: <strong>{{ state.fallbackResult }}</strong></p>
        <pre x-pre><code>i18n.translate("This translation does not exist")</code></pre>

        <h2>Multilingual application values</h2>
        <p>Multilingual data is different from UI translation. XShell can store several localized variants in a single value and retrieve the appropriate one using <code>i18n.formatText()</code>.</p>
        <p>Stored value:</p>
        <pre x-text="state.multilingualValue"></pre>
        <p>Current language: <strong>{{ state.localizedValue }}</strong></p>
        <p>Explicit languages:</p>
        <x-datafields columns="2">
            <x-datafield label="English">{{ state.englishValue }}</x-datafield>
            <x-datafield label="Spanish">{{ state.spanishValue }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>const value = "i18n:en=Hello|i18n:es=Hola";
i18n.formatText(value);
i18n.formatText(value, "es");</code></pre>

        <h2>Localized text fields</h2>
        <p>Use <code>text_i18n</code> and <code>textarea_i18n</code> to edit multilingual plain-text values. The available languages come from the application configuration.</p>
        <x-datafields columns="1">
            <x-datafield type="text_i18n" label="Localized name" x-model="state.textValue"></x-datafield>
            <x-datafield type="textarea_i18n" label="Localized description" x-model="state.textareaValue"></x-datafield>
        </x-datafields>
        <p>Stored name:</p>
        <pre x-text="state.textValue"></pre>
        <pre x-pre><code>&lt;x-datafield type="text_i18n" label="Name" x-model="state.textValue"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="textarea_i18n" label="Description" x-model="state.textareaValue"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Localized rich text and Markdown</h2>
        <p>Specialized multilingual editors support HTML content and Markdown using the same localized-value model.</p>
        <x-datafields columns="1">
            <x-datafield type="richtext_i18n" label="Localized rich text" x-model="state.richtextValue"></x-datafield>
            <x-datafield type="markdown_i18n" label="Localized Markdown" x-model="state.markdownValue"></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datafield type="richtext_i18n" label="Content" x-model="state.richtextValue"&gt;&lt;/x-datafield&gt;
&lt;x-datafield type="markdown_i18n" label="Documentation" x-model="state.markdownValue"&gt;&lt;/x-datafield&gt;</code></pre>

        <h2>Date and time formatting</h2>
        <p>Use <code>i18n.formatDateTime()</code> to format dates and times according to the active locale and the application's formatting configuration.</p>
        <p>Source: <code>{{ state.datetime }}</code></p>
        <x-datafields columns="2">
            <x-datafield label="Date">{{ state.dateFormatted }}</x-datafield>
            <x-datafield label="Time">{{ state.timeFormatted }}</x-datafield>
            <x-datafield label="Date and time">{{ state.datetimeFormatted }}</x-datafield>
            <x-datafield label="ISO">{{ state.isoFormatted }}</x-datafield>
        </x-datafields>
        <pre x-pre><code>i18n.formatDateTime(value, "date");
i18n.formatDateTime(value, "time");
i18n.formatDateTime(value, "datetime");
i18n.formatDateTime(value, "iso");</code></pre>

        <h2>Declarative date formatting</h2>
        <p>The <code>x-datetime</code> Component formats date/time values without requiring controller logic. Its <code>format</code> property overrides the default format.</p>
        <x-datafields columns="2">
            <x-datafield label="Date"><x-datetime x-attr:value="state.datetime" format="date"></x-datetime></x-datafield>
            <x-datafield label="Time"><x-datetime x-attr:value="state.datetime" format="time"></x-datetime></x-datafield>
            <x-datafield label="Date and time"><x-datetime x-attr:value="state.datetime" format="datetime"></x-datetime></x-datafield>
            <x-datafield label="Automatic"><x-datetime x-attr:value="state.datetime"></x-datetime></x-datafield>
        </x-datafields>
        <pre x-pre><code>&lt;x-datetime value="2026-09-30T18:30:00Z" format="date"&gt;&lt;/x-datetime&gt;
&lt;x-datetime value="2026-09-30T18:30:00Z" format="datetime"&gt;&lt;/x-datetime&gt;</code></pre>

        <h2>Choosing the right API</h2>
        <p>Use <code>i18n.translate()</code> or <code>x-i18n</code> for UI labels, <code>i18n.formatText()</code> for multilingual application data, and <code>i18n.formatDateTime()</code> or <code>x-datetime</code> for dates and times.</p>
    `,

    state: {
        language: "",
        languages: "",
        translationSource: "Save",
        translationResult: "",
        fallbackSource: "This translation does not exist",
        fallbackResult: "",
        multilingualValue: "i18n:en=Hello|i18n:es=Hola|i18n:fr=Bonjour",
        localizedValue: "",
        englishValue: "",
        spanishValue: "",
        textValue: "i18n:en=Product|i18n:es=Producto|i18n:fr=Produit",
        textareaValue: "i18n:en=English description|i18n:es=Descripción en español",
        richtextValue: "i18n:en=<p>Hello</p>|i18n:es=<p>Hola</p>",
        markdownValue: "i18n:en=# Hello|i18n:es=# Hola",
        datetime: "2026-09-30T18:30:00Z",
        dateFormatted: "",
        timeFormatted: "",
        datetimeFormatted: "",
        isoFormatted: ""
    },

    controller({state, i18n}) {
        return {
            load() {
                state.language = i18n.config.lang;
                state.languages = i18n.config.langs.map(lang => `${lang.label} (${lang.id})`).join(", ");
                state.translationResult = i18n.translate(state.translationSource);
                state.fallbackResult = i18n.translate(state.fallbackSource);
                state.localizedValue = i18n.formatText(state.multilingualValue);
                state.englishValue = i18n.formatText(state.multilingualValue, "en");
                state.spanishValue = i18n.formatText(state.multilingualValue, "es");
                state.dateFormatted = i18n.formatDateTime(state.datetime, "date");
                state.timeFormatted = i18n.formatDateTime(state.datetime, "time");
                state.datetimeFormatted = i18n.formatDateTime(state.datetime, "datetime");
                state.isoFormatted = i18n.formatDateTime(state.datetime, "iso");
            }
        };
    }
};
