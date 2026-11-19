import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Cat, ChevronLeft, ChevronRight, Expand, Focus, Hand, Heart,
  Images, PawPrint, RotateCcw, Sparkles, X,
} from 'lucide-react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/unbounded';
import './styles.css';

const CatScene = lazy(() => import('./CatScene.jsx'));

const photos = [
  { id: 'window', title: 'Одно окно на двоих', kind: 'duo', focus: '50% 73%', alt: 'Белый кот на подоконнике, а кот с тёмной мордочкой выглядывает из-за его плеча' },
  { id: 'yawn', title: 'Ой, уже снимают?', kind: 'solo', focus: '50% 23%', alt: 'Кот с тёмной мордочкой сидит на диване с открытым ртом и поднятой лапой' },
  { id: 'white', title: 'Пушистое облако', kind: 'solo', focus: '48% 33%', alt: 'Крупный план белого пушистого кота на зелёном пледе' },
  { id: 'basket', title: 'Места хватит обоим', kind: 'duo', focus: '50% 51%', alt: 'Два кота свернулись вместе в серой лежанке' },
  { id: 'sofa', title: 'Диванные дела', kind: 'duo', focus: '50% 77%', alt: 'Белый кот лежит на подлокотнике, а второй кот сидит рядом на диване' },
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

function Lightbox({ list, active, favorites, onChange, onClose, onToggle }) {
  const dialog = useRef(null);
  const current = list.findIndex((photo) => photo.id === active);
  const photo = list[current];

  function step(delta) {
    onChange(list[(current + delta + list.length) % list.length].id);
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
        <img src={photoUrl(photo.id)} alt={photo.alt} />
        <div className="lightbox-bar">
          <button type="button" className="lightbox-nav" onClick={() => step(-1)} disabled={list.length < 2} aria-label="Предыдущее фото"><ChevronLeft /></button>
          <div className="lightbox-caption" aria-live="polite">
            <strong id="lightbox-title">{photo.title}</strong>
            <span>{current + 1} / {list.length}</span>
          </div>
          <button type="button" className="lightbox-nav" onClick={() => step(1)} disabled={list.length < 2} aria-label="Следующее фото"><ChevronRight /></button>
          <FavoriteButton photo={photo} favorites={favorites} onToggle={onToggle} />
        </div>
      </div>
    </dialog>
  );
}

function Hero({ onBrowse }) {
  return (
    <section className="hero shell" aria-labelledby="hero-title">
      <div className="hero-content">
        <div className="hero-label"><Sparkles size={15} /> Домашний фотоальбом</div>
        <h1 id="hero-title"><span>Мяу</span><span>на двоих<span className="title-dot">.</span></span></h1>
        <p>Два кота, один дом и бесконечно много поводов достать камеру.</p>
        <a className="hero-button" href="#gallery" onClick={onBrowse}>Листать альбом <Images size={18} /></a>
      </div>
      <div className="hero-art">
        <div className="hero-halo" aria-hidden="true" />
        <div className="hero-orbit" aria-hidden="true" />
        <div className="hero-snapshot" aria-hidden="true"><img src={photoUrl('yawn')} alt="" /></div>
        <figure className="hero-photo">
          <img src={photoUrl('window')} alt={photos[0].alt} fetchPriority="high" />
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
        <p>Два игрушечных кота на сиреневой подставке.{webgl !== false && ' Покрутите фигурки, чтобы рассмотреть их со всех сторон.'}</p>
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
  const opener = useRef(null);

  const visible = photos.filter((photo) => filter === 'all' || photo.kind === filter || (filter === 'favorites' && favorites.includes(photo.id)));

  useEffect(() => {
    try { localStorage.setItem(favoriteKey, JSON.stringify(favorites)); } catch { /* The gallery works without storage. */ }
  }, [favorites]);

  function toggleFavorite(id) {
    setFavorites((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  function openPhoto(id, event) {
    opener.current = event.currentTarget;
    setViewerList(visible);
    setActive(id);
  }

  function closePhoto() {
    setActive(null);
    requestAnimationFrame(() => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      else document.getElementById('favorites-link').focus({ preventScroll: true });
    });
  }

  return (
    <>
      <header className="site-header shell" id="top">
        <a className="brand" href="#top"><span className="brand-icon"><PawPrint size={22} strokeWidth={2.3} /></span>Мур<span className="brand-dot">.</span>архив</a>
        <nav className="site-nav" aria-label="Навигация">
          <a href="#gallery" onClick={() => setFilter('all')}>Фотографии</a>
          <a className="studio-link" href="#studio" aria-label="3D-мастерская"><span className="studio-link-full">3D-мастерская</span><span className="studio-link-short" aria-hidden="true">3D</span></a>
        </nav>
        <a className="favorites-link" id="favorites-link" href="#gallery" onClick={() => setFilter(filter === 'favorites' ? 'all' : 'favorites')} aria-current={filter === 'favorites' ? 'true' : undefined} aria-label={`Избранное, фото: ${favorites.length}`}>
          <Heart size={19} fill={filter === 'favorites' ? 'currentColor' : 'none'} /><span>Избранное</span>{favorites.length > 0 && <b>{favorites.length}</b>}
        </a>
      </header>
      <main>
        <Hero onBrowse={() => setFilter('all')} />
        <section className="gallery shell" id="gallery" aria-labelledby="gallery-title">
          <div className="gallery-head">
            <div>
              <div className="section-kicker"><Images size={17} /> Фотографии</div>
              <h2 id="gallery-title">{filter === 'favorites' ? 'Избранные кадры' : 'Кадры из дома'}<span>.</span></h2>
            </div>
            <div className="filters" role="group" aria-label="Фильтр фотографий">
              {filters.map(({ id, label }) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
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
        <Studio />
      </main>
      <footer className="site-footer shell">
        <a className="brand" href="#top"><span className="brand-icon"><PawPrint size={20} /></span>Мур<span className="brand-dot">.</span>архив</a>
        <a className="back-top" href="#top">Наверх</a>
      </footer>
      {active && <Lightbox list={viewerList} active={active} favorites={favorites} onChange={setActive} onClose={closePhoto} onToggle={toggleFavorite} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);

