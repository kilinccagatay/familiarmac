# Releases and updates

FamiliarMac distributes a portable `tar.gz` bundle with `VERSION`, `RELEASE.json` and a separate `SHA256SUMS` asset. GitHub Actions tests each version change/tag before publishing the bundle. Only a published stable release with both assets is offered by the updater; branch commits and prereleases are never installed automatically.

## Install

Download the bundle and checksum from [Releases](https://github.com/kilinccagatay/familiarmac/releases), verify with `sha256sum --check SHA256SUMS`, extract, then run `./install.sh --all` as your desktop user. Zorin OS 18.x / GNOME 46 / x86-64 is the tested baseline. Desktop-only installation remains available with `--desktop` after prerequisites.

## Dock & Window

The FamiliarMac section displays the installed version. Opening Settings checks for stable updates in the background, with a six-hour cache. **Check for Updates** refreshes the status inline. When a new version is available, **Download Update…** asks for confirmation. Download progress is shown underneath the version row, followed automatically by verification and installation. Being up to date never opens a separate window. Installation is explicit; system dependencies/themes request administrator authentication. Following success, a **Later / Log Out…** dialog is offered. Log Out opens GNOME's own confirmation and does not force-close work.

Downloads come only from this repository's GitHub Releases over HTTPS. SHA-256 checksums detect corruption; they are not an independent publisher signature. Archives reject path traversal, links, special files and excessive sizes. An exclusive lock prevents simultaneous updates. The release tree stays under `~/.local/share/familiarmac/releases/VERSION` for helpers that refer to it. The updater is also installed independently of the original checkout.

User dconf preferences are saved before installation and restored afterward, including motion, theme choice and Dock order. Avoid changing desktop preferences while an update is installing. Version registration occurs only after success. A failed update can have applied some files: it reports incomplete rather than claiming rollback or success. Inspect `~/.local/state/familiarmac/releases/install.log` and `transaction.json`; the preference backup and prior release remain available. Retry the update after resolving the failure.

Shared themes/dependencies are updated through `update-portable-system.sh`. Boot/login appearance is refreshed only if the **portable** installer previously recorded `/var/lib/familiarmac/system-appearance/installed`. A machine's legacy custom boot/GDM setup is never adopted by an update. No update initiates a logout, reboot, driver repair or network switch.

## Hardware changes are manual

The distribution excludes the reference-machine repair scripts, and rejects `--full`, `--wifi`, `--brightness` and native binary-patch flags. NVIDIA/Nouveau firmware or driver work, Broadcom repairs, kernel selection, GRUB/KMS/framebuffer changes and gmux changes belong to a separate, deliberate hardware diagnosis. They remain in the source repository for maintainers, **not as install/update steps**. See [installation boundaries](INSTALL.md), and the relevant script's hardware guards. Never run a reference-machine recipe just because the computer is a Mac.

## Publish

1. Update `VERSION` and write `docs/releases/vX.Y.Z.md`.
2. Run `NODE=node bash tests/run.sh` and review changes.
3. Commit all intended portable changes and push main.
4. Pushing a VERSION change to main triggers the Release workflow; it creates the matching `vX.Y.Z` tag. Tag-triggered publication is also supported.
5. The Release workflow tests, packages, creates a draft with assets, then publishes. If it fails, fix the failure before publication; never move an already published version tag.

The package builder uses Git-tracked paths only and skips screenshots, tests and hardware repair scripts. Personal configurations, credentials and the live machine's state are never collected. No GitHub credentials are needed by users for public update checks.
