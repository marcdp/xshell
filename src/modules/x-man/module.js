
export default {
    //config
    config: {

        //module
        "modules.x-man.name": "x-man",
        "modules.x-man.label": "XShell Manual",
        "modules.x-man.version": "1.0.0.0",
        "modules.x-man.depends": [],
        "modules.x-man.styles": [],
        "modules.x-man.icon": "",
        "modules.x-man.page-handler": "sfc",
        "modules.x-man.type": "application",
        "modules.x-man.menus.main": {
            "label": "XShell Manual",
            "href": "./pages/index.html",
            "default": true,
            "children": [
                {"label": "Test", href:"./pages/test.md"},
                {"label": "Shell", href:"./pages/shell/index.html", children:[
                    
                ]},
                {"label": "Layouts", href:"./pages/layouts/index.html", children:[
                    
                ]},
                {"label": "Pages", href:"./pages/pages/index.html", children:[
                    {"label": "Stack", href:"./pages/pages/stack.html"},
                    {"label": "Dialog", href:"./pages/pages/dialog.html"},
                    {"label": "Target", href:"./pages/pages/target.html"},
                ]},
                {"label": "Loader", href:"./pages/loader/index.html", children: [

                ]},
                {"label": "Bus", href:"./pages/bus/index.html", children:[
                    
                ]},
                {"label": "Components", href:"./pages/components/index.html", children:[
                    {"label": "Buttons", href:"./pages/components/buttons.html"},
                    {"label": "Accordion", href:"./pages/components/accordion.html"},
                    {"label": "Anchor", href:"./pages/components/anchor.html"},
                    {"label": "Cards", href:"./pages/components/cards.html"},
                    {"label": "Dropdown", href:"./pages/components/dropdown.html"},
                    {"label": "Avatar", href:"./pages/components/avatar.html"},
                    {"label": "Clock", href:"./pages/components/clock.html"},
                    {"label": "Divider", href:"./pages/components/divider.html"},
                    {"label": "Lazy", href:"./pages/components/lazy.html"},
                    {"label": "Listview", href:"./pages/components/listview.html"},
                    {"label": "Menu", href:"./pages/components/menu.html"},
                    {"label": "Forms and datafields", href:"./pages/components/forms.html", children:[
                        {"label": "Datafields", href:"./pages/components/datafields.html"},
                        {"label": "Datatable", href:"./pages/components/datatable.html"},
                    ]},
                    {"label": "Spinner", href:"./pages/components/spinner.html"},
                    {"label": "Tabs", href:"./pages/components/tabs.html"},
                    {"label": "Toolbar", href:"./pages/components/toolbar.html"},
                    {"label": "Wizard", href:"./pages/components/wizard.html"},
                ]},
            ]
        },  
        
        // loader
        "loader.page:/x-man/{path}": "./{path}",

        "loader.page:/x-man/{path}md": "./{path}md?loader-transform=markdown",

    },
    // methods
    onCommand() {
    }
};
