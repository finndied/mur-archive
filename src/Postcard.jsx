import React, { useEffect, useRef, useState } from 'react';
import { Download, Heart, PawPrint, Sparkles, Stamp, X } from 'lucide-react';
import './postcard.css';

const themes = [
  { id: 'lilac', label: 'Сирень', light: '#f3e8ff', paper: '#dac2ff', ink: '#44286c', accent: '#e6f4a1' },
  { id: 'matcha', label: 'Матча', light: '#f2f7da', paper: '#d3e4a3', ink: '#344a2b', accent: '#ffcedc' },
  { id: 'peach', label: 'Персик', light: '#fff1e4', paper: '#f8c5b0', ink: '#67384c', accent: '#e1d0ff' },
];
const seals = [
  { id: 'paw', label: 'Лапка', icon: PawPrint },
  { id: 'heart', label: 'Сердце', icon: Heart },
  { id: 'spark', label: 'Искра', icon: Sparkles },
  { id: 'none', label: 'Без стикера', icon: X },
];
const width = 1080;
const height = 1350;

function rounded(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function cropPhoto(ctx, image, focus) {
  const frame = { x: 85, y: 183, w: 910, h: 855 };
  const scale = Math.max(frame.w / image.naturalWidth, frame.h / image.naturalHeight);
  const sw = frame.w / scale;
  const sh = frame.h / scale;
  const [fx, fy] = focus.split(' ').map((value) => Number.parseFloat(value) / 100);
  ctx.save();
  ctx.shadowColor = '#29143d45';
  ctx.shadowBlur = 29;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#fffcf6';
  rounded(ctx, frame.x - 13, frame.y - 13, frame.w + 26, frame.h + 26, 34);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rounded(ctx, frame.x, frame.y, frame.w, frame.h, 24);
  ctx.clip();
  ctx.drawImage(image, (image.naturalWidth - sw) * fx, (image.naturalHeight - sh) * fy, sw, sh, frame.x, frame.y, frame.w, frame.h);
  ctx.restore();
}

function drawSeal(ctx, seal, theme) {
  if (seal === 'none') return;
  ctx.save();
  ctx.translate(891, 1017);
  ctx.rotate(0.18);
  ctx.fillStyle = theme.accent;
  ctx.shadowColor = '#29143d4a';
  ctx.shadowBlur = 17;
  ctx.shadowOffsetY = 9;
  rounded(ctx, -88, -88, 176, 176, 54);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 3;
  rounded(ctx, -73, -73, 146, 146, 44);
  ctx.stroke();
  ctx.fillStyle = theme.ink;
  switch (seal) {
    case 'paw':
      for (const [x, y, angle] of [[-36, -10, -0.6], [-13, -30, -0.14], [13, -30, 0.14], [36, -10, 0.6]]) {
        ctx.beginPath();
        ctx.ellipse(x, y, 9, 13, angle, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fill(new Path2D('M0 -8 C-13 -8 -16 4 -30 15 C-45 29 -32 45 -17 39 C-6 34 6 34 17 39 C32 45 45 29 30 15 C16 4 13 -8 0 -8 Z'));
      break;
    case 'heart':
      ctx.fill(new Path2D('M0 41 C-12 30 -46 8 -46 -15 C-46 -42 -14 -48 0 -26 C14 -48 46 -42 46 -15 C46 8 12 30 0 41 Z'));
      break;
    case 'spark':
      ctx.fill(new Path2D('M0 -47 Q8 -8 47 0 Q8 8 0 47 Q-8 8 -47 0 Q-8 -8 0 -47 Z'));
      break;
  }
  ctx.restore();
}

function drawCaption(ctx, caption) {
  const words = caption.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return;
  const text = words.join(' ');
  const max = 850;
  const setFont = (size) => { ctx.font = `800 ${size}px "Manrope Variable", sans-serif`; };
  let size = 65;
  setFont(size);
  if (ctx.measureText(text).width <= max) {
    ctx.fillText(text, 85, 1170);
    return;
  }
  const lines = [''];
  for (const word of words) {
    const i = lines.length - 1;
    const combined = lines[i] ? `${lines[i]} ${word}` : word;
    if (i === 0 && lines[i] && ctx.measureText(combined).width > max) lines.push(word);
    else lines[i] = combined;
  }
  while (size > 24 && lines.some((line) => ctx.measureText(line).width > max)) {
    size -= 1;
    setFont(size);
  }
  lines.forEach((line, i) => ctx.fillText(line, 85, 1158 + i * 66, max));
}

function drawPostcard(canvas, { image, focus, theme, seal, caption }) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, theme.light);
  gradient.addColorStop(1, theme.paper);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.38;
  ctx.setLineDash([6, 10]);
  rounded(ctx, 36, 36, width - 72, height - 72, 29);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = theme.ink;
  ctx.font = '750 40px "Unbounded Variable", sans-serif';
  ctx.fillText('Мур.почта', 85, 120);
  ctx.lineWidth = 3;
  for (const offset of [0, 13, 26]) {
    ctx.strokeStyle = theme.ink;
    ctx.beginPath();
    ctx.moveTo(873, 87 + offset);
    ctx.bezierCurveTo(914, 68 + offset, 950, 104 + offset, 995, 87 + offset);
    ctx.stroke();
  }

  if (image) {
    cropPhoto(ctx, image, focus);
    drawSeal(ctx, seal, theme);
  }

  ctx.fillStyle = theme.ink;
  drawCaption(ctx, caption);
  ctx.font = '800 23px "Manrope Variable", sans-serif';
  ctx.fillText('ИЗ МУР.АРХИВА', 85, 1281);
}

export default function Postcard({ photos, photo, draft, onChange, onCommit, ready, syncError }) {
  const theme = themes.find(({ id }) => id === draft.theme) ?? themes[0];
  const { seal, caption } = draft;
  const [loaded, setLoaded] = useState(null);
  const [fontReady, setFontReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const canvas = useRef(null);
  const film = useRef(null);
  const image = loaded?.src === photo.src ? loaded.image : null;

  useEffect(() => {
    const picture = new Image();
    picture.crossOrigin = 'anonymous';
    picture.onload = () => setLoaded({ src: photo.src, image: picture });
    picture.onerror = () => setLoaded({ src: photo.src, image: null });
    picture.src = photo.src;
    return () => { picture.onload = null; picture.onerror = null; };
  }, [photo.id, photo.src]);

  useEffect(() => {
    let current = true;
    if (!document.fonts) return;
    document.fonts.ready.then(() => { if (current) setFontReady(true); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    drawPostcard(canvas.current, { image, focus: photo.focus, theme, seal, caption });
  }, [image, photo.focus, theme, seal, caption, fontReady]);

  useEffect(() => { setFeedback(''); }, [photo.id, theme, seal, caption]);

  useEffect(() => {
    const strip = film.current;
    const selected = strip.querySelector('[aria-pressed="true"]');
    const bounds = strip.getBoundingClientRect();
    const item = selected.getBoundingClientRect();
    if (item.right > bounds.right) strip.scrollLeft += item.right - bounds.right + 3;
    if (item.left < bounds.left) strip.scrollLeft -= bounds.left - item.left + 3;
  }, [photo.id, photos.length]);

  function download() {
    if (!image || saving) return;
    setSaving(true);
    setFeedback('');
    drawPostcard(canvas.current, { image, focus: photo.focus, theme, seal, caption });
    canvas.current.toBlob((blob) => {
      setSaving(false);
      if (!blob) {
        setFeedback('Не удалось сохранить картинку. Попробуйте ещё раз.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mur-postcard-${photo.id}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
      setFeedback('Открытка отправлена в загрузки.');
    }, 'image/png');
  }

  const imageFailed = loaded?.src === photo.src && !image;
  return (
    <section className="postcard shell" id="postcard" aria-labelledby="postcard-title">
      <header className="postcard-header">
        <div className="section-kicker"><Stamp size={18} /> Фотобудка</div>
        <h2 id="postcard-title" tabIndex={-1}>Мур.почта<span> ✦</span></h2>
        <p>Сделайте открытку с Джузо и Моти. Выберите кадр, добавьте пару слов и сохраните картинку.</p>
      </header>

      <div className="postcard-preview" style={{ '--postcard-paper': theme.paper }}>
        <canvas ref={canvas} width={width} height={height} role="img" aria-label={`Предпросмотр открытки. ${photo.title}. ${caption}`} />
        {!image && <span className="postcard-loading" role="status">{imageFailed ? 'Этот кадр не загрузился. Выберите другой.' : 'Загружаем кадр…'}</span>}
      </div>

      <div className="postcard-editor">
        <fieldset className="postcard-field" disabled={!ready}>
          <legend>Кадр</legend>
          <div className="postcard-film" ref={film}>
            {photos.map((item) => (
              <button type="button" key={item.id} aria-label={item.title} aria-pressed={photo.id === item.id} onClick={() => onChange('photoId', item.id)}>
                <img src={item.src} alt="" width="72" height="72" loading="lazy" style={{ objectPosition: item.focus }} />
              </button>
            ))}
          </div>
        </fieldset>
        <label className="postcard-field postcard-caption">
          <span>Подпись</span>
          <input type="text" maxLength={42} value={caption} disabled={!ready} onChange={(event) => onChange('caption', event.target.value)} onBlur={onCommit} placeholder="Ваши слова" />
        </label>
        <div className="postcard-options">
          <fieldset className="postcard-field" disabled={!ready}>
            <legend>Бумага</legend>
            <div className="postcard-swatches">
              {themes.map((item) => <button type="button" key={item.id} aria-label={item.label} title={item.label} aria-pressed={theme.id === item.id} onClick={() => onChange('theme', item.id)} style={{ '--swatch': item.paper }} />)}
            </div>
          </fieldset>
          <fieldset className="postcard-field" disabled={!ready}>
            <legend>Стикер</legend>
            <div className="postcard-seals">
              {seals.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-label={label} title={label} aria-pressed={seal === id} onClick={() => onChange('seal', id)}><Icon size={18} /></button>)}
            </div>
          </fieldset>
        </div>
        <div className="postcard-export">
          <button type="button" className="postcard-download" onClick={download} disabled={!image || saving || !ready}><Download size={18} /> {saving ? 'Сохраняем…' : 'Скачать PNG'}</button>
          <p className="postcard-feedback" role="status">{feedback}</p>
        </div>
        {syncError && <p className="postcard-feedback" role="status">{syncError}</p>}
      </div>
    </section>
  );
}
