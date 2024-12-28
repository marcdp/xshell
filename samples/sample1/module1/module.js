export default {
    //config
    config: {

        //module
        "modules.module1.name": "module1",
        "modules.module1.label": "Module 1 title",
        "modules.module1.logo": "module1-add",
        "modules.module1.version": "0.1",
        "modules.module1.type": "application",
        "modules.module1.depends": [],
        "modules.module1.styles": ["./css/styles.css"],
        "modules.module1.menus.main": {
            "label": "Amazon S3",
            "href": "./pages/page0.html",
            "default": true,
            "children": [
                { "label": "Block Public Access settings for this account BIG", "href": "./pages/page1.html" },
                { "label": "Page 2", "href": "./pages/page2.html" },
                { "label": "Page 3", "href": "./pages/page3.html" },
                { "label": "Page 4", "href": "./pages/page4.html" },
                { "label": "Objects", "href": "./pages/page5.html", children:[
                    { "label": "Es un hecho establecido hace ", "href": "./pages/page6.html" },
                ] },                
                { "label": "-"},
                { "label": "Page 7", "href": "./pages/page7.html" },
                { "label": "Page 8", "href": "./pages/page8.html" }                
            ]
        },

        //loader
        "loader.icon:module1-{name}": "./icons/{name}.svg",

        "loader.component:module1-{name}": "./components/{name}.js",        
        
        "loader.page:/module1/{path}": "./{path}"
    },
    //methods
    onCommand(command, args) {
        console.log(command + " " + args);
    }
};