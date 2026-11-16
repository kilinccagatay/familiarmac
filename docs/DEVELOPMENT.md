# Development and validation

Use Bash, Python 3, a C compiler/make and Node 18 or newer. Development is against GNOME 46 JavaScript and libinput's stable ABI. Do not run the production installer in CI.

```bash
NODE=node bash tests/run.sh
```

This suite checks JavaScript lifecycle behavior with mocks, native keyd mappings, scroll interposition, shell/Python syntax, installer command plans and archive checksums. It does not assert native desktop visuals or clean-OS compatibility.

On the supported desktop, optional real D-Bus menu test:

```bash
/usr/bin/python3 tests/appmenu-exporter.py
```

It starts an isolated exporter with a synthetic window ID, checks its tree and activation, then exits. The session registrar and Dbusmenu GI must already be available.

To test GDM source matching without installing or restarting anything:

```bash
python3 scripts/build-login-layout.py /tmp/familiarmac-login-test
node tests/login-layout.cjs /tmp/familiarmac-login-test/loginDialog.js
```

Never auto-restart GDM or Shell to verify a patch. Test changes in a disposable supported OS before general release. Measure actual CPU/GPU/frame times before claiming performance improvements; a short CPU sample is not a before/after benchmark.

## Layout

- `extensions/`: original system menu, screenshots, dock state/launch integration.
- `bridges/`: Electron menu to D-Bus adapter, real callbacks only.
- `native/`: opt-in finger-scroll distance multiplier.
- `overrides/`: local changes to pinned upstream rounding extension.
- `vendor/`: pinned source/extension archives and license notices.
- `config/`, `assets/`: keyboard/CSS/Plymouth profiles and artwork.
- `scripts/`: component installers and historical repair tools.
- `install.sh`, `restore.sh`: supported entry points.

## Contributing a distribution profile

Keep hardware quirks, package names, Shell/GDM paths, dock integration and session type explicit. Add preflight and rollback checks; do not remove the existing guards to claim support. Keep input/device overrides opt-in. Submit upstream fixes upstream when possible and record changed archive hashes and provenance.
