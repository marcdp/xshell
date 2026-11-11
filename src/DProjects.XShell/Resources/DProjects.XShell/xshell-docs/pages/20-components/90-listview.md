# List View Selection

`x-listview` manages direct `x-listview-item` children of its `x-listview-body`. Each item's `selected` property is the selection state. The list keeps a separate active item and Shift-selection anchor. Hidden items are skipped.

With `multiple`, a click selects one item, Ctrl/Cmd+click toggles an item, Shift+click selects a range, and Ctrl/Cmd+Shift+click adds a range. Ctrl/Cmd+A selects all visible items. Arrow keys, Home, and End move the active selection; Shift extends the range. Space toggles the active item, Escape clears selection, and Enter or double-click activates an item. Right-click keeps the selection when the item is already selected and selects it alone otherwise.

`select(path)` selects one path, `selectPaths(paths)` selects several paths in multiple mode, and `clear()` removes the selection. The bubbling, composed `select` event includes `item`, `index`, `selected`, `selectedItems` in displayed order, and `sourceEvent` for user input. Changing between list, details, icons, and tiles views keeps the selection.

`x-filesystem-list` enables multiple selection and exposes `selectPaths(paths)`, `getSelectedPaths()`, and `getSelectedEntries()`. Its `select` event includes the active `path` and `entry`, all selected `paths` and `entries`, and `sourceEvent`. Refresh keeps paths that still exist in the current directory; navigation clears the previous directory's selection. The parent `x-filesystem` explorer deletes multiple selected entries with one confirmation while keeping open, rename, and properties as single-target actions.

## List data-field item defaults

`x-datafield type="list"` accepts the optional `itemDefault` property. Bind an object with `x-prop:item-default`; each Add action deep-clones that
value before appending it. When the value is absent or `null`, the Component appends `{}`. Nested objects and arrays are cloned so added items do not
share mutable values.

```html
<x-datafield type="list" add x-model="state.customer.addresses" x-prop:item-default="state.addressDefault">
    <x-datafields x-for="address in state.customer.addresses" move remove>
        <x-datafield label="Street" x-model="address.street"></x-datafield>
        <x-datafield label="City" x-model="address.city"></x-datafield>
    </x-datafields>
</x-datafield>
```

Define every property used by an item-level `x-model` binding on the default object. XShell's strict assignment semantics do not create missing
members automatically.
