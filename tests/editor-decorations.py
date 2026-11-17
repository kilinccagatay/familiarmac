#!/usr/bin/python3
import importlib.util,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('ed',root/'scripts/editor-decorations.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
cases=['{}','{ // keep\n "editor.fontSize": 14,\n}', '{"url":"https://example/a,}","nested":{"window.titleBarStyle":"custom"}}','{/* comment */"window.titleBarStyle": "custom", "name":"a\\\"b"}', '{"a":1 // trailing comment\n}']
for text in cases:
 out=m.native_setting(text)
 assert m.native_setting(out)==out
 assert any(t[0]=='"native"' for t in m.tokens(out))
 if '// keep' in text:assert '// keep' in out
 if 'https://' in text:assert 'https://example/a,}' in out
for text in ['[]','{"window.titleBarStyle":false}','{"window.titleBarStyle":"custom","window.titleBarStyle":"native"}','{"broken":']:
 try:m.native_setting(text)
 except (ValueError,json.JSONDecodeError):pass
 else:raise AssertionError(text)
print('Editor frames: JSONC comments, strings, nested values, trailing commas, idempotence and malformed input protection PASS')
