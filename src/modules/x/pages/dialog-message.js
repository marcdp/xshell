// export page
export default {
    template: `
        <x-form command="ok">            
            <x-notice x-attr:type="state.type" x-attr:label="state.title" x-attr:message="state.message">
            </x-notice>
            <x-button slot="footer" label="OK" command="ok" class="ok"></x-button>                        
        </x-form>
    `,    
    state: {
        title: {value:""},
        message: {value:""},
        type: {value:"info", enum:["info","success","warning","error"]},
    },
    script({ state, context }) {
        return {
            onCommand(command, params) {
                if (command == "load") {
                    // load
                    state.title = context.title;
                    state.message = context.message;
                    state.type = context.type ?? "info";

                } else if (command == "ok") {
                    //ok
                    this.close("ok");
                }                
            }
        };
    }
}
