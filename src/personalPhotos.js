import { useEffect, useRef, useState } from 'react';

const databaseName = 'mur-archive-photos';
const storeName = 'photos';
const maxPhotoEdge = 1600;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function photoTransaction(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(request?.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

async function preparePhoto(file) {
  if (file.type && !file.type.startsWith('image/')) throw new Error('Unsupported file');
  const temporaryUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = temporaryUrl;
    await image.decode();
    const scale = Math.min(1, maxPhotoEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#faf8f2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Photo encoding failed');
    const title = file.name.replace(/\.[^.]+$/, '').trim().slice(0, 72) || 'Моя фотография';
    return {
      id: `custom-${crypto.randomUUID()}`,
      kind: 'custom',
      title,
      alt: `Добавленная фотография — ${title}`,
      focus: '50% 50%',
      width: canvas.width,
      height: canvas.height,
      createdAt: Date.now(),
      blob,
    };
  } finally {
    URL.revokeObjectURL(temporaryUrl);
  }
}

export function usePersonalPhotos() {
  const [personalPhotos, setPersonalPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const current = useRef(false);
  const objectUrls = useRef(new Set());

  function createView({ blob, ...photo }) {
    const src = URL.createObjectURL(blob);
    objectUrls.current.add(src);
    return { ...photo, src };
  }

  useEffect(() => {
    current.current = true;
    let cancelled = false;
    async function load() {
      try {
        const rows = await photoTransaction('readonly', (store) => store.getAll());
        if (!cancelled) {
          rows.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
          setPersonalPhotos(rows.map(createView));
        }
      } catch {
        if (!cancelled) setNotice('Не удалось открыть сохранённые фотографии в этом браузере.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      current.current = false;
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    };
  }, []);

  async function addPhotos(files) {
    if (!files.length || loading || importing) return false;
    setImporting(true);
    setNotice('');
    const rows = [];
    let unavailable = 0;

    try {
      for (const file of files) {
        try { rows.push(await preparePhoto(file)); }
        catch { unavailable += 1; }
      }
      if (!rows.length) {
        if (current.current) setNotice('Не удалось открыть выбранные файлы. Попробуйте JPEG, PNG или WebP.');
        return false;
      }
      await photoTransaction('readwrite', (store) => { rows.forEach((row) => store.add(row)); });
      if (!current.current) return false;
      const saved = rows.map(createView);
      setPersonalPhotos((photos) => [...saved, ...photos]);
      setNotice(unavailable ? `Сохранено фото: ${saved.length}. Не удалось открыть: ${unavailable}.` : `Сохранено фото: ${saved.length}.`);
      return true;
    } catch {
      if (current.current) setNotice('Не удалось сохранить фотографии. Возможно, в браузере закончилось место.');
      return false;
    } finally {
      if (current.current) setImporting(false);
    }
  }

  return { personalPhotos, loading, importing, notice, addPhotos };
}
