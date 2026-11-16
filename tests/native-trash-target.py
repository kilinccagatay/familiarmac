"""Exercise native drop acceptance without a display or touching user files."""
import ast
from pathlib import Path
from types import SimpleNamespace as NS
from urllib.parse import urlparse, unquote
source = ast.parse(Path('scripts/trash-drop-target.py').read_text())
module = ast.Module(body=[n for n in source.body if isinstance(n, (ast.ClassDef, ast.FunctionDef))], type_ignores=[])
class File:
    def __init__(self, uri): self.uri = urlparse(uri)
    def is_native(self): return self.uri.scheme == 'file' and not self.uri.netloc
    def get_path(self): return unquote(self.uri.path)
finishes = []
namespace = {'Gio': NS(File=NS(new_for_uri=File)), 'Gtk': NS(drag_finish=lambda *args: finishes.append(args)), 'GLib': NS(SOURCE_REMOVE=False)}
exec(compile(module, 'trash-drop-target.py', 'exec'), namespace)
parse = namespace['file_uris']
assert parse('# comment\r\nfile:///tmp/a%20b\r\nfile:///tmp/a%20b') == ['file:///tmp/a%20b']
for invalid in ['', 'https://example.com/a', 'file:///', 'file://remote/a', 'arbitrary text']:
    try: parse(invalid)
    except ValueError: pass
    else: raise AssertionError(invalid)
target = namespace['Target'].__new__(namespace['Target'])
target.pending = None
target.window = NS(hide=lambda: None)
moves = []
target.move = moves.append
data = NS(get_data=lambda: b'file:///tmp/test')
target.received(None, 'drag', 0, 0, data, 0, 42)
assert not moves and not finishes, 'Unsolicited data must not trash files'
target.pending = ('drag', 42)
target.received(None, 'different-drag', 0, 0, data, 0, 42)
assert not moves
target.received(None, 'drag', 0, 0, data, 0, 42)
assert moves == [['file:///tmp/test']]
assert finishes == [('drag', True, False, 42)], 'Never ask source to delete originals'
target.pending = ('drag', 43)
target.received(None, 'drag', 0, 0, NS(get_data=lambda: b'https://example.com'), 0, 43)
assert len(moves) == 1 and finishes[-1] == ('drag', False, False, 43)
print('Native Trash: local URI validation, real-drop gate and source-delete protection PASS')

# Verify the advertised operation, not merely the eventual filesystem move.
dest = next(n for n in ast.walk(source) if isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute) and n.func.attr == 'drag_dest_set')
actions = eval(compile(ast.Expression(dest.args[2]), 'actions', 'eval'),
               {'Gdk': NS(DragAction=NS(COPY=2, MOVE=4))})
assert actions & 2 and actions & 4, 'Accept COPY-only sources as well as MOVE sources'
print('Native Trash: COPY/MOVE source compatibility PASS')
from enum import IntFlag
class Action(IntFlag):
    COPY = 2
    MOVE = 4
statuses = []
namespace['Gdk'] = NS(DragAction=Action, Atom=NS(intern=lambda *_: 'NONE'),
                      drag_status=lambda ctx, action, time: statuses.append(action))
widget = NS(drag_dest_find_target=lambda *_: 'text/uri-list')
for offered, expected in [(6, 4), (2, 4), (4, 4), (0, 0)]:
    accepted = target.motion(widget, NS(get_actions=lambda: offered), 0, 0, 0)
    assert statuses[-1] == expected and accepted == bool(expected)
assert not target.motion(NS(drag_dest_find_target=lambda *_: 'NONE'), NS(get_actions=lambda: 6), 0, 0, 0)
print('Native Trash: respond MOVE to bridge COPY suggestion, reject unsupported payload PASS')
