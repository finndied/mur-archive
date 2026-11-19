import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Cat, ChevronLeft, ChevronRight, Expand, Focus, Hand, Heart,
  Images, PawPrint, RotateCcw, Shuffle, Sparkles, Stamp, X,
} from 'lucide-react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/unbounded';
import './styles.css';
import Postcard from './Postcard.jsx';

const CatScene = lazy(() => import('./CatScene.jsx'));

const photos = [
  { id: 'window', title: 'Одно окно на двоих', kind: 'duo', focus: '50% 73%', alt: 'Джузо сидит на подоконнике, а Моти выглядывает из-за его плеча' },
  { id: 'yawn', title: 'Ой, уже снимают?', kind: 'solo', focus: '50% 7%', alt: 'Моти сидит на диване с открытым ртом и поднятой лапой' },
  { id: 'white', title: 'Пушистое облако', kind: 'solo', focus: '48% 33%', alt: 'Крупный план белого пушистого Джузо на зелёном пледе' },
  { id: 'basket', title: 'Места хватит обоим', kind: 'duo', focus: '50% 51%', alt: 'Джузо и Моти свернулись вместе в серой лежанке' },
  { id: 'sofa', title: 'Диванные дела', kind: 'duo', focus: '50% 77%', alt: 'Джузо лежит на подлокотнике, а Моти сидит рядом на диване' },
  { id: 'ride', title: 'Карманный попутчик', kind: 'solo', focus: '50% 72%', alt: 'Маленький светлый котёнок устроился на пледе в машине' },
];

const filters = [
  { id: 'all', label: 'Все' },
  { id: 'duo', label: 'Вместе' },
  { id: 'solo', label: 'По одному' },
];
const photoUrl = (id) => `/photos/${id}.jpg`;
const favoriteKey = 'mur-archive:favorites';

function readFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(favoriteKey));
    return Array.isArray(value) ? value.filter((id) => photos.some((photo) => photo.id === id)) : [];
  } catch {
    return [];
  }
}

function FavoriteButton({ photo, favorites, onToggle }) {
  const active = favorites.includes(photo.id);
  return (
    <button type="button" className="favorite-button" aria-label={`${active ? 'Убрать из избранного' : 'В избранное'} — ${photo.title}`} aria-pressed={active} onClick={() => onToggle(photo.id)}>
      <Heart size={19} strokeWidth={2} fill={active ? 'currentColor' : 'none'} />
    </button>
  );
}

function Lightbox({ list, active, favorites, onChange, onClose, onToggle, onPostcard }) {
  const dialog = useRef(null);
  const swipe = useRef(null);
  const current = list.findIndex((photo) => photo.id === active);
  const photo = list[current];

  function step(delta) {
    onChange(list[(current + delta + list.length) % list.length].id);
  }

  function startSwipe(event) {
    if (event.button !== 0 || !event.isPrimary || list.length < 2) return;
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function finishSwipe(event) {
    const start = swipe.current;
    if (!start || start.id !== event.pointerId) return;
    swipe.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 46 && Math.abs(dx) > Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1);
  }

  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      node.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <dialog
      className="lightbox"
      ref={dialog}
      aria-labelledby="lightbox-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') step(-1);
        if (event.key === 'ArrowRight') step(1);
      }}
    >
      <div className="lightbox-inner">
        <button type="button" className="lightbox-close" onClick={onClose} aria-label="Закрыть фото"><X /></button>
        <div className="lightbox-image" data-swipe={list.length > 1} onPointerDown={startSwipe} onPointerUp={finishSwipe} onLostPointerCapture={() => { swipe.current = null; }}>
          <img src={photoUrl(photo.id)} alt={photo.alt} draggable={false} />
        </div>
        <div className="lightbox-bar">
          <button type="button" className="lightbox-nav" onClick={() => step(-1)} disabled={list.length < 2} aria-label="Предыдущее фото"><ChevronLeft /></button>
          <div className="lightbox-caption" aria-live="polite">
            <strong id="lightbox-title">{photo.title}</strong>
            <span>{current + 1} / {list.length}</span>
          </div>
          <button type="button" className="lightbox-nav" onClick={() => step(1)} disabled={list.length < 2} aria-label="Следующее фото"><ChevronRight /></button>
          <FavoriteButton photo={photo} favorites={favorites} onToggle={onToggle} />
        </div>
        <button type="button" className="lightbox-postcard" onClick={() => onPostcard(photo.id)}><Stamp size={17} /> Сделать открытку</button>
      </div>
    </dialog>
  );
}

