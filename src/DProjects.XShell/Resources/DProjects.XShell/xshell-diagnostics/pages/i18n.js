
// page
export default {
    contract: {
        description: "Internationalization diagnostics page",
        events: {},
        properties: {},
        methods: {}
    },
    meta: {
        title: "Internationalization"
    },
    template: `
        <p>Shows the active language, available languages, date/time formats, and translation dictionaries.</p>

        <x-tabs>
            <x-tab label="Configuration">
                <x-listview view="details">
                    <x-listview-head>
                        <x-listview-column label="Property" width="12em"></x-listview-column>
                        <x-listview-column label="Value"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item label="Current language" icon="x-language">
                            <div>{{ state.currentLanguage }}</div>
                        </x-listview-item>
                        <x-listview-item label="Available languages">
                            <div>{{ state.languageCount }}</div>
                        </x-listview-item>
                        <x-listview-item label="Main languages">
                            <div>{{ state.mainLanguages }}</div>
                        </x-listview-item>
                        <x-listview-item label="Date/time formats">
                            <div>{{ state.formatCount }}</div>
                        </x-listview-item>
                        <x-listview-item label="Translation dictionaries">
                            <div>{{ state.dictionaryCount }}</div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
            </x-tab>
            <x-tab label="Languages">
                <x-listview view="details">
                    <x-listview-head>
                        <x-listview-column width="10em"><x-datafield type="search" x-model="state.languageFilter" placeholder="Language"></x-datafield></x-listview-column>
                        <x-listview-column label="Label"></x-listview-column>
                        <x-listview-column label="Main" width="6em"></x-listview-column>
                        <x-listview-column label="Current" width="6em"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="item in state.languages" x-attr:label="item.id" icon="x-language">
                            <div>{{ item.label }}</div>
                            <div>{{ item.main }}</div>
                            <div>{{ item.current }}</div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>            
            </x-tab>
            <x-tab label="Date/time formats">
                <x-listview view="details">
                    <x-listview-head>
                        <x-listview-column label="Format" width="12em"></x-listview-column>
                        <x-listview-column label="Options"></x-listview-column>
                        <x-listview-column label="Example"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="item in state.formats" x-attr:label="item.name" icon="x-calendar">
                            <x-truncate x-attr:text="item.options"></x-truncate>
                            <div>{{ item.example }}</div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>            
            </x-tab>
            <x-tab label="Dictionaries">
                <x-listview view="details">
                    <x-listview-head>
                        <x-listview-column label="Language" width="12em"></x-listview-column>
                        <x-listview-column label="Translations" width="10em"></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="item in state.dictionaries" x-attr:label="item.id" icon="x-language">
                            <div>{{ item.count }}</div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>          
            </x-tab>
            <x-tab label="Translations">
                <x-listview view="details">
                    <x-listview-head>
                        <x-listview-column width="10em"><x-datafield type="search" x-model="state.translationLanguage" placeholder="Language"></x-datafield></x-listview-column>
                        <x-listview-column><x-datafield type="search" x-model="state.translationKey" placeholder="Key"></x-datafield></x-listview-column>
                        <x-listview-column><x-datafield type="search" x-model="state.translationValue" placeholder="Translation"></x-datafield></x-listview-column>
                    </x-listview-head>
                    <x-listview-body>
                        <x-listview-item x-for="item in state.translations" x-attr:label="item.language" icon="x-language">
                            <div>{{ item.key }}</div>
                            <div>{{ item.value }}</div>
                        </x-listview-item>
                    </x-listview-body>
                </x-listview>
            </x-tab>
        </x-tabs>
    `,
    state: {
        currentLanguage: "",
        languageCount: 0,
        mainLanguages: "",
        formatCount: 0,
        dictionaryCount: 0,
        languageFilter: "",
        translationLanguage: "",
        translationKey: "",
        translationValue: "",
        languages: [],
        formats: [],
        dictionaries: [],
        translations: []
    },
    controller({ state, events, i18n }) {
        return {
            load() {
                // Initialize diagnostics and register filter events
                this.refresh();
                events.on(state, "change:languageFilter", "refresh");
                events.on(state, "change:translationLanguage", "refresh");
                events.on(state, "change:translationKey", "refresh");
                events.on(state, "change:translationValue", "refresh");
            },
            refresh() {
                // Read the current service configuration
                const config = i18n.config;
                const languages = config.langs || [];
                const formats = config.datetime?.formats || {};
                const dictionaries = config.strings || {};
                const now = new Date();

                // Update general configuration information
                state.currentLanguage = `${config.lang} (${i18n.getLangLabel(config.lang)})`;
                state.languageCount = languages.length;
                state.mainLanguages = i18n.getMainLangs().join(", ");
                state.formatCount = Object.keys(formats).length;
                state.dictionaryCount = Object.keys(dictionaries).length;

                // Build the available languages list
                state.languages = languages
                    .filter(item => !state.languageFilter ||
                        item.id.toLowerCase().includes(state.languageFilter.toLowerCase()) ||
                        item.label.toLowerCase().includes(state.languageFilter.toLowerCase()))
                    .map(item => ({
                        id: item.id,
                        label: item.label,
                        main: item.main ? "Yes" : "No",
                        current: item.id === config.lang ? "Yes" : ""
                    }))
                    .sort((a, b) => a.id.localeCompare(b.id));

                // Build date/time formats and preview their output
                state.formats = [
                    {
                        name: "default",
                        options: JSON.stringify(config.datetime?.options || {}),
                        example: i18n.formatDateTime(now)
                    },
                    ...Object.entries(formats).map(([name, options]) => {
                        let example;
                        try {
                            example = i18n.formatDateTime(now, name);
                        } catch (error) {
                            example = `Error: ${error.message}`;
                        }
                        return {
                            name,
                            options: JSON.stringify(options),
                            example
                        };
                    })
                ];

                // Build translation dictionary statistics
                state.dictionaries = Object.entries(dictionaries)
                    .map(([id, entries]) => ({
                        id,
                        count: Object.keys(entries).length
                    }))
                    .sort((a, b) => a.id.localeCompare(b.id));

                // Build the filtered translation list
                const translations = [];
                for (const [language, entries] of Object.entries(dictionaries)) {
                    for (const [key, value] of Object.entries(entries)) {
                        if (state.translationLanguage && !language.toLowerCase().includes(state.translationLanguage.toLowerCase())) continue;
                        if (state.translationKey && !key.toLowerCase().includes(state.translationKey.toLowerCase())) continue;
                        if (state.translationValue && !value.toLowerCase().includes(state.translationValue.toLowerCase())) continue;

                        translations.push({ language, key, value });
                    }
                }
                translations.sort((a, b) => a.language.localeCompare(b.language) || a.key.localeCompare(b.key));
                state.translations = translations;
            }
        };
    }
}
