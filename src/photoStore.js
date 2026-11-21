const bucket = 'mur-archive-photos';
const pageSize = 100;
const linkLifetime = 15 * 60;
const refreshBefore = 5 * 60 * 1000;
const namePattern = /^(custom-[0-9a-f-]{36})\.(\d{13})\.(\d{1,4})\.(\d{1,4})\.([A-Za-z0-9_-]{1,400})\.jpg$/;

function encodeTitle(title) {
  const bytes = new TextEncoder().encode(title);
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function parsePhoto(name) {
  const match = namePattern.exec(name);
  if (!match) return null;
  const [, id, time, width, height, encoded] = match;
  if (encoded.length % 4 === 1 || !Number(width) || !Number(height)) return null;
  const bytes = Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), (char) => char.charCodeAt(0));
  const title = new TextDecoder().decode(bytes) || 'Моя фотография';
  return {
    id,
    kind: 'custom',
    title,
    alt: `Добавленная фотография — ${title}`,
    focus: '50% 50%',
    width: Number(width),
    height: Number(height),
    createdAt: Number(time),
  };
}

export function createPhotoStore(client, userId) {
  const storage = client.storage.from(bucket);
  const links = new Map();
  const folder = `${userId}/`;

  return {
    async list() {
      const entries = new Map();
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await storage.list(userId, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw error;
        for (const { name } of data) {
          const photo = parsePhoto(name);
          if (photo) entries.set(photo.id, { ...photo, path: folder + name });
        }
        if (data.length < pageSize) break;
      }
      const photos = [...entries.values()];
      const now = Date.now();
      const missing = photos.filter(({ path }) => (links.get(path)?.expires ?? 0) < now + refreshBefore);
      for (let offset = 0; offset < missing.length; offset += pageSize) {
        const paths = missing.slice(offset, offset + pageSize).map(({ path }) => path);
        const { data, error } = await storage.createSignedUrls(paths, linkLifetime);
        if (error) throw error;
        for (const item of data) {
          if (item.signedUrl) links.set(item.path, { src: item.signedUrl, expires: now + linkLifetime * 1000 });
        }
      }
      const available = photos.flatMap(({ path, ...photo }) => {
        const link = links.get(path);
        return link && link.expires > now ? [{ ...photo, src: link.src }] : [];
      });
      return { photos: available, incomplete: available.length !== photos.length };
    },

    async save(photo) {
      const name = `${photo.id}.${photo.createdAt}.${photo.width}.${photo.height}.${encodeTitle(photo.title)}.jpg`;
      const { error } = await storage.upload(folder + name, photo.blob, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      return photo.id;
    },
  };
}
