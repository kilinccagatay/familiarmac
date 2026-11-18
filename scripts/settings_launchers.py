"""Route installed Settings panel shortcuts through the user-scoped integration."""
import hashlib
import json
from pathlib import Path
import shlex


def rewrite(text, wrapper):
    changed = False
    lines = []
    # Desktop Exec uses double-quote escaping, not shell single quotes.
    quoted = '"' + str(wrapper).replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$') + '"'
    for line in text.splitlines():
        if line.startswith('Exec='):
            command = line[5:]
            try:
                argv = shlex.split(command)
            except ValueError:
                return None
            if argv and argv[0] in ('gnome-control-center', '/usr/bin/gnome-control-center'):
                # Retain panel arguments/field codes exactly as supplied.
                end = len(command) - len(command.lstrip())
                first = command[end:]
                if first.startswith(('"', "'")):
                    end += first.index(first[0], 1) + 1
                else:
                    end += len(first.split(None, 1)[0])
                line = 'Exec=' + quoted + command[end:]
                changed = True
        if line == 'DBusActivatable=true':
            line = 'DBusActivatable=false'
        lines.append(line)
    return '\n'.join(lines) + '\n' if changed else None


def install(base, home, wrapper, system=Path('/usr/share/applications')):
    manifest = base / 'panel-launchers.json'
    records = json.loads(manifest.read_text()) if manifest.exists() else {}
    target = home / '.local/share/applications'
    target.mkdir(parents=True, exist_ok=True)
    for source in sorted(system.glob('gnome-*-panel.desktop')):
        dest = target / source.name
        if dest.is_symlink():
            continue
        record = records.get(source.name)
        if record and dest.exists() and hashlib.sha256(dest.read_bytes()).hexdigest() != record['sha256']:
            continue  # Preserve subsequent user edits.
        text = dest.read_text() if dest.exists() and not record else source.read_text()
        updated = rewrite(text, wrapper)
        if updated is None:
            continue
        before = record['before'] if record else (dest.read_text() if dest.exists() else None)
        dest.write_text(updated)
        records[source.name] = {'before': before, 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()}
    manifest.write_text(json.dumps(records, indent=2) + '\n')


def restore(base, home):
    manifest = base / 'panel-launchers.json'
    if not manifest.exists():
        return
    for name, record in json.loads(manifest.read_text()).items():
        dest = home / '.local/share/applications' / name
        if not dest.is_file() or dest.is_symlink() or hashlib.sha256(dest.read_bytes()).hexdigest() != record['sha256']:
            continue
        if record['before'] is None:
            dest.unlink()
        else:
            dest.write_text(record['before'])
