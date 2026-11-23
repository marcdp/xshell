
export default class Dialog {

    // options schema
    static optionsSchema = {
        type: "object",
        properties: {
            confirm: { type: ["string", "null"], description: "Page used for confirmation dialogs." },
            message: { type: ["string", "null"], description: "Page used for message dialogs." },
            prompt: { type: ["string", "null"], description: "Page used for prompt dialogs." },
            picker: { type: ["string", "null"], description: "Page used for picker dialogs." }
        },
        additionalProperties: false,
        description: "Default page resources used for standard dialogs."
    };

    // vars
    #navigation = null;
    #i18n = null;
    #options = null;

    // ctor
    constructor({ navigation, i18n }, options = {}) {
        // Initialize injected dependencies and service configuration
        this.#navigation = navigation;
        this.#i18n = i18n;
        this.#options = options;
    }

    // methods
    async confirm({ title, message, variant, classes }) {
        const href = this.#options.confirm;
        return await this.#navigation.navigate({
            href,
            open:"dialog",
            context: {
                title,
                message,
                variant,
                ...(classes === undefined ? {} : { classes })
            }
        });
    }
    async message({ type, title, message, classes }) {
        const href = this.#options.message;
        return await this.#navigation.navigate({
            href,
            open:"dialog",
            context: {
                type,
                title,
                message,
                ...(classes === undefined ? {} : { classes })
            }
        });
    }
    async prompt({ title, message, value, inputType, placeholder, required, classes }) {
        const href = this.#options.prompt;
        return await this.#navigation.navigate({
            href,
            open:"dialog",
            context: {
                title,
                message,
                value,
                inputType,
                placeholder,
                required,
                ...(classes === undefined ? {} : { classes })
            }
        });
    }
    async picker({ title, message, value, inputType, placeholder, domain, multiple, required, classes }) {
        const href = this.#options.picker;
        return await this.#navigation.navigate({
            href,
            open:"dialog",
            context: {
                title,
                message,
                domain,
                value,
                inputType,
                placeholder,
                multiple,
                required,
                ...(classes === undefined ? {} : { classes })
            }
        });
    }
    async language({ title = "Select language", message = "Language", value, required=true, current=[], classes } =  {}) {
        let domain = [];
        for (let item of this.#i18n.config.langs) {
            if (current.indexOf(item.id) != -1) continue;
            domain.push({
                value: item.id,
                label: item.label + " (" + item.id + ")"
                //disabled: (disabled.indexOf(item.id) != -1),
            });
        }
        return await this.picker({ title, message, value, inputType: "radios", domain, required, ...(classes === undefined ? {} : { classes }) });
    }
    async open({ href, params, title, breadcrumb, icon, context, classes }) {
        // Add presentation classes without modifying the caller's Page context.
        return await this.#navigation.navigate({
            href,
            params,
            open:"dialog",
            nav: {
                title,
                breadcrumb,
                icon
            },
            context: classes === undefined ? context : { ...context, classes }
        });
    }
}