function Hero({ onBrowse, onOpen }) {
  return (
    <section className="hero shell" aria-labelledby="hero-title">
      <div className="hero-content">
        <div className="hero-label"><Sparkles size={15} /> Домашний фотоальбом</div>
        <h1 id="hero-title"><span>Мяу</span><span>на двоих<span className="title-dot">.</span></span></h1>
        <p>Джузо и Моти делят дом, подоконник и этот фотоальбом.</p>
        <div className="hero-actions">
          <a className="hero-button" href="#gallery" onClick={onBrowse}>Листать альбом <Images size={18} /></a>
          <a className="hero-postcard-link" href="#postcard" aria-label="Сделать открытку"><Stamp size={17} /><span className="postcard-link-full">Сделать открытку</span><span className="postcard-link-short" aria-hidden="true">Открытка</span></a>
        </div>
      </div>
      <div className="hero-art">
        <div className="hero-halo" aria-hidden="true" />
        <div className="hero-orbit" aria-hidden="true" />
        <div className="hero-snapshot" aria-hidden="true"><img src={photoUrl('yawn')} alt="" /></div>
        <figure className="hero-photo">
          <button type="button" className="hero-photo-open" aria-label="Открыть фото с обложки" onClick={onOpen}>
            <img src={photoUrl('window')} alt={photos[0].alt} fetchPriority="high" />
            <span className="expand" aria-hidden="true"><Expand size={17} /></span>
          </button>
        </figure>
        <div className="hero-spark hero-spark-top" aria-hidden="true">✦</div>
        <div className="hero-spark hero-spark-left" aria-hidden="true">✦</div>
        <div className="hero-bead hero-bead-top" aria-hidden="true" />
        <div className="hero-bead hero-bead-bottom" aria-hidden="true" />
        <div className="hero-sticker" aria-hidden="true"><PawPrint strokeWidth={2.1} /></div>
      </div>
    </section>
  );
}

function StudioFallback() {
  return <img className="studio-poster" src={photoUrl('basket')} alt={photos[3].alt} loading="lazy" />;
}

function Studio() {
  const stage = useRef(null);
  const [ready, setReady] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [reset, setReset] = useState(0);
  const [webgl, setWebgl] = useState(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setReady(true);
        observer.disconnect();
      }
    }, { rootMargin: '320px' });
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="studio" className="studio shell" aria-labelledby="studio-title">
      <div className="studio-copy">
        <div className="section-kicker"><Cat size={18} /> 3D-мастерская</div>
        <h2 id="studio-title">Коты<br />в объёме<span>.</span></h2>
        <p>Игрушечные Джузо и Моти на сиреневой подставке.{webgl !== false && ' Покрутите фигурки, чтобы рассмотреть их со всех сторон.'}</p>
        {webgl === true && <div className="studio-controls">
          <button type="button" className="spin-button" aria-pressed={spinning} onClick={() => setSpinning(!spinning)}>
            <RotateCcw size={17} /> {spinning ? 'Остановить' : 'Автовращение'}
          </button>
          <button type="button" className="scene-reset" onClick={() => { setSpinning(false); setReset(reset + 1); }} aria-label="Вернуть исходный ракурс" title="Вернуть исходный ракурс"><Focus size={19} /></button>
        </div>}
      </div>
      <div className="studio-stage" ref={stage}>
        {ready ? (
          <Suspense fallback={<StudioFallback />}>
            <CatScene spinning={spinning} reset={reset} onAvailability={setWebgl} />
          </Suspense>
        ) : <StudioFallback />}
        {webgl === true && <div className="drag-label"><Hand size={16} /> Потяните, чтобы повернуть</div>}
      </div>
    </section>
  );
}

