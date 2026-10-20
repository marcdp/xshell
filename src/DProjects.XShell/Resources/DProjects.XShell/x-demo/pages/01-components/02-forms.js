
export const contract = {
    description: "Forms",
    events: {},
    properties: {},
    methods: {}
};

export default {
    template: `
        <p>Demonstrates XShell form controls, field types, validation, grouped fields, and wizard forms.</p>

        <h2>List</h2>
        <x-datafields label="Customer">
            <x-datafield label="Name" type="text" x-model="state.customer.name"></x-datafield>

            <x-datafield label="Addresses" type="list" add x-model="state.customer.addresses" x-prop:item-default="state.addressDefault">
                <x-datafields x-for="address in state.customer.addresses" class="grid" columns="2" move remove>
                    <x-datafield label="Street" type="text" x-model="address.street"></x-datafield>
                    <x-datafield label="City" type="text" x-model="address.city" required style="flex:1" placeholder="Enter city"></x-datafield>
                    <x-datafield label="File" type="file" x-model="address.file" style="width:15em;"></x-datafield>
                </x-datafields>
            </x-datafield>
        </x-datafields>

        <x-json x-prop:value="state.customer"></x-json>

        <h2>Basic fields</h2>
        <x-form>
            <x-datafields columns="2">
                <x-datafield type="text" label="Name" placeholder="Enter your name"></x-datafield>
                <x-datafield type="email" label="Email" placeholder="name@example.com"></x-datafield>
                <x-datafield type="number" label="Age" min="0" max="120"></x-datafield>
                <x-datafield type="date" label="Date"></x-datafield>
                <x-datafield type="url" label="Website" placeholder="https://example.com"></x-datafield>
                <x-datafield type="tel" label="Phone" placeholder="+34 600 000 000"></x-datafield>
                <x-datafield type="password" label="Password" placeholder="Enter a password"></x-datafield>
                <x-datafield type="search" label="Search" placeholder="Search for something"></x-datafield>
            </x-datafields>
        </x-form>

        <x-divider></x-divider>

        <h2>Selection fields</h2>
        <p>Selection fields use a domain containing value and label pairs. They support single or multiple choices.</p>
        <x-datafields columns="2">
            <x-datafield type="select" label="Country" placeholder="Select a country" domain="dataset:x-demo:countries"></x-datafield>    
            <x-datafield type="select" label="Country" placeholder="Select a country" x-prop:domain="state.countries"></x-datafield>
            <x-datafield type="select" label="Languages" placeholder="Select languages" multiple x-prop:domain="state.languages"></x-datafield>
            <x-datafield type="radios" label="Priority" x-prop:domain="state.priorities"></x-datafield>
            <x-datafield type="checkboxes" label="Notifications" x-prop:domain="state.notifications"></x-datafield>
        </x-datafields>

        <x-divider></x-divider>

        <h2>Boolean fields</h2>
        <p>Boolean fields represent individual on/off choices.</p>
        <x-datafields columns="2">
            <x-datafield type="checkbox" label="Enabled" label-secondary="Enable this feature" value="true"></x-datafield>
            <x-datafield type="checkbox" label="Accept terms" label-secondary="I accept the terms and conditions" required></x-datafield>
        </x-datafields>

        <x-divider></x-divider>

        <h2>Object fields</h2>
        <p>An object field can contain nested data fields. Its checkbox enables or disables the object value.</p>
        <x-datafields columns="1">
            <x-datafield type="object" label="Address" x-prop:value="state.address">
                <x-datafields columns="2">
                    <x-datafield type="text" label="Street" placeholder="Street address"></x-datafield>
                    <x-datafield type="text" label="City" placeholder="City"></x-datafield>
                    <x-datafield type="text" label="Postal code" placeholder="Postal code"></x-datafield>
                    <x-datafield type="select" label="Country" placeholder="Select a country" x-prop:domain="state.countries"></x-datafield>
                </x-datafields>
            </x-datafield>
        </x-datafields>

        <x-divider></x-divider>

        <h2>Field states</h2>
        <x-datafields columns="2">
            <x-datafield type="text" label="Required" placeholder="Required value" required></x-datafield>
            <x-datafield type="text" label="Readonly" value="Readonly value" readonly></x-datafield>
            <x-datafield type="text" label="Disabled" value="Disabled value" disabled></x-datafield>
            <x-datafield type="text" label="With description" description="Additional information about this field." placeholder="Value"></x-datafield>
        </x-datafields>

        <x-divider></x-divider>

        <h2>Text areas</h2>
        <x-datafields columns="2">
            <x-datafield type="textarea" label="Description" placeholder="Write a description"></x-datafield>
            <x-datafield type="textarea" label="Limited text" maxlength="200" placeholder="Maximum 200 characters"></x-datafield>
        </x-datafields>

        <x-divider></x-divider>

        <h2>Grouped fields</h2>
        <x-datafields label="Contact information" message="Example of several related fields grouped together." columns="3">
            <x-datafield type="text" label="First name"></x-datafield>
            <x-datafield type="text" label="Last name"></x-datafield>
            <x-datafield type="email" label="Email"></x-datafield>
            <x-datafield type="text" label="Address"></x-datafield>
        </x-datafields>

        <x-divider></x-divider>

        <h2>Form footer</h2>
        <x-form>
            <x-datafields columns="2">
                <x-datafield type="text" label="Username" required></x-datafield>
                <x-datafield type="password" label="Password" required></x-datafield>
            </x-datafields>
            <x-button slot="footer" class="submit" label="Save"></x-button>
            <x-button slot="cancel" class="cancel" label="Cancel"></x-button>
        </x-form>

        <x-divider></x-divider>

        <h2>Wizard form</h2>
        <x-form wizard wizard-direction="horizontal">
            <div label="Account" message="Basic account information" icon="x-person">
                <x-datafields columns="2">
                    <x-datafield type="text" label="Username" required></x-datafield>
                    <x-datafield type="email" label="Email" required></x-datafield>
                    <x-datafield type="password" label="Password" required></x-datafield>
                </x-datafields>
            </div>

            <div label="Profile" message="Personal information" icon="x-edit">
                <x-datafields columns="2">
                    <x-datafield type="text" label="First name" required></x-datafield>
                    <x-datafield type="text" label="Last name" required></x-datafield>
                    <x-datafield type="select" label="Country" placeholder="Select a country" x-prop:domain="state.countries"></x-datafield>
                    <x-datafield type="textarea" label="Description" placeholder="Tell us something about yourself"></x-datafield>
                </x-datafields>
            </div>

            <div label="Preferences" message="Application preferences" icon="x-settings">
                <x-datafields columns="2">
                    <x-datafield type="checkbox" label="Enable notifications" label-secondary="Enable notifications"></x-datafield>
                    <x-datafield type="radios" label="Priority" x-prop:domain="state.priorities"></x-datafield>
                    <x-datafield type="checkboxes" label="Notification channels" x-prop:domain="state.notifications"></x-datafield>
                </x-datafields>
            </div>

            <x-button slot="cancel" class="cancel" label="Cancel"></x-button>
            <x-button slot="footer" class="submit" command="submit" label="Finish"></x-button>
        </x-form>


    `,

    state: {
        countries: [
            { value: "es", label: "Spain" },
            { value: "fr", label: "France" },
            { value: "de", label: "Germany" },
            { value: "uk", label: "United Kingdom" }
        ],
        languages: [
            { value: "en", label: "English" },
            { value: "es", label: "Spanish" },
            { value: "fr", label: "French" },
            { value: "de", label: "German" }
        ],
        priorities: [
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" }
        ],
        notifications: [
            { value: "email", label: "Email" },
            { value: "sms", label: "SMS" },
            { value: "push", label: "Push notifications" }
        ],
        address: {},
        customer: {
            name: "",
            addresses: [
                { street: "11", city: "22", file: null },
                { street: "33", city: "44", file: null }
            ]
        },
        addressDefault: { street: "", city: "", file:null }
    },

    controller({ state  }) {
        return {
            load() {
                // load
            }
        };
    }
};
