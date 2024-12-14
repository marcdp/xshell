export default {
    //config
    config: {

        //module
        "modules.module1.name": "module1",
        "modules.module1.label": "Module 1 title",
        "modules.module1.version": "0.1",
        "modules.module1.depends": [],
        "modules.module1.styles": ["./css/styles.css"],        
        
        //loader
        "loader.icon:module1-{name}": "./icons/{name}.svg",
        "loader.component:module1-{name}": "./components/{name}.js",
    },
    //methods
    mount() {
    }
};