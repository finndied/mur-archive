export function watchAccountChanges(refresh) {
  function onVisible() {
    if (!document.hidden) refresh();
  }

  const timer = setInterval(onVisible, 120000);
  window.addEventListener('focus', onVisible);
  window.addEventListener('online', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('online', onVisible);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
