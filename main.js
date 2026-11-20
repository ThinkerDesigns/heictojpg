const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const archiver = require('archiver');
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
  let skipped = 0;
  const wanted = SOURCE_EXTENSIONS[mode];
  const skippedExtensions = mode === 'heic-to-jpg' ? new Set(['.jpg', '.jpeg']) : new Set(['.heic', '.heif']);
  const hasSingleFolder = inputPaths.length === 1 && (await fs.stat(inputPaths[0])).isDirectory();

  async function visit(target, archiveRoot = '') {
    const info = await fs.stat(target);
    if (info.isFile()) {
      if (wanted.has(path.extname(target).toLowerCase())) files.push(target);
      if (skippedExtensions.has(path.extname(target).toLowerCase())) skipped += 1;
      return;
    }

    if (info.isDirectory()) {
      const entries = await fs.readdir(target, { withFileTypes: true });
      for (const entry of entries) await visit(path.join(target, entry.name), archiveRoot);
    }
  }

  for (const inputPath of inputPaths) await visit(inputPath);
  return { files, skipped, hasFolder: inputPaths.some((inputPath) => fsSync.statSync(inputPath).isDirectory()), hasSingleFolder };
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

async function createZip(sourceFolder, destinationPath) {
  await new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(destinationPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceFolder, false);
    archive.finalize();
  });
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

  const collection = await collectFiles(inputPaths, mode);
  if (!collection.files.length) return { converted: 0, skipped: collection.skipped };

  const isFolderBatch = collection.hasFolder;
  const workingFolder = isFolderBatch ? await fs.mkdtemp(path.join(os.tmpdir(), 'switchback-')) : outputPath;
  await fs.mkdir(workingFolder, { recursive: true });

  let converted = 0;
  try {
    for (const inputPath of collection.files) {
      const destinationPath = await uniqueDestination(workingFolder, outputName(inputPath, mode));
      if (isFolderBatch) {
        await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      }
    await convertOne(inputPath, destinationPath, mode);
    converted += 1;
      event.sender.send('conversion-progress', { converted, total: collection.files.length, name: path.basename(inputPath) });
    }

    if (!isFolderBatch) return { converted, skipped: collection.skipped };

    const downloadsFolder = app.getPath('downloads');
    await fs.mkdir(downloadsFolder, { recursive: true });
    const archiveName = await uniqueDestination(downloadsFolder, `${path.basename(inputPaths[0])}-converted.zip`);
    await createZip(workingFolder, archiveName);
    return { converted, skipped: collection.skipped, archiveName: path.basename(archiveName) };
  } finally {
    if (isFolderBatch) await fs.rm(workingFolder, { recursive: true, force: true });
  }
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
