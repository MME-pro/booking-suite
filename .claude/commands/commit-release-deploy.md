---
description: Commit the working tree, publish a GitHub release with the built zip, and get the live site onto it.
---

Ship the current working tree end to end. Run the steps in order and stop at
the first failure — a half-finished release is worse than none, because a tag
with no asset is a release the updater will silently ignore.

## 1. Decide the version

Read the current version from the `Version:` header in `booking_suite.php`.
Bump it unless the user named a version:

- **patch** — fixes and copy only
- **minor** — anything a user would notice as new
- **major** — only when asked

Set it in **both** places, which must always agree: the `Version:` header and
`const VERSION`. The header is what WordPress compares on update; the constant
is what the plugin reports about itself.

## 2. Build

```
npm --prefix frontend/admin/app run build
npm --prefix frontend/site/app run build
php -c <ini> tools/i18n-extract.php
php -c <ini> tools/i18n-build.php
```

The admin bundle is gitignored, so it exists only where it was built. A
release whose zip was made without this step ships a blank admin screen.

Stop if `languages/untranslated.txt` appears — new English strings have no
German. Add them to `languages/de_DE.map.php` and rebuild.

## 3. Commit and push

Stage the real changes, write a message explaining *why* the change was made
rather than restating the diff, and push to `origin`.

Never push while the working tree still has unrelated edits: what gets
released is what is on the branch.

## 4. Release

```
php -c <ini> tools/build-zip.php <output-dir>
php -c <ini> tools/release.php <output-dir>/booking_suite-<version>.zip --notes="..."
```

`build-zip.php` guarantees the two things that have broken installs before: a
top-level folder named exactly `booking_suite`, and forward-slash separators.
`release.php` tags `v<version>`, publishes, and attaches the zip — the asset
is what `Updater` looks for, and a release without one is ignored.

Verify the asset downloads unauthenticated before calling it done.

## 5. Deploy

Sites running a build that already contains `Updater` need nothing: they check
every fifteen minutes and offer the update in wp-admin, and "Check again" on
the Plugins screen fetches immediately.

To push it out now rather than waiting, run this on the target site through
its Novamira MCP server:

```php
BookingSuite\Backend\Support\Updater::check_now();
```

If that server is not connected, say so plainly and report that the site will
pick the release up within fifteen minutes on its own. Do not fall back to
uploading files by hand without asking — the whole point of the pipeline is
that hand-uploading stopped being necessary.

## Report

State the version, the release URL, and for each site whether it is on the new
version yet. If any step was skipped, say which and why.