function App() {
  const [favorites, setFavorites] = useState(readFavorites);
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState(null);
  const [viewerList, setViewerList] = useState([]);
  const [postcardPhoto, setPostcardPhoto] = useState(photos[0].id);
  const opener = useRef(null);
  const lastViewed = useRef(null);

  const visible = photos.filter((photo) => filter === 'all' || photo.kind === filter || (filter === 'favorites' && favorites.includes(photo.id)));

  useEffect(() => {
    try { localStorage.setItem(favoriteKey, JSON.stringify(favorites)); } catch { /* The gallery works without storage. */ }
  }, [favorites]);

  useEffect(() => {
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
  }, []);

  function toggleFavorite(id) {
    setFavorites((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  function showPhoto(id) {
    lastViewed.current = id;
    setActive(id);
  }

  function openPhoto(id, event, list = visible) {
    opener.current = event.currentTarget;
    setViewerList(list);
    showPhoto(id);
  }

  function openRandomPhoto(event) {
    const alternatives = visible.filter((photo) => photo.id !== lastViewed.current);
    const candidates = alternatives.length ? alternatives : visible;
    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    if (selected) openPhoto(selected.id, event);
  }

  function closePhoto() {
    setActive(null);
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      else document.getElementById('favorites-link').focus({ preventScroll: true });
    });
  }

  function makePostcard(id) {
    setPostcardPhoto(id);
    setActive(null);
    requestAnimationFrame(() => {
      if (window.location.hash !== '#postcard') window.history.pushState(null, '', '#postcard');
      document.getElementById('postcard-title').focus({ preventScroll: true });
      document.getElementById('postcard').scrollIntoView();
    });
  }

  return (
    <>
      <header className="site-header shell" id="top">
        <a className="brand" href="#top"><span className="brand-icon"><PawPrint size={22} strokeWidth={2.3} /></span>Мур<span className="brand-dot">.</span>архив</a>
        <nav className="site-nav" aria-label="Навигация">
          <a href="#gallery" onClick={() => setFilter('all')}>Фотографии</a>
          <a className="postcard-nav" href="#postcard">Мур.почта</a>
          <a className="studio-link" href="#studio" aria-label="3D-мастерская"><span className="studio-link-full">3D-мастерская</span><span className="studio-link-short" aria-hidden="true">3D</span></a>
        </nav>
        <a className="favorites-link" id="favorites-link" href="#gallery" onClick={() => setFilter(filter === 'favorites' ? 'all' : 'favorites')} aria-current={filter === 'favorites' ? 'true' : undefined} aria-label={`Избранное, фото: ${favorites.length}`}>
          <Heart size={19} fill={filter === 'favorites' ? 'currentColor' : 'none'} /><span>Избранное</span>{favorites.length > 0 && <b>{favorites.length}</b>}
        </a>
      </header>
      <main>
        <Hero onBrowse={() => setFilter('all')} onOpen={(event) => openPhoto(photos[0].id, event, photos)} />
        <section className="gallery shell" id="gallery" aria-labelledby="gallery-title">
          <div className="gallery-head">
            <div>
              <div className="section-kicker"><Images size={17} /> Фотографии</div>
              <h2 id="gallery-title">{filter === 'favorites' ? 'Избранные кадры' : 'Кадры из дома'}<span>.</span></h2>
            </div>
            <div className="gallery-actions">
              <div className="filters" role="group" aria-label="Фильтр фотографий">
                {filters.map(({ id, label }) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
              </div>
              <button type="button" className="random-photo" onClick={openRandomPhoto} disabled={!visible.length}><Shuffle size={16} /> Случайный кадр</button>
            </div>
          </div>
          {visible.length ? <div className="gallery-grid">
            {visible.map((photo) => (
              <article className="photo-card" key={photo.id}>
                <div className="photo-media">
                  <button type="button" className="photo-open" onClick={(event) => openPhoto(photo.id, event)} aria-label={`Открыть фото — ${photo.title}`}>
                    <img src={photoUrl(photo.id)} alt={photo.alt} style={{ objectPosition: photo.focus }} loading="lazy" width="720" height="1280" />
                    <span className="expand" aria-hidden="true"><Expand size={17} /></span>
                  </button>
                  <FavoriteButton photo={photo} favorites={favorites} onToggle={toggleFavorite} />
                </div>
                <h3>{photo.title}</h3>
              </article>
            ))}
          </div> : <div className="empty"><Heart size={25} /><p>Нажмите сердечко на фото, чтобы сохранить его здесь.</p><button type="button" onClick={() => setFilter('all')}>Все фотографии</button></div>}
        </section>
        <Postcard photos={photos} photo={photos.find(({ id }) => id === postcardPhoto)} onSelect={setPostcardPhoto} photoUrl={photoUrl} />
        <Studio />
      </main>
      <footer className="site-footer shell">
        <a className="brand" href="#top"><span className="brand-icon"><PawPrint size={20} /></span>Мур<span className="brand-dot">.</span>архив</a>
        <a className="back-top" href="#top">Наверх</a>
      </footer>
      {active && <Lightbox list={viewerList} active={active} favorites={favorites} onChange={showPhoto} onClose={closePhoto} onToggle={toggleFavorite} onPostcard={makePostcard} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);

