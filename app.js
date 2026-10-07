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
// items: { id, blob, previewUrl, name }
let items = [];
let selectedPreviews = []; // アップロード元画像のプレビュー用URL

// ===== Utilities =====
function toEven(n) {
  const f = Math.floor(n);
  return f % 2 === 0 ? f : f - 1;
}

function getFormattedDate() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

// Explicit PNG pHYs metadata: 3780 pixels/metre = approximately 96dpi.
// Add losslessly; do not depend on a browser supplying resolution metadata.
async function withPngResolution(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunk = new Uint8Array(21);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, 9);
  chunk.set([112, 72, 89, 115], 4); // pHYs
  view.setUint32(8, 3780);
  view.setUint32(12, 3780);
  chunk[16] = 1;
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 17)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  view.setUint32(17, (crc ^ 0xffffffff) >>> 0);
  const parts = [bytes.subarray(0, 8)];
  const sourceView = new DataView(bytes.buffer);
  for (let offset = 8; offset < bytes.length;) {
    const end = offset + sourceView.getUint32(offset) + 12;
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type !== 'pHYs') parts.push(bytes.subarray(offset, end));
    if (type === 'IHDR') parts.push(chunk);
    offset = end;
  }
  return new Blob(parts, { type: 'image/png' });
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

    div.addEventListener('click', () => {
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

  // 元のファイル名順（自然順: 1, 2, ... 10）にソート
  imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

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
      const num        = items.length + 1;
      const name       = `${String(num).padStart(2, '0')}.png`;
      const id         = Math.random().toString(36).substr(2, 9);

      items.push({ id, blob, previewUrl, name });
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
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

// ===== Image Type Tabs =====
const toolTabs = Array.from(document.querySelectorAll('[role="tab"]'));
function selectToolTab(tab) {
  toolTabs.forEach(button => {
    const selected = button === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    document.getElementById(button.getAttribute('aria-controls')).hidden = !selected;
  });
}
toolTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectToolTab(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % toolTabs.length;
    if (event.key === 'ArrowLeft') next = (index + toolTabs.length - 1) % toolTabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = toolTabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectToolTab(toolTabs[next]);
    toolTabs[next].focus();
  });
});

