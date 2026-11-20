# Switchback web folder

This folder is a static Apache-ready version of Switchback. Copy its contents into a document root or a subfolder such as `/switchback/`.

```text
/var/www/html/switchback/
  index.html
  styles.css
  app.js
```

There is no build step and no server-side code. Apache only needs to serve the three files over HTTPS.

The web edition converts HEIC/HEIF to JPG entirely in the browser and starts downloads for the results. When you select a folder, it skips JPG/JPEG files and downloads the completed batch as one ZIP. Files are not uploaded to your server or a third-party service. JPG → HEIC stays in the desktop app because browsers do not provide a portable HEIC encoder.

The HEIC decoder and folder ZIP library are loaded from jsDelivr the first time a conversion starts. If your site uses a strict Content Security Policy, allow `https://cdn.jsdelivr.net` for scripts, or vendor `heic-to` and `JSZip` locally and change the script URLs in `app.js`.
