
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
    _navigation = null;
    _i18n = null;
    _options = null;

    // ctor
    constructor({ navigation, i18n }, options = {}) {
        // Initialize injected dependencies and service configuration
        this._navigation = navigation;
        this._i18n = i18n;
        this._options = options;
    }

    // methods
    async confirm({ title, message, variant }) {
        const href = this._options.confirm;
        return await this._navigation.navigate({
            href,
            open:"dialog",
            context: {
                title,
                message,
                variant
            }
        });
    }
    async message({ type, title, message }) {
        const href = this._options.message;
        return await this._navigation.navigate({
            href,
            open:"dialog",
            context: {
                type,
                title,
                message
            }
        });
    }
    async prompt({ title, message, value, inputType, placeholder, required }) {
        const href = this._options.prompt;
        return await this._navigation.navigate({
            href,
            open:"dialog",
            context: {
                title,
                message,
                value,
                inputType,
                placeholder,
                required
            }
        });
    }
    async picker({ title, message, value, inputType, placeholder, domain, multiple, required }) {
        const href = this._options.picker;
        return await this._navigation.navigate({
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
                required
            }
        });
    }
    async language({ title = "Select language", message = "Language", value, required=true, current=[] } =  {}) {
        let domain = [];
        for (let item of this._i18n.config.langs) {
            if (current.indexOf(item.id) != -1) continue;
            domain.push({
                value: item.id,
                label: item.label + " (" + item.id + ")"
                //disabled: (disabled.indexOf(item.id) != -1),
            });
        }
        return await this.picker({ title, message, value, inputType: "radios", domain, required});
    }
    async open({ href, params, title, breadcrumb, icon, context }) {
        return await this._navigation.navigate({
            href,
            params,
            open:"dialog",
            nav: {
                title,
                breadcrumb,
                icon
            },
            context
        });
    }
}
