const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const heicConvert = require('heic-convert');
const sharp = require('sharp');
const execFileAsync = promisify(execFile);

const SOURCE_EXTENSIONS = {
  'heic-to-jpg': new Set(['.heic', '.heif']),
  'jpg-to-heic': new Set(['.jpg', '.jpeg'])
};

function createWindow() {
  const window = new BrowserWindow({
    width: 1160,
    height: 820,
    minWidth: 860,
    minHeight: 680,
    backgroundColor: '#111412',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

async function collectFiles(inputPaths, mode) {
  const files = [];
  const wanted = SOURCE_EXTENSIONS[mode];

  async function visit(target) {
    const info = await fs.stat(target);
    if (info.isFile()) {
      if (wanted.has(path.extname(target).toLowerCase())) files.push(target);
      return;
    }

    if (info.isDirectory()) {
      const entries = await fs.readdir(target, { withFileTypes: true });
      for (const entry of entries) await visit(path.join(target, entry.name));
    }
  }

  for (const inputPath of inputPaths) await visit(inputPath);
  return files;
}

function outputName(inputPath, mode) {
  const extension = mode === 'heic-to-jpg' ? '.jpg' : '.heic';
  return `${path.basename(inputPath, path.extname(inputPath))}${extension}`;
}

async function uniqueDestination(folder, filename) {
  const parsed = path.parse(filename);
  let candidate = path.join(folder, filename);
  let suffix = 1;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(folder, `${parsed.name}-${suffix}${parsed.ext}`);
      suffix += 1;
    } catch {
      return candidate;
    }
  }
}

async function convertOne(inputPath, destinationPath, mode) {
  if (mode === 'heic-to-jpg') {
    const inputBuffer = await fs.readFile(inputPath);
    const outputBuffer = await heicConvert({ buffer: inputBuffer, format: 'JPEG', quality: 0.92 });
    await fs.writeFile(destinationPath, outputBuffer);
    return;
  }

  try {
    await sharp(inputPath).heif({ compression: 'hevc', quality: 90 }).toFile(destinationPath);
    return;
  } catch (error) {
    if (!/Unsupported compression|heifsave/i.test(error.message)) throw error;
  }

  if (process.platform === 'darwin') {
    await execFileAsync('/usr/bin/sips', ['-s', 'format', 'heic', inputPath, '--out', destinationPath]);
    return;
  }

  try {
    await execFileAsync('magick', [inputPath, destinationPath]);
  } catch {
    throw new Error('HEIC encoding is not available in this build. Install ImageMagick on Windows, or use a build with a HEVC encoder.');
  }
}

ipcMain.handle('choose-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images', extensions: ['heic', 'heif', 'jpg', 'jpeg'] }]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('choose-output', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('convert', async (event, { inputPaths, outputPath, mode }) => {
  if (!Array.isArray(inputPaths) || !inputPaths.length || !outputPath || !SOURCE_EXTENSIONS[mode]) {
    throw new Error('Choose at least one input and an output folder.');
  }

  const files = await collectFiles(inputPaths, mode);
  if (!files.length) return { converted: 0, skipped: 0 };
  await fs.mkdir(outputPath, { recursive: true });

  let converted = 0;
  for (const inputPath of files) {
    const destinationPath = await uniqueDestination(outputPath, outputName(inputPath, mode));
    await convertOne(inputPath, destinationPath, mode);
    converted += 1;
    event.sender.send('conversion-progress', { converted, total: files.length, name: path.basename(inputPath) });
  }

  return { converted, skipped: 0 };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
