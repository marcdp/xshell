# List View Selection

`x-listview` manages direct `x-listview-item` children of its `x-listview-body`. Each item's `selected` property is the selection state. The list keeps a separate active item and Shift-selection anchor. Hidden items are skipped.

With `multiple`, a click selects one item, Ctrl/Cmd+click toggles an item, Shift+click selects a range, and Ctrl/Cmd+Shift+click adds a range. Ctrl/Cmd+A selects all visible items. Arrow keys, Home, and End move the active selection; Shift extends the range. Space toggles the active item, Escape clears selection, and Enter or double-click activates an item. Right-click keeps the selection when the item is already selected and selects it alone otherwise.

`select(path)` selects one path, `selectPaths(paths)` selects several paths in multiple mode, and `clear()` removes the selection. The bubbling, composed `select` event includes `item`, `index`, `selected`, `selectedItems` in displayed order, and `sourceEvent` for user input. Changing between list, details, icons, and tiles views keeps the selection.

`x-filesystem-list` enables multiple selection and exposes `selectPaths(paths)`, `getSelectedPaths()`, and `getSelectedEntries()`. Its `select` event includes the active `path` and `entry`, all selected `paths` and `entries`, and `sourceEvent`. Refresh keeps paths that still exist in the current directory; navigation clears the previous directory's selection. The parent `x-filesystem` explorer deletes multiple selected entries with one confirmation while keeping open, rename, and properties as single-target actions.
