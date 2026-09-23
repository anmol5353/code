import './style.css';

type UploadState = 'queued' | 'uploading' | 'done' | 'error';
type UploadItem = { file: File; state: UploadState; progress: number; error?: string };

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const savedClientId = localStorage.getItem('dropdeck-client-id') ?? '';
let accessToken = '';
let clientId = savedClientId;
let items: UploadItem[] = [];
let isUploading = false;

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Dropdeck home"><span class="brand-mark">D</span><span>dropdeck</span></a>
      <div class="status" id="auth-status"><span class="status-dot"></span><span>Not connected</span></div>
    </header>

    <section class="intro">
      <p class="eyebrow">GOOGLE DRIVE / BULK TRANSFER</p>
      <h1>Move a whole folder.<br><em>One calm batch at a time.</em></h1>
      <p class="lede">Dropdeck keeps large folder migrations moving with resumable uploads, small batches, and a clear retry queue.</p>
    </section>

    <section class="workspace">
      <div class="main-column">
        <div class="dropzone" id="dropzone">
          <input id="folder-input" type="file" webkitdirectory directory multiple hidden />
          <div class="drop-icon">↥</div>
          <h2>Choose a folder to begin</h2>
          <p>We’ll preserve the folder structure inside your Drive destination.</p>
          <button class="button button-dark" id="choose-button">Select folder</button>
          <span class="hint">Nothing leaves your browser until you start the upload.</span>
        </div>
        <div class="queue-header"><div><span class="eyebrow">TRANSFER QUEUE</span><h2 id="queue-title">No files selected</h2></div><button class="text-button" id="clear-button" hidden>Clear all</button></div>
        <div class="queue" id="queue"><div class="empty-queue">Your selected files will appear here.</div></div>
      </div>
      <aside class="side-column">
        <div class="panel connect-panel">
          <div class="panel-heading"><span class="panel-number">01</span><h3>Connect Drive</h3></div>
          <label>Google OAuth client ID<input id="client-id" type="text" placeholder="1234567890-abc.apps.googleusercontent.com" value="${escapeHtml(clientId)}" /></label>
          <button class="button button-outline" id="connect-button">Connect Google Drive</button>
          <p class="microcopy">Create a Web application OAuth client in Google Cloud. Add <strong>http://localhost:5173</strong> as an allowed origin.</p>
        </div>
        <div class="panel settings-panel">
          <div class="panel-heading"><span class="panel-number">02</span><h3>Batch settings</h3></div>
          <label>Files per batch<div class="stepper"><button id="decrease" aria-label="Decrease batch size">−</button><input id="batch-size" type="number" min="1" max="100" value="10" /><button id="increase" aria-label="Increase batch size">+</button></div></label>
          <label>Drive folder ID <span class="optional">optional</span><input id="folder-id" type="text" placeholder="Upload to My Drive if blank" /></label>
          <div class="setting-note"><span>↻</span><span>Failed files can be retried individually after a batch finishes.</span></div>
        </div>
        <button class="button button-accent upload-button" id="upload-button" disabled><span>Start upload</span><span>→</span></button>
        <p class="privacy"><span>▣</span> Files go directly from your browser to Google Drive.</p>
      </aside>
    </section>
  </main>
  <div class="toast" id="toast" role="status"></div>
`;

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const folderInput = $('#folder-input') as HTMLInputElement;
const dropzone = $('#dropzone');
const queue = $('#queue');
const uploadButton = $('#upload-button') as HTMLButtonElement;
const connectButton = $('#connect-button') as HTMLButtonElement;
const batchInput = $('#batch-size') as HTMLInputElement;
const toastElement = $('#toast');

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]!)); }
function formatBytes(bytes: number): string { if (bytes < 1024) return `${bytes} B`; const units = ['KB', 'MB', 'GB', 'TB']; let size = bytes / 1024; let index = 0; while (size >= 1024 && index < units.length - 1) { size /= 1024; index++; } return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`; }
function showToast(message: string, tone: 'normal' | 'error' = 'normal') { toastElement.textContent = message; toastElement.className = `toast visible ${tone}`; window.setTimeout(() => toastElement.className = 'toast', 3500); }
function chunks<T>(values: T[], size: number): T[][] { const result: T[][] = []; for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size)); return result; }

function renderQueue() {
  const total = items.length;
  const completed = items.filter((item) => item.state === 'done').length;
  $('#queue-title').textContent = total ? `${completed} of ${total} files ready` : 'No files selected';
  $('#clear-button').toggleAttribute('hidden', total === 0 || isUploading);
  uploadButton.disabled = total === 0 || isUploading || !accessToken;
  if (!total) { queue.innerHTML = '<div class="empty-queue">Your selected files will appear here.</div>'; return; }
  queue.innerHTML = items.map((item, index) => `
    <div class="file-row ${item.state}" data-index="${index}">
      <div class="file-icon">${item.file.name.split('.').pop()?.slice(0, 3).toUpperCase() ?? 'FILE'}</div>
      <div class="file-info"><strong>${escapeHtml(item.file.name)}</strong><span>${formatBytes(item.file.size)}${item.error ? ` · ${escapeHtml(item.error)}` : ''}</span></div>
      <div class="file-state">${item.state === 'done' ? 'Done' : item.state === 'uploading' ? `${item.progress}%` : item.state === 'error' ? 'Retry' : 'Queued'}</div>
      <div class="progress-track"><div style="width:${item.progress}%"></div></div>
    </div>`).join('');
  queue.querySelectorAll<HTMLElement>('.file-row.error').forEach((row) => row.addEventListener('click', () => retry(Number(row.dataset.index))));
}

