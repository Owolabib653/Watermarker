import { useEffect, useRef, useState } from 'react';
import { Download, FileImage, FolderOpen, HelpCircle, ImagePlus, Layers3, LockKeyhole, RotateCcw, Save, Settings2, Sparkles, Trash2, Type, Upload, X } from 'lucide-react';
import { zipSync } from 'fflate';

const positions = [
  ['bottom-right', 'Bottom-right'], ['bottom-center', 'Bottom-center'], ['bottom-left', 'Bottom-left'], ['top-right', 'Top-right'], ['top-center', 'Top-center'], ['top-left', 'Top-left'], ['center', 'Center'], ['custom', 'Custom position']
];
const defaultText = { content: '© Your Brand', font: 'Arial', color: '#ffffff', bold: true, italic: false, strokeColor: '#000000', strokeWidth: 0, shadowBlur: 0 };
const defaultSettings = { mode: 'image', opacity: .75, scale: 25, rotation: 0, position: 'bottom-right', customPosition: { x: .5, y: .5 }, tile: false, outputFormat: 'jpeg', quality: 95, prefix: 'watermarked', text: defaultText };

function readImage(file) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file).then(image => ({ url: null, image, width: image.width, height: image.height }));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ url, image, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not load ${file.name}`)); };
    image.src = url;
  });
}

function stripExt(name) { return name.replace(/\.[^/.]+$/, ''); }
function makeBox(width, height, scale, position, markRatio = .18, customPosition = defaultSettings.customPosition) {
  const markWidth = width * scale / 100;
  const markHeight = markWidth * markRatio;
  const pad = width * .03;
  const x = position === 'custom' ? customPosition.x * width - markWidth / 2 : position.includes('left') ? pad : position.includes('right') ? width - markWidth - pad : (width - markWidth) / 2;
  const y = position === 'custom' ? customPosition.y * height - markHeight / 2 : position.includes('top') ? pad : position.includes('bottom') ? height - markHeight - pad : (height - markHeight) / 2;
  return { x, y, width: markWidth, height: markHeight };
}

function Preview({ item, settings, watermark, onClick, onPointerDown, onPointerMove, onPointerUp }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !item.image) return;
    const max = 520;
    const width = item.width || item.image.naturalWidth;
    const height = item.height || item.image.naturalHeight;
    const ratio = Math.min(1, max / Math.max(width, height));
    canvas.width = Math.max(1, width * ratio);
    canvas.height = Math.max(1, height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(item.image, 0, 0, canvas.width, canvas.height);
    if (settings.mode === 'image' && watermark) {
      const watermarkWidth = watermark.width || watermark.naturalWidth;
      const watermarkHeight = watermark.height || watermark.naturalHeight;
      const box = makeBox(canvas.width, canvas.height, item.scale, item.position, watermarkHeight / watermarkWidth, item.customPosition);
      ctx.save(); ctx.globalAlpha = item.opacity; ctx.translate(box.x + box.width / 2, box.y + box.height / 2); ctx.rotate(item.rotation * Math.PI / 180); ctx.drawImage(watermark, -box.width / 2, -box.height / 2, box.width, box.height); ctx.restore();
    } else if (settings.mode === 'text' && item.text.content.trim()) {
      const box = makeBox(canvas.width, canvas.height, item.scale, item.position, .18, item.customPosition);
      ctx.save(); ctx.globalAlpha = item.opacity; ctx.translate(box.x + box.width / 2, box.y + box.height / 2); ctx.rotate(item.rotation * Math.PI / 180);
      ctx.font = `${item.text.italic ? 'italic ' : ''}${item.text.bold ? 'bold ' : ''}${box.height / 1.3}px ${item.text.font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = item.text.color; ctx.strokeStyle = item.text.strokeColor; ctx.lineWidth = item.text.strokeWidth; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = item.text.shadowBlur;
      const value = item.text.content.replaceAll('{filename}', stripExt(item.name)).replaceAll('{year}', String(new Date().getFullYear())).replaceAll('{date}', new Date().toISOString().slice(0, 10));
      if (item.text.strokeWidth) ctx.strokeText(value, 0, 0); ctx.fillText(value, 0, 0); ctx.restore();
    }
  }, [item, settings, watermark]);
  return <canvas ref={ref} onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} aria-label={`Preview of ${item.name}`} />;
}

