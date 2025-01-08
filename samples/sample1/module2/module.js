export default {
    //config
    config: {

        //app
        "modules.module2.name": "module2",
        "modules.module2.label": "Module 2",
        "modules.module2.icon": "",
        "modules.module2.version": "0.1",
        "modules.module2.depends": [],  
        "modules.module2.styles": [],
        "modules.module2.page-handler": "",      
        "modules.module2.type": "application",      
        "modules.module2.menus.main": {
            "label": "Amazon S5555",
            "children": [
                { "label": "page 1", "href": "./pages/page1.html", children:[
                    { "label": "Page 2", "href": "./pages/page2.html", default:true }
                ] },                
            ]
        },   
        
        //loader
        "loader.page:/module2/{path}": "./{path}"
    },
    //methods
    onCommand() {
    }
};