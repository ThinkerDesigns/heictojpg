# Switchback

Switchback is a little desktop app for the annoying gap between **HEIC** and **JPEG**. Drop in a few files, point it at a folder, or mix the two. It converts locally, so your photos do not make a round trip through somebody else’s server.

It runs on macOS and Windows, and it is deliberately small: no account, no upload queue, no settings panel you have to learn before you can get on with your day.

## What it can do

- Convert HEIC/HEIF files to JPG.
- Convert JPG/JPEG files to HEIC.
- Take individual files, folders, or a mixture of both.
- Search inside selected folders recursively.
- Keep each run local to your computer.
- Write results to a folder you choose, without overwriting existing files.

## Try it locally

You need Node.js 20+ installed.

```bash
npm install
npm start
```

The first launch may take a moment while Electron opens the window. Pick your source files, choose a direction, pick an output folder, and hit **Convert images**.

## Build an installer

Run these from the project folder:

```bash
# macOS (.dmg)
npm run dist:mac

# Windows x64 installer (.exe)
npm run dist:win
```

The finished installers land in `dist/`. You need to build each installer on its target operating system (or set up the relevant Electron Builder signing and cross-build tooling). The app itself is the same on both platforms.

## Host the browser version

The Apache-ready web version lives in [`web/`](web/). Copy that folder into an Apache document root or a subfolder on your site. It needs no Node process, PHP, or build step. HEIC conversion runs in the browser. See [`web/README.md`](web/README.md) for setup details.

## A note on HEIC

HEIC input is handled by `heic-convert`. For JPEG-to-HEIC output, the app uses the bundled encoder when it is available, falls back to macOS `sips`, and looks for ImageMagick’s `magick` command on Windows. If your Windows build says HEIC encoding is unavailable, install ImageMagick and relaunch the app.

If a particular camera’s HEIC variant is unusual, the app will stop on that file and show the error rather than silently producing a bad image.

## Project shape

This is intentionally a plain Electron app instead of a large frontend stack:

- `main.js` owns native dialogs, filesystem access, and conversion work.
- `preload.js` exposes a narrow bridge to the browser window.
- `renderer/` contains the UI and its styles.

That split makes it easier to audit what can touch the filesystem and keeps the interface quick even when a batch is running.

## License

MIT. See [LICENSE](LICENSE) if you need the formal text.
