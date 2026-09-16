// ---------- Global State ----------
    const config = {
      enablePaywall: false,
      freeExportLimit: 5,
      paymentUrl: ''
    };
    let imagesData = []; // { id, file, name, objectUrl, baseImg, thumbCanvas, ... }
    let activeModalIndex = null;

    const wmConfig = {
      mode: 'image', // 'image' | 'text'
      wmImg: null,
      text: { content: '© Your Brand', font: 'Arial', color: '#ffffff', bold: true, italic: false, strokeColor: '#000000', strokeWidth: 0, shadowBlur: 0 }
    };

    // ---------- DOM Elements ----------
    const baseInputs = document.getElementById('baseInputs');
    const wmInput = document.getElementById('wmInput');
    const wmFilename = document.getElementById('wmFilename');
    const wmImageControls = document.getElementById('wmImageControls');
    const wmTextControls = document.getElementById('wmTextControls');
    const wmText = document.getElementById('wmText');
    const wmFont = document.getElementById('wmFont');
    const wmColor = document.getElementById('wmColor');
    const wmBold = document.getElementById('wmBold');
    const wmItalic = document.getElementById('wmItalic');
    const wmStrokeColor = document.getElementById('wmStrokeColor');
    const wmStrokeWidth = document.getElementById('wmStrokeWidth');
    const wmShadowBlur = document.getElementById('wmShadowBlur');

    const opacitySlider = document.getElementById('opacity');
    const scaleSlider = document.getElementById('scale');
    const rotationSlider = document.getElementById('rotation');
    const presetSelectPos = document.getElementById('presetPos');
    const tileModeCheckbox = document.getElementById('tileMode');

    const outputFormatSelect = document.getElementById('outputFormat');
    const qualityGroup = document.getElementById('qualityGroup');
    const jpegQualityInput = document.getElementById('jpegQuality');
    const filenamePrefixInput = document.getElementById('filenamePrefix');

    const presetNameInput = document.getElementById('presetNameInput');
    const savePresetBtn = document.getElementById('savePresetBtn');
    const presetSelect = document.getElementById('presetSelect');
    const deletePresetBtn = document.getElementById('deletePresetBtn');

    const applyAllBtn = document.getElementById('applyAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const galleryGrid = document.getElementById('galleryGrid');
    const statsText = document.getElementById('statsText');

    const progressWrap = document.getElementById('progressWrap');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    // Modal DOM Elements
    const reviewModal = document.getElementById('reviewModal');
    const modalClose = document.getElementById('modalClose');
    const modalTitle = document.getElementById('modalTitle');
    const modalCanvas = document.getElementById('modalCanvas');
    const modalCtx = modalCanvas.getContext('2d');
    const mOpacity = document.getElementById('mOpacity');
    const mScale = document.getElementById('mScale');
    const mRotation = document.getElementById('mRotation');
    const mPresetPos = document.getElementById('mPresetPos');
    const mTile = document.getElementById('mTile');
    const modalResetBtn = document.getElementById('modalResetBtn');
    const modalSaveBtn = document.getElementById('modalSaveBtn');

    let modalDragging = false;
    let modalResizing = false;
    let modalDragOffset = { x: 0, y: 0 };

    // ---------- Helpers ----------
    function loadImage(file) {
      return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({ img, objectUrl });
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Could not load image: ${file.name}`));
        };
        img.src = objectUrl;
      });
    }

    function resolveWatermarkText(item) {
      const date = new Date();
      return (wmConfig.text.content || '')
        .replace(/\{filename\}/gi, stripExt(item.name))
        .replace(/\{year\}/gi, String(date.getFullYear()))
        .replace(/\{date\}/gi, date.toISOString().slice(0, 10))
        .replace(/\{index\}/gi, String((imagesData.indexOf(item) + 1) || 1));
    }

    function stripExt(name) { return name.replace(/\.[^/.]+$/, ''); }

    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    function getFontString(fontSizePx, font, bold, italic) {
      return `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSizePx}px ${font}`;
    }
    function measureTextBox(text, fontSizePx, font, bold, italic) {
      measureCtx.font = getFontString(fontSizePx, font, bold, italic);
      const width = measureCtx.measureText(text || ' ').width;
      return { width: Math.max(width, 10), height: fontSizePx * 1.3 };
    }

    function calculateWmBox(canvasW, canvasH, scalePct, preset, customBox = null) {
      let w = 0, h = 0;
      if (wmConfig.mode === 'image' && wmConfig.wmImg) {
        w = canvasW * (scalePct / 100);
        h = (wmConfig.wmImg.naturalHeight / wmConfig.wmImg.naturalWidth) * w;
      } else if (wmConfig.mode === 'text') {
        const fontSize = canvasH * (scalePct / 100) * 0.6;
        const box = measureTextBox(resolveWatermarkText({ name: wmConfig.text.content }), fontSize, wmConfig.text.font, wmConfig.text.bold, wmConfig.text.italic);
        w = box.width; h = box.height;
      }
      const pad = canvasW * 0.03;
      if (customBox && preset === 'custom') return { x: customBox.x, y: customBox.y, width: w, height: h };

      let x = 0, y = 0;
      switch (preset) {
        case 'top-left': x = pad; y = pad; break;
        case 'top-right': x = canvasW - w - pad; y = pad; break;
        case 'center': x = (canvasW - w) / 2; y = (canvasH - h) / 2; break;
        case 'bottom-left': x = pad; y = canvasH - h - pad; break;
        case 'bottom-right':
        default: x = canvasW - w - pad; y = canvasH - h - pad; break;
      }
      return { x, y, width: w, height: h };
    }

    function drawSingleWatermark(ctx, item) {
      const box = item.wmBox;
      if (!box.width || !box.height) return;
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((item.rotation || 0) * Math.PI / 180);
      if (wmConfig.mode === 'image' && wmConfig.wmImg) {
        ctx.drawImage(wmConfig.wmImg, -box.width / 2, -box.height / 2, box.width, box.height);
      } else if (wmConfig.mode === 'text' && wmConfig.text.content) {
        ctx.font = getFontString(box.height / 1.3, wmConfig.text.font, wmConfig.text.bold, wmConfig.text.italic);
        ctx.strokeStyle = wmConfig.text.strokeColor;
        ctx.lineWidth = wmConfig.text.strokeWidth;
        ctx.shadowColor = 'rgba(0,0,0,.55)';
        ctx.shadowBlur = wmConfig.text.shadowBlur;
        ctx.fillStyle = wmConfig.text.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = resolveWatermarkText(item);
        if (wmConfig.text.strokeWidth) ctx.strokeText(text, 0, 0);
        ctx.fillText(text, 0, 0);
      }
      ctx.restore();
    }

    function drawTiledWatermark(ctx, canvasW, canvasH, item) {
      const box = item.wmBox;
      if (!box.width || !box.height) return;
      const spacingX = box.width * 1.8;
      const spacingY = box.height * 1.8;
      const margin = Math.sqrt(canvasW * canvasW + canvasH * canvasH);
      ctx.save();
      ctx.translate(canvasW / 2, canvasH / 2);
      ctx.rotate((item.rotation || 0) * Math.PI / 180);
      ctx.translate(-canvasW / 2, -canvasH / 2);
      for (let y = -margin; y < canvasH + margin; y += spacingY) {
        for (let x = -margin; x < canvasW + margin; x += spacingX) {
          ctx.save();
          ctx.translate(x + box.width / 2, y + box.height / 2);
          if (wmConfig.mode === 'image' && wmConfig.wmImg) {
            ctx.drawImage(wmConfig.wmImg, -box.width / 2, -box.height / 2, box.width, box.height);
          } else if (wmConfig.mode === 'text' && wmConfig.text.content) {
            ctx.font = getFontString(box.height / 1.3, wmConfig.text.font, wmConfig.text.bold, wmConfig.text.italic);
            ctx.strokeStyle = wmConfig.text.strokeColor;
            ctx.lineWidth = wmConfig.text.strokeWidth;
            ctx.shadowColor = 'rgba(0,0,0,.55)';
            ctx.shadowBlur = wmConfig.text.shadowBlur;
            ctx.fillStyle = wmConfig.text.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const text = resolveWatermarkText(item);
            if (wmConfig.text.strokeWidth) ctx.strokeText(text, 0, 0);
            ctx.fillText(text, 0, 0);
          }
          ctx.restore();
        }
      }
      ctx.restore();
    }

    function drawWatermarkOnCtx(ctx, canvasW, canvasH, item) {
      const hasWm = wmConfig.mode === 'image' ? !!wmConfig.wmImg : !!(wmConfig.text.content && wmConfig.text.content.trim());
      if (!hasWm) return;
      ctx.save();
      ctx.globalAlpha = item.opacity;
      if (item.tile) drawTiledWatermark(ctx, canvasW, canvasH, item);
      else drawSingleWatermark(ctx, item);
      ctx.restore();
    }

    function renderFinalCanvas(item, format) {
      const canvas = document.createElement('canvas');
      canvas.width = item.baseImg.naturalWidth;
      canvas.height = item.baseImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(item.baseImg, 0, 0);
      drawWatermarkOnCtx(ctx, canvas.width, canvas.height, item);
      return canvas;
    }

    // ---------- Watermark Type Toggle ----------
    document.querySelectorAll('.wm-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.wm-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        wmConfig.mode = btn.dataset.type;
        wmImageControls.style.display = wmConfig.mode === 'image' ? 'flex' : 'none';
        wmTextControls.style.display = wmConfig.mode === 'text' ? 'flex' : 'none';
        updateUIState();
        refreshAllThumbnails();
      });
    });

    function syncTextConfig() {
      wmConfig.text.content = wmText.value;
      wmConfig.text.font = wmFont.value;
      wmConfig.text.color = wmColor.value;
      wmConfig.text.bold = wmBold.checked;
      wmConfig.text.italic = wmItalic.checked;
      wmConfig.text.strokeColor = wmStrokeColor.value;
      wmConfig.text.strokeWidth = parseFloat(wmStrokeWidth.value);
      wmConfig.text.shadowBlur = parseFloat(wmShadowBlur.value);
      document.getElementById('wmStrokeWidthVal').textContent = wmStrokeWidth.value;
      document.getElementById('wmShadowBlurVal').textContent = wmShadowBlur.value;
      updateUIState();
      refreshAllThumbnails();
    }
    [wmText].forEach(el => el.addEventListener('input', syncTextConfig));
    [wmFont, wmBold, wmItalic, wmStrokeColor, wmStrokeWidth, wmShadowBlur].forEach(el => el.addEventListener('change', syncTextConfig));
    [wmColor, wmStrokeColor, wmStrokeWidth, wmShadowBlur].forEach(el => el.addEventListener('input', syncTextConfig));

    // ---------- Uploads ----------
    wmInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        wmConfig.wmImg = (await loadImage(file)).img;
        wmFilename.textContent = `✓ ${file.name}`;
        updateUIState();
        refreshAllThumbnails();
      }
    });

    async function addBaseFiles(files) {
      if (!files.length) return;

      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const loaded = await loadImage(file);
        const baseImg = loaded.img;
        const thumbCanvas = document.createElement('canvas');
        const thumbScale = Math.min(1, MAX_THUMB / Math.max(baseImg.naturalWidth, baseImg.naturalHeight));
        thumbCanvas.width = Math.max(1, Math.round(baseImg.naturalWidth * thumbScale));
        thumbCanvas.height = Math.max(1, Math.round(baseImg.naturalHeight * thumbScale));
        thumbCanvas.getContext('2d').drawImage(baseImg, 0, 0, thumbCanvas.width, thumbCanvas.height);
        const opacity = parseFloat(opacitySlider.value);
        const scale = parseFloat(scaleSlider.value);
        const rotation = parseFloat(rotationSlider.value);
        const tile = tileModeCheckbox.checked;
        const preset = presetSelectPos.value;

        imagesData.push({
          id: Math.random().toString(36).substring(2, 9),
          file, name: file.name, objectUrl: loaded.objectUrl, baseImg, thumbCanvas,
          opacity, scale, rotation, tile, preset,
          wmBox: calculateWmBox(baseImg.naturalWidth, baseImg.naturalHeight, scale, preset)
        });
      }

      updateUIState();
      renderGallery();
    }

    baseInputs.addEventListener('change', async (e) => {
      await addBaseFiles(Array.from(e.target.files || []));
      e.target.value = '';
    });

    // Allow creators to drop a full batch directly onto the upload surface.
    const uploadDropzone = baseInputs.closest('.file-dropzone');
    ['dragenter', 'dragover'].forEach(type => uploadDropzone.addEventListener(type, (e) => {
      e.preventDefault();
      uploadDropzone.classList.add('drag-over');
    }));
    ['dragleave', 'drop'].forEach(type => uploadDropzone.addEventListener(type, (e) => {
      e.preventDefault();
      uploadDropzone.classList.remove('drag-over');
    }));
    uploadDropzone.addEventListener('drop', async (e) => {
      await addBaseFiles(Array.from(e.dataTransfer.files || []));
    });
    galleryGrid.addEventListener('dragover', (e) => { e.preventDefault(); galleryGrid.classList.add('drag-over'); });
    galleryGrid.addEventListener('dragenter', (e) => { e.preventDefault(); galleryGrid.classList.add('drag-over'); });
    galleryGrid.addEventListener('dragleave', (e) => { if (!galleryGrid.contains(e.relatedTarget)) galleryGrid.classList.remove('drag-over'); });
    galleryGrid.addEventListener('drop', async (e) => {
      e.preventDefault();
      galleryGrid.classList.remove('drag-over');
      await addBaseFiles(Array.from(e.dataTransfer.files || []));
    });
    document.querySelector('.workspace').addEventListener('dragover', (e) => e.preventDefault());
    document.querySelector('.workspace').addEventListener('drop', async (e) => {
      if (e.target.closest('input, .file-dropzone, .gallery-grid')) return;
      e.preventDefault();
      await addBaseFiles(Array.from(e.dataTransfer.files || []));
    });

    function updateUIState() {
      const count = imagesData.length;
      statsText.textContent = `${count} image${count === 1 ? '' : 's'} loaded`;
      clearAllBtn.disabled = count === 0;
      downloadAllBtn.disabled = count === 0;
      const hasWm = wmConfig.mode === 'image' ? !!wmConfig.wmImg : !!(wmConfig.text.content && wmConfig.text.content.trim());
      applyAllBtn.disabled = count === 0 || !hasWm;
    }

    function refreshAllThumbnails() {
      imagesData.forEach(item => {
        item.wmBox = calculateWmBox(item.baseImg.naturalWidth, item.baseImg.naturalHeight, item.scale, item.preset, item.preset === 'custom' ? item.wmBox : null);
      });
      renderGallery();
    }

    const MAX_THUMB = 360;
    function renderGallery() {
      if (imagesData.length === 0) {
        galleryGrid.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">✦</div>
            <h3>Your canvas is ready</h3>
            <p>Drop your product shots, portfolio images, or social content here to get started.</p>
            <label class="empty-upload-btn" for="baseInputs">Choose images <span>→</span></label>
            <div class="empty-hint">JPG, PNG, WEBP supported · processed locally</div>
          </div>`;
        return;
      }

      galleryGrid.innerHTML = '';
      imagesData.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="card-preview">
            ${item.preset === 'custom' ? '<span class="layer-badge">Custom layer</span>' : ''}
            <canvas id="thumb-${index}"></canvas>
          </div>
          <div class="card-footer">
            <div class="card-title" title="${item.name}">${item.name}</div>
            <div class="card-actions">
              <button class="card-btn" onclick="openReview(${index})">🔍 Edit</button>
              <button class="card-btn" onclick="downloadSingle(${index})">⬇ Save</button>
              <button class="card-btn danger" onclick="removeImage('${item.id}')">✕</button>
            </div>
          </div>
        `;
        galleryGrid.appendChild(card);

        const c = document.getElementById(`thumb-${index}`);
        const scaleFactor = item.thumbCanvas.width / item.baseImg.naturalWidth;
        const tw = item.thumbCanvas.width;
        const th = item.thumbCanvas.height;
        c.width = tw; c.height = th;
        const ctx = c.getContext('2d');
        ctx.drawImage(item.thumbCanvas, 0, 0);
        const scaledItem = {
          ...item,
          wmBox: { x: item.wmBox.x * scaleFactor, y: item.wmBox.y * scaleFactor, width: item.wmBox.width * scaleFactor, height: item.wmBox.height * scaleFactor }
        };
        drawWatermarkOnCtx(ctx, tw, th, scaledItem);
      });
    }

    window.removeImage = function (id) {
      const item = imagesData.find(entry => entry.id === id);
      if (item && item.objectUrl) URL.revokeObjectURL(item.objectUrl);
      imagesData = imagesData.filter(entry => entry.id !== id);
      updateUIState();
      renderGallery();
    };

    clearAllBtn.addEventListener('click', () => {
      imagesData.forEach(item => { if (item.objectUrl) URL.revokeObjectURL(item.objectUrl); });
      imagesData = [];
      updateUIState();
      renderGallery();
    });

    applyAllBtn.addEventListener('click', () => {
      const opacity = parseFloat(opacitySlider.value);
      const scale = parseFloat(scaleSlider.value);
      const rotation = parseFloat(rotationSlider.value);
      const tile = tileModeCheckbox.checked;
      const preset = presetSelectPos.value;

      imagesData.forEach(item => {
        item.opacity = opacity;
        item.scale = scale;
        item.rotation = rotation;
        item.tile = tile;
        item.preset = preset;
        item.wmBox = calculateWmBox(item.baseImg.naturalWidth, item.baseImg.naturalHeight, scale, preset);
      });
      renderGallery();
    });

    opacitySlider.addEventListener('input', (e) => { document.getElementById('opacityVal').textContent = e.target.value; });
    scaleSlider.addEventListener('input', (e) => { document.getElementById('scaleVal').textContent = e.target.value; });
    rotationSlider.addEventListener('input', (e) => { document.getElementById('rotationVal').textContent = e.target.value; });

    outputFormatSelect.addEventListener('change', () => {
      qualityGroup.style.display = ['jpeg', 'webp', 'avif'].includes(outputFormatSelect.value) ? 'flex' : 'none';
    });
    jpegQualityInput.addEventListener('input', (e) => { document.getElementById('qualityVal').textContent = e.target.value; });

    // ---------- Presets ----------
    function getPresets() {
      try { return JSON.parse(localStorage.getItem('pixelguardPresets') || '[]'); }
      catch (e) { return []; }
    }
    function savePresetsList(list) {
      try { localStorage.setItem('pixelguardPresets', JSON.stringify(list)); }
      catch (e) { alert('Could not save preset — browser storage may be full.'); }
    }
    function refreshPresetSelect() {
      const list = getPresets();
      presetSelect.innerHTML = '<option value="">-- Select a preset --</option>' +
        list.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
    }

    savePresetBtn.addEventListener('click', () => {
      const name = presetNameInput.value.trim();
      if (!name) { alert('Enter a preset name first.'); return; }
      const preset = {
        name,
        mode: wmConfig.mode,
        opacity: parseFloat(opacitySlider.value),
        scale: parseFloat(scaleSlider.value),
        rotation: parseFloat(rotationSlider.value),
        tile: tileModeCheckbox.checked,
        preset: presetSelectPos.value,
        text: { ...wmConfig.text },
        wmImgDataUrl: (wmConfig.mode === 'image' && wmConfig.wmImg) ? wmConfig.wmImg.src : null
      };
      const list = getPresets();
      list.push(preset);
      savePresetsList(list);
      refreshPresetSelect();
      presetNameInput.value = '';
    });

    presetSelect.addEventListener('change', async () => {
      const idx = presetSelect.value;
      if (idx === '') return;
      const list = getPresets();
      const p = list[parseInt(idx, 10)];
      if (!p) return;

      opacitySlider.value = p.opacity; document.getElementById('opacityVal').textContent = p.opacity;
      scaleSlider.value = p.scale; document.getElementById('scaleVal').textContent = p.scale;
      rotationSlider.value = p.rotation || 0; document.getElementById('rotationVal').textContent = p.rotation || 0;
      tileModeCheckbox.checked = !!p.tile;
      presetSelectPos.value = p.preset;

      wmConfig.text = { ...p.text };
      wmText.value = wmConfig.text.content;
      wmFont.value = wmConfig.text.font;
      wmColor.value = wmConfig.text.color;
      wmBold.checked = wmConfig.text.bold;
      wmItalic.checked = wmConfig.text.italic;
      wmStrokeColor.value = wmConfig.text.strokeColor || '#000000';
      wmStrokeWidth.value = wmConfig.text.strokeWidth || 0;
      wmShadowBlur.value = wmConfig.text.shadowBlur || 0;

      const targetBtn = document.querySelector(`.wm-type-btn[data-type="${p.mode}"]`);
      if (targetBtn) targetBtn.click();

      if (p.mode === 'image' && p.wmImgDataUrl) {
        const img = new Image();
        await new Promise(res => { img.onload = res; img.src = p.wmImgDataUrl; });
        wmConfig.wmImg = img;
        wmFilename.textContent = '✓ Loaded from preset';
      }

      updateUIState();
      refreshAllThumbnails();
    });

    deletePresetBtn.addEventListener('click', () => {
      const idx = presetSelect.value;
      if (idx === '') return;
      const list = getPresets();
      list.splice(parseInt(idx, 10), 1);
      savePresetsList(list);
      refreshPresetSelect();
    });

    refreshPresetSelect();

    // ---------- Single Download ----------
    window.downloadSingle = function (index) {
      const item = imagesData[index];
      const format = outputFormatSelect.value;
      const quality = parseFloat(jpegQualityInput.value) / 100;
      const canvas = renderFinalCanvas(item, format);
      const ext = format === 'jpeg' ? 'jpg' : format;
      const prefix = filenamePrefixInput.value.trim() || 'watermarked';
      canvas.toBlob(blob => {
        if (!blob) {
          alert(`${format.toUpperCase()} export is not supported by this browser.`);
          return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${prefix}-${stripExt(item.name)}.${ext}`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }, getMimeType(format), format === 'jpeg' || format === 'webp' || format === 'avif' ? quality : undefined);
    };

    function getMimeType(format) {
      return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
    }

    // ---------- Batch ZIP Download ----------
    function updateProgress(done, total, label) {
      const pct = Math.round((done / total) * 100);
      progressFill.style.width = pct + '%';
      progressText.textContent = label || `Processing ${done}/${total} images...`;
    }
    function yieldToBrowser() {
      return new Promise(resolve => {
        if ('requestIdleCallback' in window) window.requestIdleCallback(resolve, { timeout: 100 });
        else setTimeout(resolve, 0);
      });
    }

    downloadAllBtn.addEventListener('click', async () => {
      if (!imagesData.length) return;
      if (config.enablePaywall && imagesData.length > config.freeExportLimit) {
        const proceed = config.paymentUrl ? confirm(`Free exports are limited to ${config.freeExportLimit} images. Open the upgrade page?`) : false;
        if (proceed) window.open(config.paymentUrl, '_blank', 'noopener');
        return;
      }
      downloadAllBtn.disabled = true;
      progressWrap.style.display = 'flex';
      updateProgress(0, imagesData.length, `Rendering frames: 0/${imagesData.length}`);

      const zip = new JSZip();
      const format = outputFormatSelect.value;
      const quality = parseFloat(jpegQualityInput.value) / 100;
      const ext = format === 'jpeg' ? 'jpg' : format;
      const prefix = filenamePrefixInput.value.trim() || 'watermarked';

      try {
        for (let i = 0; i < imagesData.length; i++) {
          const item = imagesData[i];
          const canvas = renderFinalCanvas(item, format);
          const blob = await new Promise(res => canvas.toBlob(res, getMimeType(format), format === 'jpeg' || format === 'webp' || format === 'avif' ? quality : undefined));
          if (!blob) throw new Error(`${format.toUpperCase()} export is not supported by this browser.`);
          zip.file(`${prefix}-${stripExt(item.name)}.${ext}`, blob);
          updateProgress(i + 1, imagesData.length, `Rendering frames: ${i + 1}/${imagesData.length}`);
          await yieldToBrowser();
        }

        updateProgress(0, 1, 'Packaging ZIP archive...');
        const zipBlob = await zip.generateAsync({ type: 'blob' }, (meta) => {
          progressFill.style.width = meta.percent.toFixed(0) + '%';
          progressText.textContent = `Packaging ZIP archive: ${meta.percent.toFixed(0)}%`;
        });
        saveAs(zipBlob, `${prefix}-batch.zip`);
      } catch (error) {
        progressText.textContent = error.message;
        alert(error.message);
      }

      if (progressText.textContent !== 'Export complete' && !progressText.textContent.includes('not supported')) {
        progressText.textContent = 'Export complete';
      }
      setTimeout(() => { progressWrap.style.display = 'none'; downloadAllBtn.disabled = false; }, 700);
    });

    // ---------- Review Modal ----------
    window.openReview = function (index) {
      activeModalIndex = index;
      const item = imagesData[index];
      modalTitle.textContent = `Review & Edit: ${item.name}`;
      mOpacity.value = item.opacity; document.getElementById('mOpacityVal').textContent = item.opacity;
      mScale.value = item.scale; document.getElementById('mScaleVal').textContent = item.scale;
      mRotation.value = item.rotation || 0; document.getElementById('mRotationVal').textContent = item.rotation || 0;
      mPresetPos.value = item.preset;
      mTile.checked = !!item.tile;

      reviewModal.classList.add('active');
      drawModalCanvas();
    };

    function drawModalCanvas() {
      if (activeModalIndex === null) return;
      const item = imagesData[activeModalIndex];
      modalCanvas.width = item.baseImg.naturalWidth;
      modalCanvas.height = item.baseImg.naturalHeight;

      modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
      modalCtx.drawImage(item.baseImg, 0, 0);
      drawWatermarkOnCtx(modalCtx, modalCanvas.width, modalCanvas.height, item);

      if (!item.tile) {
        modalCtx.save();
        modalCtx.strokeStyle = 'rgba(79,70,229,0.85)';
        modalCtx.lineWidth = Math.max(2, modalCanvas.width * 0.002);
        modalCtx.setLineDash([6, 4]);
        modalCtx.strokeRect(item.wmBox.x, item.wmBox.y, item.wmBox.width, item.wmBox.height);
        modalCtx.setLineDash([]);
        const hs = Math.max(16, item.wmBox.width * 0.06);
        modalCtx.fillStyle = '#4f46e5';
        modalCtx.fillRect(item.wmBox.x + item.wmBox.width - hs / 2, item.wmBox.y + item.wmBox.height - hs / 2, hs, hs);
        modalCtx.restore();
      }
    }

    modalClose.addEventListener('click', () => { reviewModal.classList.remove('active'); activeModalIndex = null; });
    reviewModal.addEventListener('click', (e) => {
      if (e.target === reviewModal) {
        reviewModal.classList.remove('active');
        activeModalIndex = null;
      }
    });
    const helpModal = document.getElementById('helpModal');
    document.querySelector('.header-help').addEventListener('click', () => {
      helpModal.classList.add('active');
      helpModal.setAttribute('aria-hidden', 'false');
    });
    document.getElementById('helpClose').addEventListener('click', () => {
      helpModal.classList.remove('active');
      helpModal.setAttribute('aria-hidden', 'true');
    });
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) helpModal.classList.remove('active');
    });
    modalSaveBtn.addEventListener('click', () => { reviewModal.classList.remove('active'); renderGallery(); activeModalIndex = null; });

    modalResetBtn.addEventListener('click', () => {
      if (activeModalIndex === null) return;
      const item = imagesData[activeModalIndex];
      item.opacity = parseFloat(opacitySlider.value);
      item.scale = parseFloat(scaleSlider.value);
      item.rotation = parseFloat(rotationSlider.value);
      item.tile = tileModeCheckbox.checked;
      item.preset = presetSelectPos.value;
      item.wmBox = calculateWmBox(item.baseImg.naturalWidth, item.baseImg.naturalHeight, item.scale, item.preset);

      mOpacity.value = item.opacity; document.getElementById('mOpacityVal').textContent = item.opacity;
      mScale.value = item.scale; document.getElementById('mScaleVal').textContent = item.scale;
      mRotation.value = item.rotation; document.getElementById('mRotationVal').textContent = item.rotation;
      mPresetPos.value = item.preset;
      mTile.checked = item.tile;
      drawModalCanvas();
    });

    mOpacity.addEventListener('input', (e) => {
      if (activeModalIndex === null) return;
      document.getElementById('mOpacityVal').textContent = e.target.value;
      imagesData[activeModalIndex].opacity = parseFloat(e.target.value);
      drawModalCanvas();
    });

    mScale.addEventListener('input', (e) => {
      if (activeModalIndex === null) return;
      const val = parseFloat(e.target.value);
      document.getElementById('mScaleVal').textContent = val;
      const item = imagesData[activeModalIndex];
      item.scale = val;
      item.wmBox = calculateWmBox(item.baseImg.naturalWidth, item.baseImg.naturalHeight, val, item.preset, item.wmBox);
      drawModalCanvas();
    });

    mRotation.addEventListener('input', (e) => {
      if (activeModalIndex === null) return;
      document.getElementById('mRotationVal').textContent = e.target.value;
      imagesData[activeModalIndex].rotation = parseFloat(e.target.value);
      drawModalCanvas();
    });

    mTile.addEventListener('change', (e) => {
      if (activeModalIndex === null) return;
      imagesData[activeModalIndex].tile = e.target.checked;
      drawModalCanvas();
    });

    mPresetPos.addEventListener('change', (e) => {
      if (activeModalIndex === null) return;
      const item = imagesData[activeModalIndex];
      item.preset = e.target.value;
      if (item.preset !== 'custom') {
        item.wmBox = calculateWmBox(item.baseImg.naturalWidth, item.baseImg.naturalHeight, item.scale, item.preset);
      }
      drawModalCanvas();
    });

    // ---------- Modal Canvas Dragging & Resizing (mouse + touch) ----------
    function getModalCoords(e) {
      const rect = modalCanvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * (modalCanvas.width / rect.width),
        y: (clientY - rect.top) * (modalCanvas.height / rect.height)
      };
    }

    function handlePointerDown(e) {
      if (activeModalIndex === null) return;
      const item = imagesData[activeModalIndex];
      const box = item.wmBox;
      const pos = getModalCoords(e);
      const hs = Math.max(16, box.width * 0.06);
      const hx = box.x + box.width, hy = box.y + box.height;

      if (!item.tile && Math.abs(pos.x - hx) <= hs && Math.abs(pos.y - hy) <= hs) {
        modalResizing = true;
        e.preventDefault();
        return;
      }
      if (pos.x >= box.x && pos.x <= box.x + box.width && pos.y >= box.y && pos.y <= box.y + box.height) {
        modalDragging = true;
        modalDragOffset.x = pos.x - box.x;
        modalDragOffset.y = pos.y - box.y;
        item.preset = 'custom';
        mPresetPos.value = 'custom';
        e.preventDefault();
      }
    }

    function handlePointerMove(e) {
      if (activeModalIndex === null || (!modalDragging && !modalResizing)) return;
      e.preventDefault();
      const item = imagesData[activeModalIndex];
      const pos = getModalCoords(e);

      if (modalResizing) {
        let newH = Math.max(10, Math.min(item.baseImg.naturalHeight - item.wmBox.y, pos.y - item.wmBox.y));
        let newW;
        if (wmConfig.mode === 'image' && wmConfig.wmImg) {
          newW = newH * (wmConfig.wmImg.naturalWidth / wmConfig.wmImg.naturalHeight);
        } else {
          const box = measureTextBox(wmConfig.text.content, newH / 1.3, wmConfig.text.font, wmConfig.text.bold, wmConfig.text.italic);
          newW = box.width; newH = box.height;
        }
        if (item.wmBox.x + newW > item.baseImg.naturalWidth) {
          newW = item.baseImg.naturalWidth - item.wmBox.x;
          if (wmConfig.mode === 'image' && wmConfig.wmImg) newH = newW * (wmConfig.wmImg.naturalHeight / wmConfig.wmImg.naturalWidth);
        }
        item.wmBox.width = newW;
        item.wmBox.height = newH;
        const newScale = Math.min(80, Math.max(5, (newW / modalCanvas.width) * 100));
        item.scale = newScale;
        mScale.value = newScale.toFixed(0);
        document.getElementById('mScaleVal').textContent = newScale.toFixed(0);
        drawModalCanvas();
        return;
      }

      item.wmBox.x = Math.max(0, Math.min(item.baseImg.naturalWidth - item.wmBox.width, pos.x - modalDragOffset.x));
      item.wmBox.y = Math.max(0, Math.min(item.baseImg.naturalHeight - item.wmBox.height, pos.y - modalDragOffset.y));
      drawModalCanvas();
    }

    function handlePointerUp() { modalDragging = false; modalResizing = false; }

    modalCanvas.addEventListener('mousedown', handlePointerDown);
    modalCanvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && reviewModal.classList.contains('active')) {
        reviewModal.classList.remove('active');
        activeModalIndex = null;
      }
    });

    // ---------- Init ----------
    updateUIState();
