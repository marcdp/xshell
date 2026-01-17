import xshell from "xshell";

// class
export default xshell.pages.define(import.meta.url, {
    template: `
        This is sample page
    `,
    //state: {
    //    value: 1        
    //},
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load
                alert(this.definition)
                debugger;
            } 
        }
    }
});

