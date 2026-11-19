# Additional Mac-style keyboard mappings

These mappings belong to the general keyboard installation. Existing Command-Q
application Quit and Command-W window-close behavior is retained.

| Shortcut | Behavior |
| --- | --- |
| Command-Backspace | Delete to the start of the line; terminals use Ctrl-U |
| Command-H | Minimize the active application's windows |
| Option-Command-H | Minimize other applications' windows |
| Option-Command-M | Minimize all windows of the active application |
| Option-Command-W | Ask the active application's windows to close, retaining native save prompts |
| Option-Command-D | Toggle Dock auto-hide |
| Control-Command-Space | Open Characters |
| Control-Down | Show the active application's windows |

In Files, Command-Backspace moves selected files to Trash. Command-I shows
properties, Command-Y previews, Command-D duplicates, Option-Command-V moves
copied files, and Shift-Command-Backspace requests Empty Trash with confirmation.
Command-Up opens the parent folder, Command-Down opens the selection, Command-[
and Command-] navigate history, Shift-Command-G focuses the location bar, and
Command-comma opens preferences. Desktop selections also support
Command-Backspace, Command-I and Command-Y.

File actions are guarded against text fields, search, rename and popover focus.
Duplicate preserves the previous local clipboard provider if it remains safe to
restore; externally owned clipboard content cannot always be restored.

Linux applications differ: hiding is implemented using minimization, Characters
is a separate application, and the location bar substitutes for Go to Folder.
These are not identical implementations of every macOS command. Updates preserve
unmanaged/custom configurations according to the existing installer guards.
