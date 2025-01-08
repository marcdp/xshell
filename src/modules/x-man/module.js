
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
            "href": "./pages/index.md",
            "default": true,
            "children": [
                {"label": "Shell", href:"./pages/shell/index.md", children:[
                    
                ]},
                {"label": "Layouts", href:"./pages/layouts/index.md", children:[
                    
                ]},
                {"label": "Pages", href:"./pages/pages/index.md", children:[
                    {"label": "Main", href:"./pages/pages/main.md"},
                    {"label": "Stack", href:"./pages/pages/stack.md"},
                    {"label": "Dialog", href:"./pages/pages/dialog.md"},
                    {"label": "Embed", href:"./pages/pages/embed.md"},
                    {"label": "Target", href:"./pages/pages/target.md"},
                ]},
                {"label": "Loader", href:"./pages/loader/index.md", children: [

                ]},
                {"label": "Bus", href:"./pages/bus/index.md", children:[
                ]},
                {"label": "I18n", children:[
                    {"label": "Translations", href:"./pages/i18n/translations.md"},
                    {"label": "Datetime", href:"./pages/i18n/datetime.md"},
                ]},
                {"label": "Components", href:"./pages/components/index.md", children:[
                    {"label": "Buttons", href:"./pages/components/buttons.md"},
                    {"label": "Accordion", href:"./pages/components/accordion.md"},
                    {"label": "Anchor", href:"./pages/components/anchor.md"},
                    {"label": "Cards", href:"./pages/components/cards.md"},
                    {"label": "Dropdown", href:"./pages/components/dropdown.md"},
                    {"label": "Avatar", href:"./pages/components/avatar.md"},
                    {"label": "Clock", href:"./pages/components/clock.md"},
                    {"label": "Divider", href:"./pages/components/divider.md"},
                    {"label": "Lazy", href:"./pages/components/lazy.md"},
                    {"label": "Listview", href:"./pages/components/listview.md"},
                    {"label": "Menu", href:"./pages/components/menu.md"},
                    {"label": "Forms and datafields", href:"./pages/components/forms.md", children:[
                        {"label": "Datafields", href:"./pages/components/datafields.md"},
                        {"label": "Datatable", href:"./pages/components/datatable.md"},
                    ]},
                    {"label": "Spinner", href:"./pages/components/spinner.md"},
                    {"label": "Tabs", href:"./pages/components/tabs.md"},
                    {"label": "Toolbar", href:"./pages/components/toolbar.md"},
                    {"label": "Wizard", href:"./pages/components/wizard.md"},
                ]},
            ]
        },  
        
        // loader
        "loader.page:/x-man/{path}": "./{path}",

        // register
        "loader.page:/x-man/{path}.md": "./{path}.md?loader-handler=fetch-page-markdown",  
        "loader.file:/x-man/{path}.md": "./{path}.md",  

        "loader.page:/x-man/pages/test.pdf": "https://pdfobject.com/pdf/sample.pdf?loader-handler=fetch-page-pdf",  
        

    },
    // methods
    onCommand() {
    }
};
