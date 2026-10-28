export default {
    meta: { title: "Internationalization", description: "The built-in text component uses the current application language." },
    template: `
        <p>The built-in text component uses the current application language.</p>
        <x-i18n text="Hello"></x-i18n>
        <p>Current language: {{ state.language }}</p>
        
    `,
    state: { language: "" },
    controller({ config, state }) {
        return { load() { state.language = config.xshell.i18n.lang; } };
    }
};
