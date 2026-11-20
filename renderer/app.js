const state = { inputPaths: [], outputPath: '', mode: 'heic-to-jpg', hasFolder: false };
const $ = (selector) => document.querySelector(selector);
const selectionCount = $('#selection-count');
const outputPath = $('#output-path');
const convertButton = $('#convert-button');
const progressPanel = $('#progress-panel');
const toast = $('#toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3400);
}

function refresh() {
  selectionCount.textContent = state.inputPaths.length ? `${state.inputPaths.length} item${state.inputPaths.length === 1 ? '' : 's'} selected` : 'Nothing selected';
  outputPath.textContent = state.hasFolder ? 'Folder batch → ZIP saved to Downloads' : (state.outputPath || 'Choose an output folder');
  convertButton.disabled = !state.inputPaths.length || (!state.hasFolder && !state.outputPath);
}

function addInputs(paths) {
  state.inputPaths = [...new Set([...state.inputPaths, ...paths])];
  refresh();
}

$('#choose-files').addEventListener('click', async () => addInputs(await window.switchback.chooseFiles()));
$('#choose-folder').addEventListener('click', async () => {
  const folders = await window.switchback.chooseFolder();
  if (folders.length) state.hasFolder = true;
  addInputs(folders);
});
$('#choose-output').addEventListener('click', async () => {
  const folder = await window.switchback.chooseOutput();
  if (folder) { state.outputPath = folder; refresh(); }
});

document.querySelectorAll('.direction-option').forEach((button) => button.addEventListener('click', () => {
  state.mode = button.dataset.mode;
  document.querySelectorAll('.direction-option').forEach((option) => option.classList.toggle('is-active', option === button));
}));

const dropZone = $('#drop-zone');
['dragenter', 'dragover'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.add('is-dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropZone.addEventListener(eventName, (event) => { event.preventDefault(); dropZone.classList.remove('is-dragging'); }));
dropZone.addEventListener('drop', (event) => addInputs([...event.dataTransfer.files].map((file) => file.path).filter(Boolean)));

window.switchback.onProgress(({ converted, total, name }) => {
  $('#progress-count').textContent = `${converted} / ${total}`;
  $('#progress-fill').style.width = `${Math.round((converted / total) * 100)}%`;
  $('#progress-file').textContent = name;
});

convertButton.addEventListener('click', async () => {
  progressPanel.classList.remove('is-hidden');
  convertButton.disabled = true;
  $('#progress-title').textContent = state.mode === 'heic-to-jpg' ? 'Making share-ready JPGs' : 'Making space-saving HEICs';
  $('#progress-count').textContent = 'Starting…';
  try {
    const result = await window.switchback.convert(state);
    $('#progress-count').textContent = `${result.converted} converted`;
    const skippedNote = result.skipped ? ` ${result.skipped} existing image${result.skipped === 1 ? '' : 's'} skipped.` : '';
    $('#progress-file').textContent = result.converted
      ? (result.archiveName ? `Done. ${result.archiveName} is in Downloads.` : 'Done. Your new files are ready.')
      : 'No matching images found in the selection.';
    showToast(result.converted ? `${result.converted} image${result.converted === 1 ? '' : 's'} converted.${skippedNote}` : 'No matching images found.');
  } catch (error) {
    $('#progress-title').textContent = 'That conversion did not finish';
    $('#progress-file').textContent = error.message;
    showToast(error.message);
  } finally {
    refresh();
  }
});

refresh();
