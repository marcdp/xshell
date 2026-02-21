
// class
export default {
    meta: {
        title: "Page 8",
        description: "This is a sample page 8 description"
    },
    state: {
        var1: { value: 0,  qs: true },
    },
    template: `
        <p>
            This is sample page 8: {{state.var1}}
            <br/>
            <x-button label="Do something" command="doSomething"></x-button>
        </p>
    `,
    script({ state }) {
        return {
            onCommand(command, params){
                if (command == "doSomething") {
                    // dosomething
                    state.var1++;
                }
            }
        }
    }

};

