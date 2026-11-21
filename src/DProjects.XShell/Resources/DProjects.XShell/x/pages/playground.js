export default {
    contract: {
        description: "Edits and renders an XTemplate supplied through the Page query or context.",
        properties: {
            template: {
                type:"string",
                default:"<h2>Hello XTemplate</h2>\n<p>Edit this source to update the live preview.</p>",
                state:true,
                query:true,
                context:true,
                description:"XTemplate source. Page context overrides the query value when both are supplied."
            }
        }
    },

    meta: {
        title: "Playground",
        description: "Edit XTemplate source and inspect its live rendered output.",
    },

    style: `
        :scope {}

        x-form {}
        x-form  x-datafields {}
        x-form  x-datafields x-datafield[type="html"] {}
        
 
    `,

    template: `

        <x-form>
            <x-datafields>
                <x-datafield label="Template source" type="html" x-model="state.template" autofocus></x-datafield>
                <x-datafield label="Preview" sstyle="height:25vh;">
                    <x-template x-prop:template="state.template" x-model="state.previewValue" style="height:100%;"></x-template>
                </x-datafield>
            </x-datafields>

            <x-button slot="footer" label="Close" class="cancel" command="close"></x-button>
        </x-form>
    `,

    state: {
        previewValue: {}
    },

    controller({ page }) {
        return {
            close() {
                // close
                page.close();
            }
        }
    }

};
