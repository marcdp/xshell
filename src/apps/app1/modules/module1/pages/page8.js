
// class
export default {
    meta: {
        title: "Page 8",
        description: "This is a sample page 8 description"
    },
    state: {
        varMarc1: { value: 0,  qs: true, reflect:true },
        var2: { value: 0 }
    },
    template: `
        <p>
            This is sample page 8: {{state.varMarc1}}
            <br/>
            <x-button label="Do something" command="doSomething"></x-button>
        </p>
    `,
    script({ state }) {
        return {
            onCommand(command, params){
                if (command == "doSomething") {
                    // dosomething
                    state.varMarc1++;
                    state.var2++;
                }
            }
        }
    }

};