function setFiles(fileList: FileList | File[]) {
  const files = Array.from(fileList).filter((file) => file.size > 0);
  items = files.map((file) => ({ file, state: 'queued', progress: 0 }));
  renderQueue();
  if (files.length) showToast(`${files.length} files added to the queue.`);
}

folderInput.addEventListener('change', () => { if (folderInput.files) setFiles(folderInput.files); });
$('#choose-button').addEventListener('click', () => folderInput.click());
$('#clear-button').addEventListener('click', () => { items = []; renderQueue(); });
['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => { event.preventDefault(); dropzone.classList.remove('dragging'); }));
dropzone.addEventListener('drop', (event) => { const files = (event as DragEvent).dataTransfer?.files; if (files?.length) setFiles(files); });
$('#decrease').addEventListener('click', () => { batchInput.value = String(Math.max(1, Number(batchInput.value) - 1)); });
$('#increase').addEventListener('click', () => { batchInput.value = String(Math.min(100, Number(batchInput.value) + 1)); });

function updateAuthStatus(connected: boolean) { $('#auth-status').innerHTML = connected ? '<span class="status-dot connected"></span><span>Drive connected</span>' : '<span class="status-dot"></span><span>Not connected</span>'; connectButton.textContent = connected ? 'Connected to Google Drive' : 'Connect Google Drive'; renderQueue(); }

connectButton.addEventListener('click', () => {
  clientId = ($('#client-id') as HTMLInputElement).value.trim();
  if (!clientId) { showToast('Add your Google OAuth client ID first.', 'error'); return; }
  localStorage.setItem('dropdeck-client-id', clientId);
  const callback = (response: { access_token?: string; error?: string }) => { if (response.access_token) { accessToken = response.access_token; updateAuthStatus(true); showToast('Google Drive is connected.'); } else showToast(response.error ?? 'Could not connect to Google Drive.', 'error'); };
  const google = (window as Window & { google?: { accounts: { oauth2: { initTokenClient: (config: { client_id: string; scope: string; callback: typeof callback }) => { requestAccessToken: () => void } } } } }).google;
  if (google) google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: DRIVE_SCOPE, callback }).requestAccessToken();
  else showToast('Google sign-in is still loading. Try again in a moment.', 'error');
});

async function uploadFile(item: UploadItem, parentId: string) {
  item.state = 'uploading'; item.progress = 0; renderQueue();
  const metadata = { name: item.file.name, ...(parentId ? { parents: [parentId] } : {}) };
  const initResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': item.file.type || 'application/octet-stream', 'X-Upload-Content-Length': String(item.file.size) }, body: JSON.stringify(metadata) });
  if (!initResponse.ok) throw new Error(`Drive rejected ${initResponse.status}`);
  const location = initResponse.headers.get('Location');
  if (!location) throw new Error('Drive did not return an upload URL');
  const response = await fetch(location, { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': item.file.type || 'application/octet-stream' }, body: item.file });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  item.progress = 100; item.state = 'done'; renderQueue();
}

async function uploadWithRetry(item: UploadItem, parentId: string) { for (let attempt = 0; attempt < 3; attempt++) { try { await uploadFile(item, parentId); return; } catch (error) { if (attempt === 2) { item.state = 'error'; item.error = error instanceof Error ? error.message : 'Upload failed'; item.progress = 0; renderQueue(); } else await new Promise((resolve) => window.setTimeout(resolve, 750 * (attempt + 1))); } } }
async function startUpload() {
  if (!accessToken || !items.length) return;
  isUploading = true; renderQueue();
  const parentId = ($('#folder-id') as HTMLInputElement).value.trim();
  const batchSize = Math.max(1, Math.min(100, Number(batchInput.value) || 10));
  const pending = items.filter((item) => item.state !== 'done');
  for (const batch of chunks(pending, batchSize)) { showToast(`Uploading batch ${Math.ceil((pending.indexOf(batch[0]) + 1) / batchSize)} of ${Math.ceil(pending.length / batchSize)}...`); await Promise.all(batch.map((item) => uploadWithRetry(item, parentId))); }
  isUploading = false; renderQueue();
  const failed = items.filter((item) => item.state === 'error').length;
  showToast(failed ? `${failed} files need attention. Click a failed row to retry.` : 'All files are safely in Google Drive.');
}
function retry(index: number) { if (!accessToken || isUploading) return; items[index].state = 'queued'; items[index].error = undefined; renderQueue(); void uploadWithRetry(items[index], ($('#folder-id') as HTMLInputElement).value.trim()); }
uploadButton.addEventListener('click', () => void startUpload());

const googleScript = document.createElement('script'); googleScript.src = 'https://accounts.google.com/gsi/client'; googleScript.async = true; googleScript.defer = true; document.head.appendChild(googleScript);
renderQueue();
