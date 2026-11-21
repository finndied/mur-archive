import { useCallback, useEffect, useRef, useState } from 'react';
import { watchAccountChanges } from './accountRefresh.js';

const favoriteKey = 'mur-archive:favorites';
const postcardKey = 'mur-archive:postcard-draft';
const legacyPhotoKey = 'mur-archive:postcard-photo';
const photoIdPattern = /^(window|yawn|white|basket|sofa|ride|custom-[0-9a-f-]{36})$/;
const defaultDraft = { photoId: 'window', caption: 'Привет от Джузо и Моти!', theme: 'lilac', seal: 'paw' };

function validDraft(draft) {
  return {
    photoId: typeof draft?.photoId === 'string' && photoIdPattern.test(draft.photoId) ? draft.photoId : defaultDraft.photoId,
    caption: typeof draft?.caption === 'string' ? draft.caption.slice(0, 42) : defaultDraft.caption,
    theme: ['lilac', 'matcha', 'peach'].includes(draft?.theme) ? draft.theme : defaultDraft.theme,
    seal: ['paw', 'heart', 'spark', 'none'].includes(draft?.seal) ? draft.seal : defaultDraft.seal,
  };
}

export function readGuestFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(favoriteKey));
    return Array.isArray(value) ? [...new Set(value.filter((id) => typeof id === 'string' && photoIdPattern.test(id)))] : [];
  } catch {
    return [];
  }
}

function readGuestDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(postcardKey));
    return validDraft(draft ?? { photoId: localStorage.getItem(legacyPhotoKey) });
  } catch {
    return defaultDraft;
  }
}

export function useArchivePreferences(client, userId) {
  const [favorites, setFavorites] = useState(() => userId ? [] : readGuestFavorites());
  const [draft, setDraft] = useState(() => userId ? defaultDraft : readGuestDraft());
  const [favoritesReady, setFavoritesReady] = useState(!userId);
  const [draftReady, setDraftReady] = useState(!userId);
  const [loadError, setLoadError] = useState('');
  const [favoriteError, setFavoriteError] = useState('');
  const [draftError, setDraftError] = useState('');
  const mounted = useRef(false);
  const favoriteRevision = useRef(0);
  const draftRevision = useRef(0);
  const pendingFavorites = useRef(new Set());
  const pendingDraft = useRef(new Map());
  const draftTimer = useRef(null);
  const draftWrite = useRef(null);

  const flushDraft = useCallback(() => {
    clearTimeout(draftTimer.current);
    if (!userId || !pendingDraft.current.size) return Promise.resolve();
    if (draftWrite.current) return draftWrite.current;

    async function write() {
      while (mounted.current && pendingDraft.current.size) {
        const batch = [...pendingDraft.current];
        draftRevision.current += 1;
        try {
          const { error } = await client.from('mur_postcard').upsert(
            batch.map(([field, value]) => ({ user_id: userId, field, value })),
            { onConflict: 'user_id,field' },
          );
          if (error) throw error;
          for (const [field, value] of batch) {
            if (pendingDraft.current.get(field) === value) pendingDraft.current.delete(field);
          }
          if (mounted.current) setDraftError('');
        } catch {
          if (mounted.current) setDraftError('Черновик пока не синхронизирован. Попробуем снова при открытии вкладки.');
          break;
        }
      }
    }

    draftWrite.current = write().finally(() => { draftWrite.current = null; });
    return draftWrite.current;
  }, [client, userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const currentFavorites = ++favoriteRevision.current;
    const currentDraft = ++draftRevision.current;
    try {
      const [savedFavorites, savedDraft] = await Promise.all([
        client.from('mur_favorites').select('photo_id').eq('user_id', userId),
        client.from('mur_postcard').select('field,value').eq('user_id', userId),
      ]);
      if (!mounted.current) return;
      if (!savedFavorites.error) {
        if (currentFavorites === favoriteRevision.current && !pendingFavorites.current.size) {
          setFavorites(savedFavorites.data.map(({ photo_id }) => photo_id));
        }
        setFavoritesReady(true);
      }
      if (!savedDraft.error) {
        if (currentDraft === draftRevision.current && !draftWrite.current) {
          setDraft(validDraft({ ...Object.fromEntries(savedDraft.data.map(({ field, value }) => [field, value])), ...Object.fromEntries(pendingDraft.current) }));
        }
        setDraftReady(true);
      }
      setLoadError(savedFavorites.error || savedDraft.error ? 'Не удалось загрузить часть данных аккаунта.' : '');
    } catch {
      if (mounted.current) setLoadError('Не удалось загрузить данные аккаунта.');
    }
  }, [client, userId]);

  useEffect(() => {
    mounted.current = true;
    if (userId) refresh();
    const stopWatching = userId ? watchAccountChanges(async () => { await flushDraft(); await refresh(); }) : null;
    return () => {
      mounted.current = false;
      clearTimeout(draftTimer.current);
      stopWatching?.();
    };
  }, [userId, refresh, flushDraft]);

  useEffect(() => {
    if (!userId) {
      try {
        localStorage.setItem(favoriteKey, JSON.stringify(favorites));
        localStorage.setItem(postcardKey, JSON.stringify(draft));
      } catch { /* Guest mode still works for the current tab. */ }
    }
  }, [userId, favorites, draft]);

  function changeDraft(field, value) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    if (!userId) return;
    pendingDraft.current.set(field, value);
    draftRevision.current += 1;
    if (field === 'caption') {
      clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(flushDraft, 250);
    } else {
      flushDraft();
    }
  }

  async function toggleFavorite(id) {
    const selected = favorites.includes(id);
    const apply = (items) => selected ? items.filter((item) => item !== id) : [...new Set([...items, id])];
    if (!userId) {
      setFavorites(apply);
      return;
    }
    if (!favoritesReady || pendingFavorites.current.has(id)) return;
    pendingFavorites.current.add(id);
    favoriteRevision.current += 1;
    setFavoriteError('');
    try {
      const table = client.from('mur_favorites');
      const { error } = selected
        ? await table.delete().eq('user_id', userId).eq('photo_id', id)
        : await table.upsert({ user_id: userId, photo_id: id }, { onConflict: 'user_id,photo_id', ignoreDuplicates: true });
      if (error) throw error;
      if (mounted.current) setFavorites(apply);
    } catch {
      if (mounted.current) setFavoriteError('Не удалось обновить избранное. Попробуйте ещё раз.');
    } finally {
      pendingFavorites.current.delete(id);
      favoriteRevision.current += 1;
    }
  }

  async function mergeFavorites(ids) {
    if (!userId || !ids.length) return;
    const { error } = await client.from('mur_favorites').upsert(
      ids.map((photo_id) => ({ user_id: userId, photo_id })),
      { onConflict: 'user_id,photo_id', ignoreDuplicates: true },
    );
    if (error) throw error;
    favoriteRevision.current += 1;
    if (mounted.current) setFavorites((previous) => [...new Set([...previous, ...ids])]);
  }

  return { favorites, draft, favoritesReady, draftReady, loadError, favoriteError, draftError, refresh, toggleFavorite, changeDraft, flushDraft, mergeFavorites };
}
