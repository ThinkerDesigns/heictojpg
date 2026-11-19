# Switchback web folder

This folder is a static Apache-ready version of Switchback. Copy its contents into a document root or a subfolder such as `/switchback/`.

```text
/var/www/html/switchback/
  index.html
  styles.css
  app.js
```

There is no build step and no server-side code. Apache only needs to serve the three files over HTTPS.

The web edition converts HEIC/HEIF to JPG entirely in the browser and starts downloads for the results. Files are not uploaded to your server or a third-party service. JPG → HEIC stays in the desktop app because browsers do not provide a portable HEIC encoder.

The HEIC decoder is loaded from jsDelivr the first time a conversion starts. If your site uses a strict Content Security Policy, allow `https://cdn.jsdelivr.net` for scripts, or vendor `heic-to` locally and change the script URL in `app.js`.
