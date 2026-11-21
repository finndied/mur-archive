import { useCallback, useEffect, useRef, useState } from 'react';
import { watchAccountChanges } from './accountRefresh.js';

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

export function readLocalPhotos() {
  return photoTransaction('readonly', (store) => store.getAll());
}

function newestFirst(photos) {
  return photos.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

export function usePersonalPhotos(cloud) {
  const [personalPhotos, setPersonalPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const mounted = useRef(false);
  const working = useRef(false);
  const activeLoad = useRef(0);
  const objectUrls = useRef(new Map());

  const refresh = useCallback(async () => {
    const version = ++activeLoad.current;
    try {
      if (cloud) {
        const result = await cloud.list();
        if (mounted.current && version === activeLoad.current) {
          setPersonalPhotos(newestFirst(result.photos));
          setLoadError(result.incomplete ? 'Часть фото пока недоступна. Попробуйте обновить галерею.' : '');
        }
      } else {
        const rows = await readLocalPhotos();
        if (mounted.current && version === activeLoad.current) {
          setPersonalPhotos(newestFirst(rows).map(({ blob, ...photo }) => {
            if (!objectUrls.current.has(photo.id)) objectUrls.current.set(photo.id, URL.createObjectURL(blob));
            return { ...photo, src: objectUrls.current.get(photo.id) };
          }));
          setLoadError('');
        }
      }
    } catch {
      if (mounted.current && version === activeLoad.current) setLoadError('Не удалось открыть сохранённые фотографии.');
    } finally {
      if (mounted.current && version === activeLoad.current) setLoading(false);
    }
  }, [cloud]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const stopWatching = cloud ? watchAccountChanges(refresh) : null;
    const urls = objectUrls.current;
    return () => {
      mounted.current = false;
      activeLoad.current += 1;
      stopWatching?.();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, [cloud, refresh]);

  async function saveRows(rows) {
    if (!rows.length) return { ids: [], failed: 0 };
    if (!cloud) {
      await photoTransaction('readwrite', (store) => { rows.forEach((row) => store.add(row)); });
      return { ids: rows.map(({ id }) => id), failed: 0 };
    }
    const ids = [];
    let failed = 0;
    for (const row of rows) {
      if (!mounted.current) break;
      try { ids.push(await cloud.save(row)); } catch { failed += 1; }
    }
    return { ids, failed };
  }

  async function addPhotos(files) {
    if (!files.length || loading || working.current) return false;
    working.current = true;
    setImporting(true);
    setNotice('');
    const rows = [];
    let unavailable = 0;

    try {
      for (const file of files) {
        if (!mounted.current) return false;
        try { rows.push(await preparePhoto(file)); } catch { unavailable += 1; }
      }
      if (!rows.length) {
        if (mounted.current) setNotice('Не удалось открыть выбранные файлы. Попробуйте JPEG, PNG или WebP.');
        return false;
      }
      const { ids, failed } = await saveRows(rows);
      if (!mounted.current) return false;
      if (ids.length) await refresh();
      if (mounted.current) {
        const missing = unavailable + failed;
        setNotice(missing ? `Сохранено фото: ${ids.length}. Не удалось добавить: ${missing}.` : `Сохранено фото: ${ids.length}.`);
      }
      return ids.length > 0;
    } catch {
      if (mounted.current) setNotice('Не удалось сохранить фотографии. Попробуйте ещё раз.');
      return false;
    } finally {
      working.current = false;
      if (mounted.current) setImporting(false);
    }
  }

  async function importLocalPhotos() {
    if (!cloud || working.current) return null;
    working.current = true;
    setImporting(true);
    try {
      const rows = await readLocalPhotos();
      const result = await saveRows(rows);
      if (result.ids.length && mounted.current) await refresh();
      return result;
    } finally {
      working.current = false;
      if (mounted.current) setImporting(false);
    }
  }

  return { personalPhotos, loading, importing, notice, loadError, refresh, addPhotos, importLocalPhotos };
}
