import React, { useEffect, useRef, useState } from 'react';
import { CloudUpload, LogOut, Mail, UserRound, X } from 'lucide-react';
import './account.css';

export default function AccountDialog({ client, user, initialNotice, onClose, onImport, onSignOut, uploadBusy }) {
  const dialog = useRef(null);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(initialNotice || '');

  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);

  async function sendLink(event) {
    event.preventDefault();
    if (!client || busy) return;
    const address = email.trim();
    setBusy(true);
    setNotice('');
    try {
      const { error } = await client.auth.signInWithOtp({
        email: address, options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
      setSent(address);
    } catch (error) {
      setNotice(error.status === 429
        ? 'Подождите минуту перед повторной отправкой.'
        : 'Не удалось отправить письмо. Проверьте адрес и попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  async function accountAction(action, fallback) {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await action();
      if (result) setNotice(result);
    } catch {
      setNotice(fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="account-dialog" aria-labelledby="account-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <article className="account-panel">
        <button type="button" className="account-close" aria-label="Закрыть" onClick={onClose}><X size={20} /></button>
        <div className="account-mark"><UserRound size={25} /></div>
        <h2 id="account-title">{user ? 'Твой аккаунт' : 'Вход по почте'}</h2>
        {user ? <>
          <p className="account-email">{user.email}</p>
          <p>Фото, избранное и черновик открытки доступны на устройствах, где открыт этот аккаунт.</p>
          <div className="account-actions">
            <button type="button" className="account-primary" disabled={busy || uploadBusy}
              onClick={() => accountAction(onImport, 'Не удалось перенести данные. Попробуйте ещё раз.')}>
              <CloudUpload size={18} /> Перенести фото и избранное
            </button>
            <button type="button" className="account-secondary" disabled={busy}
              onClick={() => accountAction(onSignOut, 'Не удалось выйти. Попробуйте ещё раз.')}>
              <LogOut size={17} /> Выйти
            </button>
          </div>
          <p className="account-note">Перенос копирует данные из этого браузера в аккаунт.</p>
        </> : !client ? <p>Вход станет доступен после подключения облачного хранилища к сайту.</p>
          : sent ? <>
            <p>Мы отправили ссылку для входа на <strong>{sent}</strong>. Открой её в том же браузере.</p>
            <button type="button" className="account-secondary" onClick={() => setSent('')}>Указать другой адрес</button>
          </> : <>
            <p>Введи email, чтобы получить одноразовую ссылку для входа.</p>
            <form className="account-form" onSubmit={sendLink}>
              <label htmlFor="account-email">Электронная почта</label>
              <input id="account-email" type="email" autoComplete="email" placeholder="name@example.com"
                required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
              <button type="submit" className="account-primary" disabled={busy}>
                <Mail size={18} /> {busy ? 'Отправляем…' : 'Получить ссылку'}
              </button>
            </form>
          </>}
        <p className="account-notice" role="status">{notice}</p>
      </article>
    </dialog>
  );
}