// ===== Main Image Editor (independent of sticker conversion) =====
(() => {
  const SIZE = 240;
  const PADDING = 10;
  const INNER_SIZE = SIZE - PADDING * 2;
  const $ = id => document.getElementById(id);
  const canvas = $('main-canvas');
  const context = canvas.getContext('2d');
  const fileInput = $('main-file-input');
  const dropZone = $('main-drop-zone');
  const list = $('main-image-list');
  const previews = $('main-selected-preview');
  const controls = $('main-image-controls');
  const sizeInput = $('main-size');
  const downloadButton = $('main-download');
  const resetButton = $('main-reset');
  const error = $('main-error');
  const layers = [];
  let selectedId = null;
  let nextId = 1;
  let drag = null;
  let pendingImports = 0;
  let exporting = false;
  let importQueue = Promise.resolve();
  let showCenterGuide = false;
  let guideTimeout = null;

  const selectedLayer = () => layers.find(layer => layer.id === selectedId);
  function showMainError(message) {
    error.textContent = message;
    error.classList.toggle('hidden', !message);
  }
  function clampPosition(layer) {
    layer.x = Math.max(0, Math.min(SIZE - layer.width, layer.x));
    layer.y = Math.max(0, Math.min(SIZE - layer.height, layer.y));
  }
  function updateDownloadButton() {
    const hasLayers = layers.length > 0;
    downloadButton.disabled = !hasLayers || pendingImports > 0 || exporting;
    resetButton.disabled = !hasLayers || pendingImports > 0 || exporting;
  }
  function drawLayers(ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Keep the prescribed transparent margin even at fractional coordinates.
    ctx.save();
    ctx.beginPath();
    ctx.rect(PADDING, PADDING, INNER_SIZE, INNER_SIZE);
    ctx.clip();
    layers.forEach(layer => ctx.drawImage(layer.image, layer.x, layer.y, layer.width, layer.height));
    ctx.restore();
  }
  function drawEditor() {
    const ratio = canvas.width / SIZE;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, SIZE, SIZE);
    drawLayers(context);
    context.save();
    context.strokeStyle = '#007562';
    context.lineWidth = 0.5;
    context.setLineDash([3, 3]);
    context.strokeRect(PADDING, PADDING, INNER_SIZE, INNER_SIZE);
    const layer = selectedLayer();
    if (layer) {
      context.setLineDash([]);
      context.lineWidth = 1;
      context.strokeRect(layer.x, layer.y, layer.width, layer.height);
      const handleSize = 12 * canvasUnitsPerPixel();
      context.fillStyle = '#ffffff';
      for (const corner of resizeCorners(layer)) {
        context.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
        context.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
      }
    }
    // 移動中の中央ガイド線（垂直・水平 赤2px）
    if (showCenterGuide) {
      context.setLineDash([]);
      context.strokeStyle = '#ff3b30';
      context.lineWidth = 2 * canvasUnitsPerPixel();
      const mid = SIZE / 2;
      context.beginPath();
      context.moveTo(mid, 0);
      context.lineTo(mid, SIZE);
      context.stroke();
      context.beginPath();
      context.moveTo(0, mid);
      context.lineTo(SIZE, mid);
      context.stroke();
    }
    context.restore();
  }
  function syncSelection() {
    const layer = selectedLayer();
    controls.disabled = !layer;
    $('main-selected-name').textContent = layer ? layer.name : '画像が選択されていません';
    $('main-size-value').textContent = layer ? `${Math.round(Math.max(layer.width, layer.height))} px` : '—';
    if (layer) sizeInput.value = Math.round(Math.max(layer.width, layer.height));
    list.querySelectorAll('.main-image-select').forEach(button => {
      const selected = Number(button.dataset.layerId) === selectedId;
      button.setAttribute('aria-pressed', String(selected));
      button.parentElement.classList.toggle('is-selected', selected);
      button.parentElement.querySelector('.main-image-remove').hidden = !selected;
    });
    drawEditor();
  }
  function renderLayerList() {
    list.replaceChildren();
    previews.replaceChildren();
    layers.forEach(layer => {
      const item = document.createElement('li');
      item.className = 'main-image-row';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'main-image-select';
      button.dataset.layerId = layer.id;
      button.setAttribute('aria-label', `${layer.name}を選択`);
      const thumbnail = document.createElement('img');
      thumbnail.src = layer.url;
      thumbnail.alt = '';
      thumbnail.width = 48;
      thumbnail.height = 48;
      thumbnail.loading = 'lazy';
      const name = document.createElement('span');
      name.textContent = layer.name;
      button.append(thumbnail, name);
      button.addEventListener('click', () => {
        selectedId = layer.id;
        syncSelection();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'main-image-remove';
      remove.textContent = '削除';
      remove.setAttribute('aria-label', `${layer.name}を削除`);
      remove.addEventListener('click', () => removeLayer(layer.id));
      item.append(button, remove);
      list.append(item);
      const preview = document.createElement('img');
      preview.src = layer.url;
      preview.alt = layer.name;
      preview.title = layer.name;
      preview.className = 'preview-thumb';
      preview.draggable = false;
      previews.append(preview);
    });
    previews.classList.toggle('hidden', !layers.length);
    $('main-empty').hidden = layers.length > 0;
    updateDownloadButton();
    syncSelection();
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ image, url });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像を読み込めませんでした。'));
      };
      image.src = url;
    });
  }
  function addFiles(files) {
    const batch = Array.from(files);
    if (!batch.length) return;
    pendingImports++;
    updateDownloadButton();
    importQueue = importQueue.then(async () => {
      showMainError('');
      const failed = [];
      for (const [index, file] of batch.entries()) {
        $('main-load-status').textContent = `画像を読み込み中… ${index + 1} / ${batch.length}`;
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
          failed.push(file.name);
          continue;
        }
        try {
          const { image, url } = await loadImage(file);
          const scale = Math.min(1, INNER_SIZE / image.naturalWidth, INNER_SIZE / image.naturalHeight);
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          const layer = { id: nextId++, name: file.name, image, url, width, height, x: (SIZE - width) / 2, y: (SIZE - height) / 2 };
          layers.push(layer);
          selectedId = layer.id;
          renderLayerList();
        } catch {
          failed.push(file.name);
        }
      }
      if (failed.length) {
        showMainError(`読み込めない画像があります（${failed.join('、')}）。対応形式でないか、ファイルが破損しています。開けるPNG・JPG画像を選び直してください。`);
      }
      $('main-load-status').textContent = '';
    }).finally(() => {
      pendingImports--;
      updateDownloadButton();
    });
  }
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
    if (event.dataTransfer) addFiles(event.dataTransfer.files);
  });

  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * SIZE / bounds.width, y: (event.clientY - bounds.top) * SIZE / bounds.height };
  }
  function canvasUnitsPerPixel() {
    return SIZE / (canvas.getBoundingClientRect().width || 480);
  }
  function resizeCorners(layer) {
    return [
      { x: layer.x, y: layer.y, sx: -1, sy: -1 },
      { x: layer.x + layer.width, y: layer.y, sx: 1, sy: -1 },
      { x: layer.x, y: layer.y + layer.height, sx: -1, sy: 1 },
      { x: layer.x + layer.width, y: layer.y + layer.height, sx: 1, sy: 1 },
    ];
  }
  function hitResizeHandle(point, pointerType) {
    const layer = selectedLayer();
    if (!layer) return null;
    const radius = (pointerType === 'touch' ? 18 : 10) * canvasUnitsPerPixel();
    return resizeCorners(layer)
      .map(corner => ({ ...corner, distance: Math.hypot(point.x - corner.x, point.y - corner.y) }))
      .filter(corner => corner.distance <= radius)
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }
  function setResizeCursor(corner) {
    canvas.classList.toggle('is-resize-nwse', !!corner && corner.sx === corner.sy);
    canvas.classList.toggle('is-resize-nesw', !!corner && corner.sx !== corner.sy);
  }
  function stopDrag() {
    const pointerId = drag?.pointerId;
    drag = null;
    showCenterGuide = false;
    if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    canvas.classList.remove('is-dragging');
    setResizeCursor(null);
    drawEditor();
  }
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const point = canvasPoint(event);
    // The list also allows selecting an image hidden beneath another image.
    const current = selectedLayer();
    const corner = hitResizeHandle(point, event.pointerType);
    const contains = layer => point.x >= layer.x && point.x <= layer.x + layer.width && point.y >= layer.y && point.y <= layer.y + layer.height;
    const layer = corner || (current && contains(current)) ? current : [...layers].reverse().find(contains);
    selectedId = layer ? layer.id : null;
    canvas.focus({ preventScroll: true });
    syncSelection();
    if (!layer) return;
    drag = { pointerId: event.pointerId, layer, start: point, x: layer.x, y: layer.y, width: layer.width, height: layer.height, corner };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.toggle('is-dragging', !corner);
    setResizeCursor(corner);
  });
  canvas.addEventListener('pointermove', event => {
    const point = canvasPoint(event);
    if (!drag) {
      setResizeCursor(hitResizeHandle(point, event.pointerType));
      return;
    }
    if (event.pointerId !== drag.pointerId) return;
    if (drag.corner) {
      // Keep the opposite corner fixed and project the pointer movement onto
      // the image diagonal so the original aspect ratio cannot be distorted.
      const { sx, sy } = drag.corner;
      const anchorX = drag.x + (sx < 0 ? drag.width : 0);
      const anchorY = drag.y + (sy < 0 ? drag.height : 0);
      const dx = (point.x - drag.start.x) * sx;
      const dy = (point.y - drag.start.y) * sy;
      const requested = 1 + (dx * drag.width + dy * drag.height) / (drag.width ** 2 + drag.height ** 2);
      const maxWidth = sx > 0 ? SIZE - anchorX : anchorX;
      const maxHeight = sy > 0 ? SIZE - anchorY : anchorY;
      const minScale = 1 / Math.max(drag.width, drag.height);
      const maxScale = Math.min(maxWidth / drag.width, maxHeight / drag.height);
      const scale = Math.max(minScale, Math.min(maxScale, requested));
      drag.layer.width = drag.width * scale;
      drag.layer.height = drag.height * scale;
      drag.layer.x = anchorX - (sx < 0 ? drag.layer.width : 0);
      drag.layer.y = anchorY - (sy < 0 ? drag.layer.height : 0);
      showCenterGuide = true;
      syncSelection();
    } else {
      drag.layer.x = drag.x + point.x - drag.start.x;
      drag.layer.y = drag.y + point.y - drag.start.y;
      const mid = SIZE / 2;
      const SNAP = 4;
      const centerX = drag.layer.x + drag.layer.width / 2;
      const centerY = drag.layer.y + drag.layer.height / 2;
      if (Math.abs(centerX - mid) <= SNAP) {
        drag.layer.x = mid - drag.layer.width / 2;
      }
      if (Math.abs(centerY - mid) <= SNAP) {
        drag.layer.y = mid - drag.layer.height / 2;
      }
      clampPosition(drag.layer);
      showCenterGuide = true;
      drawEditor();
    }
  });
  canvas.addEventListener('pointerleave', () => { if (!drag) setResizeCursor(null); });
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('lostpointercapture', stopDrag);
  canvas.addEventListener('keydown', event => {
    const layer = selectedLayer();
    const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!layer || !movement) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    layer.x += movement[0] * step;
    layer.y += movement[1] * step;
    clampPosition(layer);
    showCenterGuide = true;
    clearTimeout(guideTimeout);
    guideTimeout = setTimeout(() => {
      showCenterGuide = false;
      drawEditor();
    }, 700);
    drawEditor();
  });
  sizeInput.addEventListener('input', () => {
    const layer = selectedLayer();
    if (!layer) return;
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    const scale = Number(sizeInput.value) / Math.max(layer.image.naturalWidth, layer.image.naturalHeight);
    layer.width = layer.image.naturalWidth * scale;
    layer.height = layer.image.naturalHeight * scale;
    layer.x = centerX - layer.width / 2;
    layer.y = centerY - layer.height / 2;
    clampPosition(layer);
    showCenterGuide = true;
    clearTimeout(guideTimeout);
    guideTimeout = setTimeout(() => {
      showCenterGuide = false;
      drawEditor();
    }, 700);
    syncSelection();
  });
  sizeInput.addEventListener('change', () => {
    clearTimeout(guideTimeout);
    showCenterGuide = false;
    drawEditor();
  });
  function removeLayer(id) {
    const index = layers.findIndex(layer => layer.id === id);
    if (index === -1) return;
    stopDrag();
    URL.revokeObjectURL(layers[index].url);
    layers.splice(index, 1);
    selectedId = layers[Math.min(index, layers.length - 1)]?.id ?? null;
    $('main-load-status').textContent = '';
    renderLayerList();
    (list.querySelector('[aria-pressed="true"]') || dropZone).focus();
  }

  downloadButton.addEventListener('click', async () => {
    if (!layers.length || pendingImports || exporting) return;
    exporting = true;
    updateDownloadButton();
    showMainError('');
    try {
      const output = document.createElement('canvas');
      output.width = SIZE;
      output.height = SIZE;
      const ctx = output.getContext('2d', { colorSpace: 'srgb' });
      drawLayers(ctx);
      const pixels = ctx.getImageData(0, 0, SIZE, SIZE).data;
      if (!pixels.some((value, index) => index % 4 === 3 && value > 0)) {
        throw new Error('画像がすべて透明なため保存できません。イラストのある画像を追加してください。');
      }
      const raw = await new Promise((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG画像を作成できませんでした。もう一度ダウンロードしてください。')), 'image/png'));
      const blob = await withPngResolution(raw);
      if (blob.size > 1000000) throw new Error('画像が1MBを超えています。画像を減らしてから再度ダウンロードしてください。');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'main.png';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (cause) {
      showMainError(cause.message || '保存処理に失敗しました。画像を選び直して再度お試しください。');
    } finally {
      exporting = false;
      updateDownloadButton();
    }
  });
  resetButton.addEventListener('click', () => {
    stopDrag();
    layers.forEach(layer => URL.revokeObjectURL(layer.url));
    layers.length = 0;
    selectedId = null;
    fileInput.value = '';
    $('main-load-status').textContent = '';
    showMainError('');
    renderLayerList();
    drawEditor();
    updateDownloadButton();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  new ResizeObserver(drawEditor).observe(canvas);
  drawEditor();
})();

// ===== Talk Room Tab Image Editor (independent) =====
(() => {
  const WIDTH = 96;
  const HEIGHT = 74;
  const PADDING = 10;
  const INNER_WIDTH = WIDTH - PADDING * 2; // 76
  const INNER_HEIGHT = HEIGHT - PADDING * 2; // 54
  const $ = id => document.getElementById(id);
  const canvas = $('talk-canvas');
  const context = canvas.getContext('2d');
  const fileInput = $('talk-file-input');
  const dropZone = $('talk-drop-zone');
  const list = $('talk-image-list');
  const previews = $('talk-selected-preview');
  const controls = $('talk-image-controls');
  const sizeInput = $('talk-size');
  const downloadButton = $('talk-download');
  const resetButton = $('talk-reset');
  const error = $('talk-error');
  const layers = [];
  let selectedId = null;
  let nextId = 1;
  let drag = null;
  let pendingImports = 0;
  let exporting = false;
  let importQueue = Promise.resolve();
  let showCenterGuide = false;
  let guideTimeout = null;

  const selectedLayer = () => layers.find(layer => layer.id === selectedId);
  function showTalkError(message) {
    error.textContent = message;
    error.classList.toggle('hidden', !message);
  }
  function clampPosition(layer) {
    layer.x = Math.max(0, Math.min(WIDTH - layer.width, layer.x));
    layer.y = Math.max(0, Math.min(HEIGHT - layer.height, layer.y));
  }
  function updateDownloadButton() {
    const hasLayers = layers.length > 0;
    downloadButton.disabled = !hasLayers || pendingImports > 0 || exporting;
    resetButton.disabled = !hasLayers || pendingImports > 0 || exporting;
  }
  function drawLayers(ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.beginPath();
    ctx.rect(PADDING, PADDING, INNER_WIDTH, INNER_HEIGHT);
    ctx.clip();
    layers.forEach(layer => ctx.drawImage(layer.image, layer.x, layer.y, layer.width, layer.height));
    ctx.restore();
  }
  function drawEditor() {
    const ratioX = canvas.width / WIDTH;
    const ratioY = canvas.height / HEIGHT;
    const visualScale = 3 / ratioX; // メインタブ（倍率3）と画面上の見た目を完全に揃えるための補正比率
    context.setTransform(ratioX, 0, 0, ratioY, 0, 0);
    context.clearRect(0, 0, WIDTH, HEIGHT);
    drawLayers(context);
    context.save();
    context.strokeStyle = '#007562';
    context.lineWidth = 0.5 * visualScale;
    context.setLineDash([3 * visualScale, 3 * visualScale]);
    context.strokeRect(PADDING, PADDING, INNER_WIDTH, INNER_HEIGHT);
    const layer = selectedLayer();
    if (layer) {
      context.setLineDash([]);
      context.lineWidth = 1 * visualScale;
      context.strokeRect(layer.x, layer.y, layer.width, layer.height);
      const handleSize = 12 * canvasUnitsPerPixel();
      context.fillStyle = '#ffffff';
      for (const corner of resizeCorners(layer)) {
        context.fillRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
        context.strokeRect(corner.x - handleSize / 2, corner.y - handleSize / 2, handleSize, handleSize);
      }
    }
    // 移動中の中央ガイド線（垂直・水平 赤2px）
    if (showCenterGuide) {
      context.setLineDash([]);
      context.strokeStyle = '#ff3b30';
      context.lineWidth = 2 * canvasUnitsPerPixel();
      const midX = WIDTH / 2;
      const midY = HEIGHT / 2;
      context.beginPath();
      context.moveTo(midX, 0);
      context.lineTo(midX, HEIGHT);
      context.stroke();
      context.beginPath();
      context.moveTo(0, midY);
      context.lineTo(WIDTH, midY);
      context.stroke();
    }
    context.restore();
  }
  function syncSelection() {
    const layer = selectedLayer();
    controls.disabled = !layer;
    $('talk-selected-name').textContent = layer ? layer.name : '画像が選択されていません';
    $('talk-size-value').textContent = layer ? `${Math.round(Math.max(layer.width, layer.height))} px` : '—';
    if (layer) sizeInput.value = Math.round(Math.max(layer.width, layer.height));
    list.querySelectorAll('.main-image-select').forEach(button => {
      const selected = Number(button.dataset.layerId) === selectedId;
      button.setAttribute('aria-pressed', String(selected));
      button.parentElement.classList.toggle('is-selected', selected);
      button.parentElement.querySelector('.main-image-remove').hidden = !selected;
    });
    drawEditor();
  }
  function renderLayerList() {
    list.replaceChildren();
    previews.replaceChildren();
    layers.forEach(layer => {
      const item = document.createElement('li');
      item.className = 'main-image-row';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'main-image-select';
      button.dataset.layerId = layer.id;
      button.setAttribute('aria-label', `${layer.name}を選択`);
      const thumbnail = document.createElement('img');
      thumbnail.src = layer.url;
      thumbnail.alt = '';
      thumbnail.width = 48;
      thumbnail.height = 48;
      thumbnail.loading = 'lazy';
      const name = document.createElement('span');
      name.textContent = layer.name;
      button.append(thumbnail, name);
      button.addEventListener('click', () => {
        selectedId = layer.id;
        syncSelection();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'main-image-remove';
      remove.textContent = '削除';
      remove.setAttribute('aria-label', `${layer.name}を削除`);
      remove.addEventListener('click', () => removeLayer(layer.id));
      item.append(button, remove);
      list.append(item);
      const preview = document.createElement('img');
      preview.src = layer.url;
      preview.alt = layer.name;
      preview.title = layer.name;
      preview.className = 'preview-thumb';
      preview.draggable = false;
      previews.append(preview);
    });
    previews.classList.toggle('hidden', !layers.length);
    $('talk-empty').hidden = layers.length > 0;
    updateDownloadButton();
    syncSelection();
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve({ image, url });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像を読み込めませんでした。'));
      };
      image.src = url;
    });
  }
  function addFiles(files) {
    const batch = Array.from(files);
    if (!batch.length) return;
    pendingImports++;
    updateDownloadButton();
    importQueue = importQueue.then(async () => {
      showTalkError('');
      const failed = [];
      for (const [index, file] of batch.entries()) {
        $('talk-load-status').textContent = `画像を読み込み中… ${index + 1} / ${batch.length}`;
        if (!['image/png', 'image/jpeg'].includes(file.type)) {
          failed.push(file.name);
          continue;
        }
        try {
          const { image, url } = await loadImage(file);
          const scale = Math.min(1, INNER_WIDTH / image.naturalWidth, INNER_HEIGHT / image.naturalHeight);
          const width = image.naturalWidth * scale;
          const height = image.naturalHeight * scale;
          const layer = { id: nextId++, name: file.name, image, url, width, height, x: (WIDTH - width) / 2, y: (HEIGHT - height) / 2 };
          layers.push(layer);
          selectedId = layer.id;
          renderLayerList();
        } catch {
          failed.push(file.name);
        }
      }
      if (failed.length) {
        showTalkError(`読み込めない画像があります（${failed.join('、')}）。対応形式でないか、ファイルが破損しています。開けるPNG・JPG画像を選び直してください。`);
      }
      $('talk-load-status').textContent = '';
    }).finally(() => {
      pendingImports--;
      updateDownloadButton();
    });
  }
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dropZone.classList.add('dragging');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('dragging');
    if (event.dataTransfer) addFiles(event.dataTransfer.files);
  });

  function canvasPoint(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * WIDTH / bounds.width, y: (event.clientY - bounds.top) * HEIGHT / bounds.height };
  }
  function canvasUnitsPerPixel() {
    return WIDTH / (canvas.getBoundingClientRect().width || 480);
  }
  function resizeCorners(layer) {
    return [
      { x: layer.x, y: layer.y, sx: -1, sy: -1 },
      { x: layer.x + layer.width, y: layer.y, sx: 1, sy: -1 },
      { x: layer.x, y: layer.y + layer.height, sx: -1, sy: 1 },
      { x: layer.x + layer.width, y: layer.y + layer.height, sx: 1, sy: 1 },
    ];
  }
  function hitResizeHandle(point, pointerType) {
    const layer = selectedLayer();
    if (!layer) return null;
    const radius = (pointerType === 'touch' ? 18 : 10) * canvasUnitsPerPixel();
    return resizeCorners(layer)
      .map(corner => ({ ...corner, distance: Math.hypot(point.x - corner.x, point.y - corner.y) }))
      .filter(corner => corner.distance <= radius)
      .sort((a, b) => a.distance - b.distance)[0] || null;
  }
  function setResizeCursor(corner) {
    canvas.classList.toggle('is-resize-nwse', !!corner && corner.sx === corner.sy);
    canvas.classList.toggle('is-resize-nesw', !!corner && corner.sx !== corner.sy);
  }
  function stopDrag() {
    const pointerId = drag?.pointerId;
    drag = null;
    showCenterGuide = false;
    if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    canvas.classList.remove('is-dragging');
    setResizeCursor(null);
    drawEditor();
  }
  canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const point = canvasPoint(event);
    const current = selectedLayer();
    const corner = hitResizeHandle(point, event.pointerType);
    const contains = layer => point.x >= layer.x && point.x <= layer.x + layer.width && point.y >= layer.y && point.y <= layer.y + layer.height;
    const layer = corner || (current && contains(current)) ? current : [...layers].reverse().find(contains);
    selectedId = layer ? layer.id : null;
    canvas.focus({ preventScroll: true });
    syncSelection();
    if (!layer) return;
    drag = { pointerId: event.pointerId, layer, start: point, x: layer.x, y: layer.y, width: layer.width, height: layer.height, corner };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.toggle('is-dragging', !corner);
    setResizeCursor(corner);
  });
  canvas.addEventListener('pointermove', event => {
    const point = canvasPoint(event);
    if (!drag) {
      setResizeCursor(hitResizeHandle(point, event.pointerType));
      return;
    }
    if (event.pointerId !== drag.pointerId) return;
    if (drag.corner) {
      const { sx, sy } = drag.corner;
      const anchorX = drag.x + (sx < 0 ? drag.width : 0);
      const anchorY = drag.y + (sy < 0 ? drag.height : 0);
      const dx = (point.x - drag.start.x) * sx;
      const dy = (point.y - drag.start.y) * sy;
      const requested = 1 + (dx * drag.width + dy * drag.height) / (drag.width ** 2 + drag.height ** 2);
      const maxWidth = sx > 0 ? WIDTH - anchorX : anchorX;
      const maxHeight = sy > 0 ? HEIGHT - anchorY : anchorY;
      const minScale = 1 / Math.max(drag.width, drag.height);
      const maxScale = Math.min(maxWidth / drag.width, maxHeight / drag.height);
      const scale = Math.max(minScale, Math.min(maxScale, requested));
      drag.layer.width = drag.width * scale;
      drag.layer.height = drag.height * scale;
      drag.layer.x = anchorX - (sx < 0 ? drag.layer.width : 0);
      drag.layer.y = anchorY - (sy < 0 ? drag.layer.height : 0);
      showCenterGuide = true;
      syncSelection();
    } else {
      drag.layer.x = drag.x + point.x - drag.start.x;
      drag.layer.y = drag.y + point.y - drag.start.y;
      const midX = WIDTH / 2;
      const midY = HEIGHT / 2;
      const SNAP = 2;
      const centerX = drag.layer.x + drag.layer.width / 2;
      const centerY = drag.layer.y + drag.layer.height / 2;
      if (Math.abs(centerX - midX) <= SNAP) {
        drag.layer.x = midX - drag.layer.width / 2;
      }
      if (Math.abs(centerY - midY) <= SNAP) {
        drag.layer.y = midY - drag.layer.height / 2;
      }
      clampPosition(drag.layer);
      showCenterGuide = true;
      drawEditor();
    }
  });
  canvas.addEventListener('pointerleave', () => { if (!drag) setResizeCursor(null); });
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
  canvas.addEventListener('lostpointercapture', stopDrag);
  canvas.addEventListener('keydown', event => {
    const layer = selectedLayer();
    const movement = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!layer || !movement) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    layer.x += movement[0] * step;
    layer.y += movement[1] * step;
    clampPosition(layer);
    showCenterGuide = true;
    clearTimeout(guideTimeout);
    guideTimeout = setTimeout(() => {
      showCenterGuide = false;
      drawEditor();
    }, 700);
    drawEditor();
  });
  sizeInput.addEventListener('input', () => {
    const layer = selectedLayer();
    if (!layer) return;
    const centerX = layer.x + layer.width / 2;
    const centerY = layer.y + layer.height / 2;
    const scale = Number(sizeInput.value) / Math.max(layer.image.naturalWidth, layer.image.naturalHeight);
    layer.width = layer.image.naturalWidth * scale;
    layer.height = layer.image.naturalHeight * scale;
    layer.x = centerX - layer.width / 2;
    layer.y = centerY - layer.height / 2;
    clampPosition(layer);
    showCenterGuide = true;
    clearTimeout(guideTimeout);
    guideTimeout = setTimeout(() => {
      showCenterGuide = false;
      drawEditor();
    }, 700);
    syncSelection();
  });
  sizeInput.addEventListener('change', () => {
    clearTimeout(guideTimeout);
    showCenterGuide = false;
    drawEditor();
  });
  function removeLayer(id) {
    const index = layers.findIndex(layer => layer.id === id);
    if (index === -1) return;
    stopDrag();
    URL.revokeObjectURL(layers[index].url);
    layers.splice(index, 1);
    selectedId = layers[Math.min(index, layers.length - 1)]?.id ?? null;
    $('talk-load-status').textContent = '';
    renderLayerList();
    (list.querySelector('[aria-pressed="true"]') || dropZone).focus();
  }

  downloadButton.addEventListener('click', async () => {
    if (!layers.length || pendingImports || exporting) return;
    exporting = true;
    updateDownloadButton();
    showTalkError('');
    try {
      const output = document.createElement('canvas');
      output.width = WIDTH;
      output.height = HEIGHT;
      const ctx = output.getContext('2d', { colorSpace: 'srgb' });
      drawLayers(ctx);
      const pixels = ctx.getImageData(0, 0, WIDTH, HEIGHT).data;
      if (!pixels.some((value, index) => index % 4 === 3 && value > 0)) {
        throw new Error('画像がすべて透明なため保存できません。イラストのある画像を追加してください。');
      }
      const raw = await new Promise((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG画像を作成できませんでした。もう一度ダウンロードしてください。')), 'image/png'));
      const blob = await withPngResolution(raw);
      if (blob.size > 1000000) throw new Error('画像が1MBを超えています。画像を減らしてから再度ダウンロードしてください。');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tab.png';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (cause) {
      showTalkError(cause.message || '保存処理に失敗しました。画像を選び直して再度お試しください。');
    } finally {
      exporting = false;
      updateDownloadButton();
    }
  });
  resetButton.addEventListener('click', () => {
    stopDrag();
    layers.forEach(layer => URL.revokeObjectURL(layer.url));
    layers.length = 0;
    selectedId = null;
    fileInput.value = '';
    $('talk-load-status').textContent = '';
    showTalkError('');
    renderLayerList();
    drawEditor();
    updateDownloadButton();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  new ResizeObserver(drawEditor).observe(canvas);
  drawEditor();
})();