function Range({ label, value, suffix = '', min, max, step, onChange }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), 50);
    return () => clearTimeout(t);
  }, [local, onChange, value]);
  return <label className="field range-field"><span>{label}<b>{local}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={local} onChange={e => setLocal(Number(e.target.value))} /></label>;
}

function App() {
  const [settings, setSettings] = useState(defaultSettings);
  const [items, setItems] = useState([]);
  const [watermark, setWatermark] = useState(null);
  const [watermarkFile, setWatermarkFile] = useState(null);
  const [presets, setPresets] = useState(() => JSON.parse(localStorage.getItem('pixelguard-presets') || '[]'));
  const [presetName, setPresetName] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [progress, setProgress] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const dragging = useRef(false);
  const baseInput = useRef(null);
  const wmInput = useRef(null);
  const active = items.find(item => item.id === activeId);
  const hasMark = settings.mode === 'image' ? Boolean(watermark) : Boolean(settings.text.content.trim());

  const patchSettings = patch => setSettings(current => ({ ...current, ...patch }));
  const addFiles = async fileList => {
    const promises = [...fileList].filter(file => file.type.startsWith('image/')).map(async file => {
      try {
        const { url, image, width, height } = await readImage(file);
        return { id: crypto.randomUUID(), file, url, image, width, height, name: file.name, ...settings, text: { ...settings.text } };
      } catch (err) {
        console.error('Failed to load image:', file.name, err);
        return null;
      }
    });
    const loaded = (await Promise.all(promises)).filter(Boolean);
    setItems(current => [...current, ...loaded]);
  };
  const applyAll = () => setItems(current => current.map(item => ({ ...item, ...settings, text: { ...settings.text }, wmBox: undefined })));
  const remove = id => setItems(current => {
    const item = current.find(i => i.id === id);
    if (item) URL.revokeObjectURL(item.url);
    return current.filter(i => i.id !== id);
  });
  const clear = () => { items.forEach(item => URL.revokeObjectURL(item.url)); setItems([]); };
  const savePreset = () => { if (!presetName.trim()) return; const next = [...presets, { name: presetName.trim(), settings, watermarkFile }]; setPresets(next); localStorage.setItem('pixelguard-presets', JSON.stringify(next.map(({ watermarkFile: _, ...preset }) => preset))); setPresetName(''); };
  const updateItem = (id, patch) => setItems(current => current.map(item => item.id === id ? { ...item, ...patch, text: patch.text || item.text } : item));
  const watermarkRatio = watermark ? (watermark.height || watermark.naturalHeight) / (watermark.width || watermark.naturalWidth) : .18;
  const getCanvasPoint = event => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (event.currentTarget.width / rect.width), y: (event.clientY - rect.top) * (event.currentTarget.height / rect.height) };
  };
  const beginDrag = event => {
    if (!active || active.tile) return;
    const point = getCanvasPoint(event);
    const box = makeBox(event.currentTarget.width, event.currentTarget.height, active.scale, active.position, watermarkRatio, active.customPosition);
    if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) {
      dragging.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updateItem(active.id, { position: 'custom' });
    }
  };
  const moveDrag = event => {
    if (!dragging.current || !active) return;
    const point = getCanvasPoint(event);
    const box = makeBox(event.currentTarget.width, event.currentTarget.height, active.scale, 'custom', watermarkRatio, active.customPosition);
    const x = Math.max(box.width / 2, Math.min(event.currentTarget.width - box.width / 2, point.x));
    const y = Math.max(box.height / 2, Math.min(event.currentTarget.height - box.height / 2, point.y));
    updateItem(active.id, { position: 'custom', customPosition: { x: x / event.currentTarget.width, y: y / event.currentTarget.height } });
  };
  const endDrag = () => { dragging.current = false; };

  const exportBatch = async () => {
    if (!items.length || !hasMark) return;
    setProgress({ completed: 0, total: items.length, label: 'Rendering images...' });
    
    const concurrency = Math.min(navigator.hardwareConcurrency || 4, 8);
    const workers = Array.from({ length: concurrency }, () => new Worker(new URL('./export.worker.js', import.meta.url), { type: 'module' }));
    
    const files = {};
    let completed = 0;
    let index = 0;
    
    const processNext = (worker) => {
      if (index >= items.length) return Promise.resolve();
      const item = items[index++];
      return new Promise((resolve, reject) => {
        const handle = event => {
          if (event.data.id !== item.id) return;
          worker.removeEventListener('message', handle);
          if (event.data.error) reject(new Error(event.data.error));
          else resolve([item, event.data.blob]);
        };
        worker.addEventListener('message', handle);
        worker.postMessage({ file: item.file, watermarkFile: settings.mode === 'image' ? watermarkFile : null, item: { ...item, ...settings, text: settings.text }, outputFormat: settings.outputFormat, quality: settings.quality / 100 });
      }).then(async ([processedItem, blob]) => {
        files[`${settings.prefix || 'watermarked'}-${stripExt(processedItem.name)}.${settings.outputFormat === 'jpeg' ? 'jpg' : settings.outputFormat}`] = new Uint8Array(await blob.arrayBuffer());
        completed += 1;
        setProgress({ completed, total: items.length, label: `Rendered ${completed}/${items.length}` });
        return processNext(worker);
      });
    };

    try {
      await Promise.all(workers.map(worker => processNext(worker)));
      setProgress({ completed: items.length, total: items.length, label: 'Zipping files...' });
      const archive = zipSync(files, { level: 6 });
      const url = URL.createObjectURL(new Blob([archive], { type: 'application/zip' }));
      const link = document.createElement('a'); link.href = url; link.download = `${settings.prefix || 'watermarked'}-batch.zip`; link.click(); URL.revokeObjectURL(url);
      setProgress({ completed: items.length, total: items.length, label: 'Export complete' });
    } catch (error) {
      setProgress({ completed: 0, total: items.length, label: error.message });
    } finally {
      workers.forEach(w => w.terminate());
      setTimeout(() => setProgress(null), 1600);
    }
  };
  const downloadOne = async item => {
    const worker = new Worker(new URL('./export.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.error) { worker.terminate(); return; }
      const url = URL.createObjectURL(data.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${settings.prefix || 'watermarked'}-${stripExt(item.name)}.${settings.outputFormat === 'jpeg' ? 'jpg' : settings.outputFormat}`;
      link.click();
      URL.revokeObjectURL(url);
      worker.terminate();
    };
    worker.postMessage({ file: item.file, watermarkFile: settings.mode === 'image' ? watermarkFile : null, item: { ...item, ...settings, text: item.text }, outputFormat: settings.outputFormat, quality: settings.quality / 100 });
  };

  return <div className="app-shell" onDragOver={e => e.preventDefault()} onDrop={e => { if (!e.target.closest('input, .dropzone')) addFiles(e.dataTransfer.files); }}>
    <header className="topbar"><div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>PixelGuard <em>PRO</em></strong><span>Private batch watermark studio</span></div></div><div className="top-actions"><span className="privacy"><span className="status-dot" /> Files stay on your device</span><button className="icon-button" onClick={() => setHelpOpen(true)} title="Open help"><HelpCircle size={18} /></button></div></header>
    <div className="workspace">
      <aside className="sidebar"><div className="intro"><small>WORKSPACE</small><h1>Protect your work</h1><p>Set your brand layer once, then apply it to every asset.</p></div>
        <section><h2><span>01</span> Assets & watermark</h2><div className="dropzone" onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files); }}><input ref={baseInput} type="file" accept="image/*" multiple onChange={e => { addFiles(e.target.files); e.target.value = ''; }} /><Upload size={20} /><strong>Choose or drop images</strong><small>JPG, PNG, WebP, AVIF</small></div>
          <div className="segmented"><button className={settings.mode === 'image' ? 'selected' : ''} onClick={() => patchSettings({ mode: 'image' })}><FileImage size={15} /> Logo</button><button className={settings.mode === 'text' ? 'selected' : ''} onClick={() => patchSettings({ mode: 'text' })}><Type size={15} /> Text</button></div>
          {settings.mode === 'image' ? <div className="file-control"><button className="outline-button" onClick={() => wmInput.current?.click()}><ImagePlus size={15} /> {watermark ? watermark.name : 'Choose watermark PNG'}</button><input ref={wmInput} hidden type="file" accept="image/png,image/webp" onChange={async e => { const file = e.target.files?.[0]; if (file) { setWatermarkFile(file); setWatermark(await readImage(file).then(result => result.image)); } }} /></div> : <div className="stack"><label className="field"><span>Watermark text</span><input value={settings.text.content} onChange={e => patchSettings({ text: { ...settings.text, content: e.target.value } })} /></label><label className="field"><span>Font</span><select value={settings.text.font} onChange={e => patchSettings({ text: { ...settings.text, font: e.target.value } })}><option>Arial</option><option>Georgia</option><option>Impact</option><option>Verdana</option><option>Courier New</option></select></label><div className="inline-fields"><input type="color" value={settings.text.color} onChange={e => patchSettings({ text: { ...settings.text, color: e.target.value } })} /><label className="check"><input type="checkbox" checked={settings.text.bold} onChange={e => patchSettings({ text: { ...settings.text, bold: e.target.checked } })} /> Bold</label><label className="check"><input type="checkbox" checked={settings.text.italic} onChange={e => patchSettings({ text: { ...settings.text, italic: e.target.checked } })} /> Italic</label></div><Range label="Stroke" value={settings.text.strokeWidth} suffix="px" min="0" max="12" step="1" onChange={strokeWidth => patchSettings({ text: { ...settings.text, strokeWidth } })} /><Range label="Shadow blur" value={settings.text.shadowBlur} suffix="px" min="0" max="40" step="1" onChange={shadowBlur => patchSettings({ text: { ...settings.text, shadowBlur } })} /></div>}
        </section>
        <section><h2><span>02</span> Global adjustments</h2><Range label="Opacity" value={settings.opacity} min=".1" max="1" step=".05" onChange={opacity => patchSettings({ opacity })} /><Range label="Scale" value={settings.scale} suffix="%" min="5" max="80" step="1" onChange={scale => patchSettings({ scale })} /><Range label="Rotation" value={settings.rotation} suffix="°" min="-180" max="180" step="1" onChange={rotation => patchSettings({ rotation })} /><label className="field"><span>Alignment preset</span><select value={settings.position} onChange={e => patchSettings({ position: e.target.value })}>{positions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="toggle"><span>Tile watermark</span><input type="checkbox" checked={settings.tile} onChange={e => patchSettings({ tile: e.target.checked })} /></label></section>
        <section><h2><span>03</span> Output settings</h2><label className="field"><span>File format</span><select value={settings.outputFormat} onChange={e => patchSettings({ outputFormat: e.target.value })}><option value="png">PNG (lossless)</option><option value="jpeg">JPEG</option><option value="webp">WebP</option><option value="avif">AVIF</option></select></label>{settings.outputFormat !== 'png' && <Range label="Quality" value={settings.quality} suffix="%" min="10" max="100" step="5" onChange={quality => patchSettings({ quality })} />}<label className="field"><span>Filename prefix</span><input value={settings.prefix} onChange={e => patchSettings({ prefix: e.target.value })} /></label></section>
        <section><h2><span>04</span> Presets</h2><div className="preset-row"><input placeholder="Preset name" value={presetName} onChange={e => setPresetName(e.target.value)} /><button className="square-button" onClick={savePreset} title="Save preset"><Save size={16} /></button></div><select value="" onChange={e => { const preset = presets[Number(e.target.value)]; if (preset) setSettings(preset.settings); }}><option value="">Load a preset</option>{presets.map((preset, index) => <option value={index} key={`${preset.name}-${index}`}>{preset.name}</option>)}</select></section>
        <button className="primary-button" disabled={!items.length || !hasMark} onClick={applyAll}><Layers3 size={16} /> Apply settings to all</button>
      </aside>
      <main className="content"><div className="heading-row"><div><small>BATCH STUDIO</small><h2>Watermark your images</h2></div><span className="secure"><LockKeyhole size={14} /> Local processing</span></div><div className="insights"><div><Sparkles size={17} /><span><strong>Batch ready</strong>20+ assets at once</span></div><div><Settings2 size={17} /><span><strong>Pixel perfect</strong>Full-resolution exports</span></div><div><LockKeyhole size={17} /><span><strong>100% private</strong>No uploads or tracking</span></div></div><div className="toolbar"><span className="count">{items.length} image{items.length === 1 ? '' : 's'} loaded</span><div><button className="outline-button" disabled={!items.length} onClick={clear}><Trash2 size={15} /> Clear all</button><button className="export-button" disabled={!items.length || !hasMark || progress} onClick={exportBatch}><Download size={15} /> Download ZIP</button></div>{progress && <div className="progress"><div><span>{progress.label}</span><b>{Math.round(progress.completed / progress.total * 100)}%</b></div><progress max={progress.total} value={progress.completed} /></div>}</div><div className="gallery">{!items.length ? <div className="empty"><div><FolderOpen size={23} /></div><h3>Your canvas is ready</h3><p>Drop product shots, portfolio images, or social content here to get started.</p><button className="primary-button" onClick={() => baseInput.current?.click()}><Upload size={15} /> Choose images</button><small>Processed locally in your browser</small></div> : items.map(item => <article className="image-card" key={item.id}><div className="preview-wrap"><Preview item={item} settings={item} watermark={watermark} onClick={() => setActiveId(item.id)} /></div><div className="card-meta"><strong title={item.name}>{item.name}</strong><div><button onClick={() => setActiveId(item.id)}>Edit</button><button onClick={() => downloadOne(item)}><Download size={13} /> Save</button><button className="danger" onClick={() => remove(item.id)}><X size={14} /></button></div></div></article>)}</div></main>
    </div>
    {active && <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && setActiveId(null)}><div className="dialog"><header><div><small>INDIVIDUAL REVIEW</small><h2>{active.name}</h2></div><button className="icon-button" onClick={() => setActiveId(null)}><X size={18} /></button></header><div className="dialog-body"><div className="large-preview"><Preview item={active} settings={active} watermark={watermark} onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} /></div><div className="dialog-controls"><p className="drag-hint">Drag the watermark directly on the preview to place it. Bottom-center is available in the alignment menu.</p><Range label="Opacity" value={active.opacity} min=".1" max="1" step=".05" onChange={opacity => updateItem(active.id, { opacity })} /><Range label="Scale" value={active.scale} suffix="%" min="5" max="80" step="1" onChange={scale => updateItem(active.id, { scale })} /><Range label="Rotation" value={active.rotation} suffix="°" min="-180" max="180" step="1" onChange={rotation => updateItem(active.id, { rotation })} /><label className="field"><span>Alignment preset</span><select value={active.position} onChange={e => updateItem(active.id, { position: e.target.value })}>{positions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="toggle"><span>Tile watermark</span><input type="checkbox" checked={active.tile} onChange={e => updateItem(active.id, { tile: e.target.checked })} /></label></div></div><footer><button className="outline-button" onClick={() => updateItem(active.id, { ...settings, customPosition: active.customPosition })}><RotateCcw size={15} /> Reset to global</button><button className="primary-button" onClick={() => setActiveId(null)}>Done</button></footer></div></div>}
    {helpOpen && <div className="dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && setHelpOpen(false)}><div className="dialog help"><header><div><small>PIXELGUARD GUIDE</small><h2>Work faster, stay private</h2></div><button className="icon-button" onClick={() => setHelpOpen(false)}><X size={18} /></button></header><div className="help-copy"><p><strong>Add assets</strong> Drop images anywhere in the workspace or choose them from your device.</p><p><strong>Set your brand layer</strong> Use a logo or text watermark, then adjust opacity, scale, position, and style.</p><p><strong>Review and export</strong> Fine-tune individual images, then download PNG, JPEG, WebP, or AVIF files in a ZIP.</p><p><strong>Privacy</strong> Everything is processed locally. Presets stay in this browser.</p></div></div></div>}
  </div>;
}

export default App;
