export default {
    meta: { title: "Layouts", description: "Cards, tabs, and accordions arrange content without Page code." },
    template: `
        <p>Cards, tabs, and accordions arrange content without Page code.</p>
        <x-card><h2>Card</h2><p>A bounded content region.</p></x-card>
        <x-tabs>
            <x-tab label="First">First panel</x-tab>
            <x-tab label="Second">Second panel</x-tab>
        </x-tabs>
        <x-accordion>
            <x-accordion-panel label="Details">Expandable content.</x-accordion-panel>
        </x-accordion>
        
    `
};
