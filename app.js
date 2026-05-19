// ===== Lucide Icons =====
lucide.createIcons();

// ===== Constants =====
const CANVAS_W = 370;
const CANVAS_H = 320;
const MARGIN   = 10;
const MAX_W    = CANVAS_W - MARGIN * 2; // 350
const MAX_H    = CANVAS_H - MARGIN * 2; // 300

// ===== DOM References =====
const DOM = {
  fileInput:         document.getElementById('file-input'),
  dropZone:          document.getElementById('drop-zone'),
  errorMsg:          document.getElementById('error-msg'),
  errorText:         document.getElementById('error-text'),
  statusArea:        document.getElementById('status-area'),
  statusIconLoader:  document.getElementById('status-icon-loader'),
  statusText:        document.getElementById('status-text'),
  zipBtn:            document.getElementById('zip-btn'),
  resultGrid:        document.getElementById('result-grid'),
  resetBtn:          document.getElementById('reset-btn'),
  actionsGroup:      document.getElementById('actions-group'),
};

// ===== State =====
// items: { id, blob, previewUrl, name, sizeLabel }
let items = [];
let selectedPreviews = []; // アップロード元画像のプレビュー用URL

// ===== Utilities =====
function toEven(n) {
  const f = Math.floor(n);
  return f % 2 === 0 ? f : f - 1;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024)           return bytes + ' B';
  if (bytes < 1024 * 1024)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function getFormattedDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// ===== Selected Files Preview =====
function showSelectedPreviews(files) {
  selectedPreviews.forEach(u => URL.revokeObjectURL(u));
  selectedPreviews = [];

  const container = document.getElementById('selected-preview');
  container.innerHTML = '';

  if (!files || files.length === 0) {
    container.classList.add('hidden');
    return;
  }

  Array.from(files).forEach(file => {
    const url = URL.createObjectURL(file);
    selectedPreviews.push(url);
    const img = document.createElement('img');
    img.src = url;
    img.alt = file.name;
    img.className = 'preview-thumb';
    container.appendChild(img);
  });

  container.classList.remove('hidden');
}

// ===== Error Helpers =====
function showError(msg) {
  DOM.errorText.textContent = msg;
  DOM.errorMsg.classList.remove('hidden');
}
function clearError() {
  DOM.errorMsg.classList.add('hidden');
}

// ===== Canvas Processing =====
function processFileToBlob(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let drawW, drawH;
      if (img.naturalWidth <= MAX_W && img.naturalHeight <= MAX_H) {
        drawW = img.naturalWidth;
        drawH = img.naturalHeight;
      } else {
        const scale = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
        drawW = img.naturalWidth  * scale;
        drawH = img.naturalHeight * scale;
      }

      drawW = toEven(drawW);
      drawH = toEven(drawH);
      const drawX = toEven((CANVAS_W - drawW) / 2);
      const drawY = toEven((CANVAS_H - drawH) / 2);

      const canvas = document.createElement('canvas');
      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Blob creation failed')); return; }
        resolve(blob);
      }, 'image/png');
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load error')); };
    img.src = objectUrl;
  });
}

// ===== Render Results =====
function renderResults() {
  if (items.length === 0) {
    DOM.statusArea.classList.add('hidden');
    DOM.zipBtn.classList.add('hidden');
    DOM.resultGrid.classList.add('hidden');
    DOM.resultGrid.innerHTML = '';
    DOM.actionsGroup.classList.add('hidden');
    return;
  }

  DOM.statusArea.classList.add('hidden');
  DOM.zipBtn.classList.remove('hidden');
  DOM.resultGrid.classList.remove('hidden');
  DOM.actionsGroup.classList.remove('hidden');
  DOM.resultGrid.innerHTML = '';

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `
      <div class="result-thumb">
        <img src="${item.previewUrl}" alt="${item.name}" />
      </div>
      <button class="btn-item-dl">
        <i data-lucide="download"></i> 保存
      </button>
    `;

    div.querySelector('.btn-item-dl').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href     = item.previewUrl;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

    DOM.resultGrid.appendChild(div);
  });

  lucide.createIcons();
}

// ===== Handle Files =====
async function handleFiles(files) {
  clearError();

  const allFiles   = Array.from(files);
  const imageFiles = allFiles.filter(f => f.type.startsWith('image/'));
  const nonImages  = allFiles.filter(f => !f.type.startsWith('image/'));

  if (nonImages.length > 0) {
    showError('画像以外のファイルが読み込まれています。画像を選択してください。');
    if (imageFiles.length === 0) return;
  }

  // 選択画像のプレビューを即時表示
  showSelectedPreviews(imageFiles);

  // ローディング表示
  DOM.statusArea.classList.remove('hidden');
  DOM.statusIconLoader.classList.remove('hidden');
  DOM.statusText.textContent = `変換中... (0 / ${imageFiles.length})`;
  DOM.zipBtn.classList.add('hidden');
  DOM.resultGrid.classList.add('hidden');

  let processed = 0;

  for (const file of imageFiles) {
    try {
      const blob       = await processFileToBlob(file);
      const previewUrl = URL.createObjectURL(blob);
      const baseName   = file.name.replace(/\.[^.]+$/, '');
      const name       = `${baseName}_resized.png`;
      const sizeLabel  = formatBytes(blob.size);
      const id         = Math.random().toString(36).substr(2, 9);

      items.push({ id, blob, previewUrl, name, sizeLabel });
      processed++;
      DOM.statusText.textContent = `変換中... (${processed} / ${imageFiles.length})`;
    } catch (e) {
      console.error('処理エラー:', e);
    }
  }

  renderResults();
}

// ===== ZIP Download =====
DOM.zipBtn.addEventListener('click', async () => {
  if (items.length === 0) return;

  const origHTML    = DOM.zipBtn.innerHTML;
  DOM.zipBtn.disabled  = true;
  DOM.zipBtn.innerHTML = '<i data-lucide="loader" class="icon-sm animate-spin"></i> 処理中...';
  lucide.createIcons();

  const zip     = new JSZip();
  const dateStr = getFormattedDate();
  items.forEach(item => zip.file(item.name, item.blob));

  const content = await zip.generateAsync({ type: 'blob' });
  const url     = URL.createObjectURL(content);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `resized_${dateStr}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  DOM.zipBtn.disabled  = false;
  DOM.zipBtn.innerHTML = origHTML;
  lucide.createIcons();
});

// ===== Reset =====
DOM.resetBtn.addEventListener('click', () => {
  items.forEach(item => URL.revokeObjectURL(item.previewUrl));
  items = [];
  // 選択プレビューもクリア
  selectedPreviews.forEach(u => URL.revokeObjectURL(u));
  selectedPreviews = [];
  const previewEl = document.getElementById('selected-preview');
  previewEl.innerHTML = '';
  previewEl.classList.add('hidden');
  DOM.fileInput.value = '';
  clearError();
  renderResults();
});

// ===== File Input =====
DOM.fileInput.addEventListener('change', e => {
  if (e.target.files && e.target.files.length > 0) {
    handleFiles(e.target.files);
    DOM.fileInput.value = '';
  }
});

// ===== Drop Zone =====
DOM.dropZone.addEventListener('click', () => DOM.fileInput.click());

DOM.dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  DOM.dropZone.classList.add('dragging');
});
DOM.dropZone.addEventListener('dragleave', () => {
  DOM.dropZone.classList.remove('dragging');
});
DOM.dropZone.addEventListener('drop', e => {
  e.preventDefault();
  DOM.dropZone.classList.remove('dragging');
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    handleFiles(e.dataTransfer.files);
  }
});
