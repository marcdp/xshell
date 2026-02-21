
export default class Dialog {

    // vars
    _config = null;
    _navigation = null;

    // ctor
    constructor( { config, navigation } ) {
        this._config = config;
        this._navigation = navigation;
    }

    // methods
    async confirm({ title, message }) {
        const href = this._config.get("xshell.dialog.confirm");
        return await this._navigation.navigate({ 
            href, 
            open:"dialog", 
            context: {
                title,
                message
            } 
        });
    }
    async message({ type, title, message }    ) {
        const href = this._config.get("xshell.dialog.message");
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
    async prompt({ title, message, defaultValue, inputType, placeholder, required }) {
        const href = this._config.get("xshell.dialog.prompt");
        return await this._navigation.navigate({ 
            href, 
            open:"dialog",
            context: {
                title,
                message,
                defaultValue, 
                inputType, 
                placeholder, 
                required  
            } 
        });
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

