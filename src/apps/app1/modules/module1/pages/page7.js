
// class
export default {
    template: `
        This is sample page
    `,
    methods:{
        onCommand(command) {
            if (command == "load") {
                //load
                debugger;
                alert(this.definition)
            } 
        }
    }
};

