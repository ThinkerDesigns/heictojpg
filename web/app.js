const state = { files: [], mode: 'heic-to-jpg' };
const $ = (selector) => document.querySelector(selector);
const fileInput = $('#file-input');
const folderInput = $('#folder-input');
const selectionCount = $('#selection-count');
const convertButton = $('#convert-button');
const progressPanel = $('#progress-panel');
const toast = $('#toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 3600);
}

function refresh() {
  selectionCount.textContent = state.files.length ? `${state.files.length} item${state.files.length === 1 ? '' : 's'} selected` : 'Nothing selected';
  convertButton.disabled = !state.files.length || state.mode !== 'heic-to-jpg';
}

function addFiles(files) {
  const known = new Set(state.files.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
  for (const file of files) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!known.has(key)) { state.files.push(file); known.add(key); }
  }
  refresh();
}

fileInput.addEventListener('change', () => addFiles([...fileInput.files]));
folderInput.addEventListener('change', () => addFiles([...folderInput.files]));

const dropZone = $('#drop-zone');
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
dropZone.addEventListener('drop', (event) => addFiles([...event.dataTransfer.files]));

document.querySelectorAll('.direction-option').forEach((button) => button.addEventListener('click', () => {
  state.mode = button.dataset.mode;
  document.querySelectorAll('.direction-option').forEach((option) => option.classList.toggle('is-active', option === button));
  if (state.mode === 'jpg-to-heic') showToast('JPG → HEIC is available in the desktop app, where a native HEIC encoder can run.');
  refresh();
}));

function loadHeicDecoder() {
  if (window.heic2any) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('The browser converter could not load. Check your connection and try again.'));
    document.head.appendChild(script);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

convertButton.addEventListener('click', async () => {
  if (state.mode !== 'heic-to-jpg') return;
  progressPanel.classList.remove('is-hidden');
  convertButton.disabled = true;
  $('#progress-title').textContent = 'Making share-ready JPGs';
  try {
    await loadHeicDecoder();
    const matching = state.files.filter((file) => ['.heic', '.heif'].includes(file.name.slice(file.name.lastIndexOf('.')).toLowerCase()));
    let converted = 0;
    for (const file of matching) {
      $('#progress-file').textContent = file.name;
      const result = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      const blob = Array.isArray(result) ? result[0] : result;
      const filename = `${file.name.replace(/\.(heic|heif)$/i, '')}.jpg`;
      downloadBlob(blob, filename);
      converted += 1;
      $('#progress-count').textContent = `${converted} / ${matching.length}`;
      $('#progress-fill').style.width = `${Math.round((converted / matching.length) * 100)}%`;
    }
    $('#progress-file').textContent = converted ? 'Done. Files were sent to Downloads.' : 'No HEIC or HEIF files found in the selection.';
    showToast(converted ? `${converted} JPG download${converted === 1 ? '' : 's'} started.` : 'No HEIC or HEIF files found.');
  } catch (error) {
    $('#progress-file').textContent = error.message;
    showToast(error.message);
  } finally {
    refresh();
  }
});

refresh();
