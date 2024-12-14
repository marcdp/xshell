
export default {
    //config
    config: {

        //module
        "modules.x.name": "x",
        "modules.x.label": "X module",
        "modules.x.version": "1.0.0.0",
        "modules.x.depends": [],
        "modules.x.styles": ["./css/styles.css"],

        //loader
        "loader.component:x-{name}": "./components/x-{name}.js",
        "loader.component:ace-editor": "https://unpkg.com/ace-custom-element@latest/dist/index.min.js",
        "loader.icon:x-{name}": "./icons/{name}.svg",
        "loader.layout:x-layout-{name}": "./layouts/{name}.js",
        "loader.function:x-page-handler-{name}": "./ui/{name}.js",

        // pages
        "pages.layout.default": "x-layout-default",
        "pages.layout.dialog": "x-layout-dialog",
        "pages.layout.main": "x-layout-main",
        "pages.layout.stack": "x-layout-stack",
        "pages.layout.embed": "x-layout-embed",

        // shell
        "shell.error": "x-page-error",

    },
    // methods
    async mount() {
    }
}
