// export page
export default {
    template: `
        <x-form command="ok">            
            <x-datafields>
                <x-datafield 
                    x-attr:label="state.title"     
                    x-attr:description="state.message"     
                    x-model="state.value" 
                    x-attr:placeholder="state.placeholder"
                    x-attr:required="state.required"
                    x-attr:type="state.inputType"
                ></x-datafield>
            </x-datafields>
            <x-button slot="cancel" label="Cancel" command="cancel" class="cancel"></x-button>
            <x-button slot="footer" label="Save" command="ok" class="submit"></x-button>            
        </x-form>
    `,    
    state: {
        title: {value:""},
        message: {value:""},
        defaultValue: {value:""},
        inputType: {value:"text", enum:["text","number","password"]},
        placeholder: {value:""},
        required: {value:false},
        value: {value:""}
    },
    script({ state, context }) {
        return {
            onCommand(command, params) {
                if (command == "load") {
                    // load
                    state.title = context.title;
                    state.message = context.message;
                    state.defaultValue = context.defaultValue ?? "";
                    state.inputType = context.inputType ?? "text";
                    state.placeholder = context.placeholder ?? "";
                    state.required = context.required ?? false;
                    state.value = context.defaultValue ?? "";

                } else if (command == "ok") {
                    //ok
                    this.close(state.value);

                } else if (command == "cancel") {
                    //cancel
                    this.close(null);
                }                
            }
        };
    }
}
