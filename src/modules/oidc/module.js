
export default {
    //config
    config: {

        //module
        "modules.oidc.name": "oidc",
        "modules.oidc.label": "OpenID Connector module",
        "modules.oidc.version": "1.0.0.0",
        "modules.oidc.depends": [],
        "modules.oidc.styles": [],
        "modules.oidc.logo": "",
        "modules.oidc.pages.handler": "",
        "modules.oidc.type": "library",

        // loader
        "loader.page:/oidc/{path}": "./{path}"
    },
    // methods
    onCommand() {
    }
};
