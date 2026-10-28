export default {
    template: `
        <h1>Lists</h1>
        <p>The list view presents the same items in several supported layouts.</p>
        <x-listview view="list" views="list,details,tiles,icons">
            <x-listview-head><x-listview-column label="Name"></x-listview-column></x-listview-head>
            <x-listview-body>
                <x-listview-item icon="x-file" label="Notes.txt"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
                <x-listview-item icon="x-image" label="Photo.png"></x-listview-item>
            </x-listview-body>
        </x-listview>
        
    `
};
