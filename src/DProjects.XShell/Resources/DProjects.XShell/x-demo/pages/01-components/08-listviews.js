
// contract
export const contract = {
    description: "Demonstrates the x-listview and x-listview-item components.",
    events: {},
    properties: {},
    methods: {}
};

// export page
export default {
    template: `

        <p>
            The <code>x-listview</code> component arranges
            <code>x-listview-item</code> elements in list, details, tiles, or icons views.
            Use <code>view</code> to select the current presentation and
            <code>views</code> to enable the built-in view selector.
        </p>

        <h2>1. Selectable views</h2>

        <p>
            Use the view selector to switch between list, details,
            tiles, and icons.
        </p>

        <x-listview view="list" views="list,details,tiles,icons">

            <span slot="column">Name</span>
            <span slot="column">Type</span>
            <span slot="column">Size</span>

            <x-listview-item
                category="Documents"
                icon="x-file"
                label="Architecture.md"
                description="Markdown document">
                <span>Markdown</span>
                <span>18 KB</span>
            </x-listview-item>

            <x-listview-item
                category="Documents"
                icon="x-file"
                label="Notes.txt"
                description="Text document">
                <span>Text</span>
                <span>6 KB</span>
            </x-listview-item>

            <x-listview-item
                category="Documents"
                icon="x-file"
                label="Report.pdf"
                description="PDF document">
                <span>PDF</span>
                <span>840 KB</span>
            </x-listview-item>

            <x-listview-item
                category="Media"
                icon="x-image"
                label="Banner.png"
                description="Image">
                <span>PNG image</span>
                <span>1.8 MB</span>
            </x-listview-item>

            <x-listview-item
                category="Media"
                icon="x-image"
                label="Photo.jpg"
                description="Image">
                <span>JPEG image</span>
                <span>3.2 MB</span>
            </x-listview-item>

            <x-listview-item
                category="Folders"
                icon="x-folder"
                label="Projects"
                description="Folder">
                <span>Folder</span>
                <span>-</span>
            </x-listview-item>

        </x-listview>

        <x-divider></x-divider>

        <h2>2. Fixed views</h2>

        <p>
            Without the <code>views</code> property, the component
            displays a fixed view without a view selector.
        </p>

        <h3>Tiles</h3>

        <x-listview view="tiles">

            <x-listview-item
                icon="x-folder"
                label="Source"
                description="Application source">
            </x-listview-item>

            <x-listview-item
                icon="x-folder"
                label="Tests"
                description="Automated tests">
            </x-listview-item>

            <x-listview-item
                icon="x-file"
                label="README.md"
                description="Repository overview">
            </x-listview-item>

            <x-listview-item
                icon="x-file"
                label="global.json"
                description=".NET SDK configuration">
            </x-listview-item>

        </x-listview>

        <h3>Icons</h3>

        <x-listview view="icons">

            <x-listview-item icon="x-folder" label="Documents"></x-listview-item>
            <x-listview-item icon="x-folder" label="Images"></x-listview-item>
            <x-listview-item icon="x-file" label="Notes.txt"></x-listview-item>
            <x-listview-item icon="x-image" label="Photo.jpg"></x-listview-item>

        </x-listview>

        <x-divider></x-divider>

        <h2>3. Details and columns</h2>

        <p>
            In details view, elements assigned to the
            <code>column</code> slot define the column headers.
            Child content inside each item defines the additional cells.
        </p>

        <x-listview view="details">

            <span slot="column">Name</span>
            <span slot="column">Status</span>
            <span slot="column">Owner</span>

            <x-listview-item icon="x-folder" label="Core">
                <span>Active</span>
                <span>Platform</span>
            </x-listview-item>

            <x-listview-item icon="x-folder" label="Documentation">
                <span>Active</span>
                <span>Developer experience</span>
            </x-listview-item>

            <x-listview-item icon="x-folder" label="Samples">
                <span>Review</span>
                <span>Platform</span>
            </x-listview-item>

        </x-listview>

        <x-divider></x-divider>

        <h2>4. Navigation items</h2>

        <p>
            List-view items can navigate to other pages using
            the <code>href</code> property.
        </p>

        <x-listview view="list">

            <x-listview-item
                icon="x-file"
                label="Basics"
                description="Basic component examples"
                href="01-basics.js">
            </x-listview-item>

            <x-listview-item
                icon="x-edit"
                label="Forms"
                description="Form component examples"
                href="02-forms.js">
            </x-listview-item>

            <x-listview-item
                icon="x-table"
                label="Data"
                description="Data component examples"
                href="03-data.js">
            </x-listview-item>

        </x-listview>

        <x-divider></x-divider>

        <h2>5. Auto-scroll</h2>

        <p>
            The <code>auto-scroll</code> property automatically
            scrolls to the last item when the list refreshes.
        </p>

        <x-listview
            view="list"
            auto-scroll
            style="max-height:10em; overflow:auto; border:var(--x-datafield-border); padding:.5em;">

            <x-listview-item icon="x-file" label="Message 1"></x-listview-item>
            <x-listview-item icon="x-file" label="Message 2"></x-listview-item>
            <x-listview-item icon="x-file" label="Message 3"></x-listview-item>
            <x-listview-item icon="x-file" label="Message 4"></x-listview-item>
            <x-listview-item icon="x-file" label="Message 5"></x-listview-item>
            <x-listview-item icon="x-file" label="Message 6"></x-listview-item>
            <x-listview-item icon="x-file" label="Message 7"></x-listview-item>
            <x-listview-item icon="x-file" label="Message 8"></x-listview-item>
            <x-listview-item icon="x-file" label="Latest message"></x-listview-item>

        </x-listview>

    `,

    controller() {
        return {
            load() {
                // Static component examples.
            }
        };
    }
};
