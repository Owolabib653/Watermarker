function stripExt(name) {
  return name.replace(/\.[^/.]+$/, '');
}

function fontString(size, text) {
  return `${text.italic ? 'italic ' : ''}${text.bold ? 'bold ' : ''}${size}px ${text.font}`;
}

function drawMark(ctx, canvas, item, watermark, text) {
  const hasImage = watermark;
  const hasText = text.content.trim();
  if (!hasImage && !hasText) return;
  const width = item.scale / 100 * canvas.width;
  const height = hasImage ? watermark.height / watermark.width * width : width * 0.16;
  const pad = canvas.width * 0.03;
  let x = canvas.width - width - pad;
  let y = canvas.height - height - pad;
  if (item.position === 'custom' && item.customPosition) {
    x = item.customPosition.x * canvas.width - width / 2;
    y = item.customPosition.y * canvas.height - height / 2;
  }
  if (item.position === 'top-left') [x, y] = [pad, pad];
  if (item.position === 'top-right') y = pad;
  if (item.position === 'bottom-left') x = pad;
  if (item.position === 'center') [x, y] = [(canvas.width - width) / 2, (canvas.height - height) / 2];
  const paint = (px, py) => {
    ctx.save();
    ctx.translate(px + width / 2, py + height / 2);
    ctx.rotate(item.rotation * Math.PI / 180);
    if (hasImage) ctx.drawImage(watermark, -width / 2, -height / 2, width, height);
    else {
      ctx.font = fontString(height / 1.3, text);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = text.color; ctx.strokeStyle = text.strokeColor;
      ctx.lineWidth = text.strokeWidth; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = text.shadowBlur;
      const value = text.content.replaceAll('{filename}', stripExt(item.name)).replaceAll('{year}', String(new Date().getFullYear())).replaceAll('{date}', new Date().toISOString().slice(0, 10));
      if (text.strokeWidth) ctx.strokeText(value, 0, 0);
      ctx.fillText(value, 0, 0);
    }
    ctx.restore();
  };
  ctx.globalAlpha = item.opacity;
  if (item.tile) {
    for (let row = -2; row < canvas.height / height + 2; row += 1) {
      for (let col = -2; col < canvas.width / width + 2; col += 1) paint(col * width * 1.8, row * height * 1.8);
    }
  } else paint(x, y);
  ctx.globalAlpha = 1;
}

self.onmessage = async ({ data }) => {
  try {
    const { file, watermarkFile, item, outputFormat, quality } = data;
    const source = await createImageBitmap(file);
    const watermark = watermarkFile ? await createImageBitmap(watermarkFile) : null;
    const canvas = new OffscreenCanvas(source.width, source.height);
    const ctx = canvas.getContext('2d');
    if (outputFormat === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(source, 0, 0);
    drawMark(ctx, canvas, item, watermark, item.text);
    const blob = await canvas.convertToBlob({ type: `image/${outputFormat}`, quality });
    self.postMessage({ id: item.id, blob });
  } catch (error) {
    self.postMessage({ id: data.item.id, error: error.message });
  }
};
