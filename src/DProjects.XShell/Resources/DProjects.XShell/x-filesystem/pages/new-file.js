// contract
export const contract = {
    description: "New file page",
    events: {},
    properties: {
    },
    methods: {}
};

// export page
export default {
    meta: {
        title: "Upload files"        
    },
    style: `
    `,
    template: `
        <x-form>
            <x-datafields>
                <x-datafield label="Select local files to upload" type="file" multiple x-model="state.files"></x-datafield>
            </x-datafields>
            <x-button slot="footer" command="ok" label="OK" class="submit"></x-button>            
            <x-button slot="footer" command="cancel" label="Cancel" class="cancel"></x-button>
        </x-form>
    `,    
    state: {
        files: []
    },
    controller({ state, page }) {
        return {
            load(){
                //load
                
            },
            submit(){
                page.close();
            },
            cancel(){
                page.close();
            }
        };
    }
}
