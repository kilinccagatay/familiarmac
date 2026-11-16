import GLib from 'gi://GLib';

export function readProcessIdentity(pid) {
    try {
        const [ok, bytes] = GLib.file_get_contents(`/proc/${pid}/stat`);
        if (!ok) return null;
        const stat = new TextDecoder().decode(bytes);
        // The comm field can contain spaces and parentheses; parse after its last ')'.
        const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
        if (['Z', 'X', 'x'].includes(fields[0])) return null;
        return fields[19] || null; // starttime (field 22) prevents PID reuse mistakes.
    } catch (_) { return null; }
}

export class ProcessTracker {
    constructor(read = readProcessIdentity) { this.read = read; this.apps = new Map(); }
    isRunning(app) {
        const id = app.get_id();
        let known = this.apps.get(id);
        if (!known) { known = new Map(); this.apps.set(id, known); }
        for (const [pid, start] of known) {
            if (this.read(pid) !== start) known.delete(pid);
        }
        for (const pid of app.get_pids?.() ?? []) {
            const start = this.read(pid);
            if (start !== null) known.set(pid, start);
        }
        return known.size > 0;
    }
}
