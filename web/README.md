# Switchback web folder

This folder is a static Apache-ready version of Switchback. Copy its contents into a document root or a subfolder such as `/switchback/`.

```text
/var/www/html/switchback/
  index.html
  styles.css
  app.js
  convert.php
```

There is no build step. Apache serves the static files, and `convert.php` provides a fast server-side path when PHP and an HEIC-capable converter are available.

The web edition converts HEIC/HEIF to JPG and starts downloads for the results. With `convert.php` enabled, the selected file is uploaded to your own Apache server for conversion and immediately returned; it is not sent to a third-party service. If PHP is unavailable, the page falls back to browser conversion. JPG → HEIC stays in the desktop app because browsers do not provide a portable HEIC encoder.

On macOS, the endpoint can use `/usr/bin/sips`. On Linux, install ImageMagick with HEIC/HEIF support and make sure either `magick` or `convert` is available to Apache’s user.

For camera originals, raise PHP’s upload limits in the Apache PHP configuration (8M is a reasonable starting point):

```ini
upload_max_filesize = 32M
post_max_size = 40M
```

The HEIC decoder is loaded from jsDelivr the first time a conversion starts. If your site uses a strict Content Security Policy, allow `https://cdn.jsdelivr.net` for scripts, or vendor `heic2any` locally and change the script URL in `app.js`.
