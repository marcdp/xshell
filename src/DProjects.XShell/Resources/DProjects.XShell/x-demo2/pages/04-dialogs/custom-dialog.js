
export const contract = {
    properties: {
        message: {type:"string", default:"", state:true, context:true},
        value: {type:"string", default:"", state:true, context:true}
    }
};

export default {
    meta: {
        title: "Custom Dialog",
        description: "A custom dialog Page that receives context and returns a result."
    },

    template: `
        <p>This is an ordinary XShell Page opened through <code>dialog.open()</code>. Its initial values come from the parent Page's context.</p>

        <h2>Received context</h2>
        <x-notice type="info" label="Message" x-attr:message="state.message"></x-notice>

        <h2>Edit value</h2>
        <p>Change the value and choose Save to return it to the parent Page.</p>
        <x-form>
            <x-datafields columns="1">
                <x-datafield type="text" label="Value" x-model="state.value"></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" label="Save" command="save"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel" command="cancel"></x-button>
        </x-form>
    `,

    state: {
        message: "",
        value: ""
    },

    controller({page, state}) {
        return {
            save() {page.close({accepted:true, value:state.value});},
            cancel() {page.close(null);}
        };
    }
};
