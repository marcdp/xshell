
export default {
    //config
    config: {

        //module
        "modules.x.name": "x",
        "modules.x.label": "X module",
        "modules.x.version": "1.0.0.0",
        "modules.x.depends": [],
        "modules.x.styles": ["./css/styles.css"],
        "modules.x.icon": "",
        "modules.x.page-handler": "sfc",
        "modules.x.type": "library",
        "modules.x.menus.main": {
            "label": "Module X",
            "href":"",
            "children": [
                { "label": "Debug", "href": "/x/pages/debug.html" },
                { "label": "Modules", "href": "/x/pages/modules.html" },
                { "label": "Language picker", "href": "/x/pages/lang-picker.html" },
                { "label": "Playground", "href": "/x/pages/playground.html" },
                { "label": "Search", "href": "/x/pages/search.html" },
                { "label": "Google", "href": "http://www.google.com/", "target":"_blank"},
            ]
        },

        //loader
        "loader.component:x-{name}": "./components/x-{name}.js",
        "loader.component:ace-editor": "https://unpkg.com/ace-custom-element@latest/dist/index.min.js",
        "loader.icon:x-{name}": "./icons/{name}.svg",
        "loader.layout:x-layout-{name}": "./layouts/x-layout-{name}.js",
        "loader.page:/x/pages/{path}": "./pages/{path}",
        "loader.page-handler:sfc": "./ui/page-instance-sfc.js",   

        // pages
        "pages.layout.default": "x-layout-default",
        "pages.layout.dialog": "x-layout-dialog",
        "pages.layout.main": "x-layout-main",
        "pages.layout.stack": "x-layout-stack",
        "pages.layout.embed": "x-layout-embed",

        // shell
        "shell.error": "/x/pages/error.html",
        "shell.lazy": "x-lazy"

    },
    // methods
    onCommand() {
    }
};
