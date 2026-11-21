import React, { useEffect, useRef, useState } from 'react';
import { CloudUpload, KeyRound, LogIn, LogOut, UserRound, X } from 'lucide-react';
import { normalizeUsername, PASSWORD_MIN, USERNAME_PATTERN, validPassword } from './accountCredentials.js';
import './account.css';

const errors = {
  name_taken: 'Этот логин уже занят. Попробуй другой.',
  invalid_credentials: 'Проверь логин и пароль.',
  weak_password: 'Выбери более надёжный пароль.',
  rate_limit: 'Слишком много попыток. Попробуй чуть позже.',
  reauth_required: 'Эта сессия устарела. Обратись к владельцу сайта, чтобы сохранить доступ к аккаунту.',
  session_required: 'Сессия недоступна. Обратись к владельцу сайта для привязки логина.',
  already_linked: 'К этому аккаунту уже привязан логин. Переоткрой окно аккаунта.',
  unavailable: 'Вход временно недоступен. Попробуй ещё раз позже.',
};

async function requestAccount(action, username, password, accessToken) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch('/api/accounts', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, username, password }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(errors[result.code] ?? errors.unavailable);
  return result;
}

export default function AccountDialog({ client, user, onClose, onImport, onSignOut, uploadBusy }) {
  const dialog = useRef(null);
  const [mode, setMode] = useState(user ? 'profile' : 'login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const accountName = user?.app_metadata?.mur_username;
  const creating = mode === 'signup';
  const linking = mode === 'link';
  const title = linking ? 'Добавить логин и пароль' : user ? 'Твой аккаунт'
    : creating ? 'Создать аккаунт' : 'Вход в аккаунт';

  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);

  function switchMode(next) {
    setMode(next);
    setPassword('');
    setNotice('');
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (!client || busy) return;
    const name = normalizeUsername(username);
    if (!USERNAME_PATTERN.test(name)) {
      setNotice('Логин должен содержать от 3 до 24 символов. Используй латинские буквы, цифры, дефис или подчёркивание.');
      return;
    }
    if (!validPassword(password, mode === 'login' ? 1 : PASSWORD_MIN)) {
      setNotice(creating || linking ? 'Пароль должен содержать не меньше 10 символов. Для длинного пароля используй до 72 латинских символов.' : 'Проверь пароль.');
      return;
    }

    setBusy(true);
    setNotice('');
    try {
      let accessToken;
      if (linking) {
        const { data, error } = await client.auth.getSession();
        accessToken = data.session?.access_token;
        if (error || !accessToken) throw new Error(errors.session_required);
      }
      const result = await requestAccount(mode, name, password, accessToken);
      setPassword('');
      if (result.access_token && result.refresh_token) {
        const { error } = await client.auth.setSession({
          access_token: result.access_token, refresh_token: result.refresh_token,
        });
        if (error) throw new Error('Сессия не открылась. Попробуй войти ещё раз.');
      }
      if (linking) {
        if (!result.access_token) await client.auth.refreshSession();
        switchMode('profile');
        setNotice('Логин добавлен. Теперь им можно пользоваться на любом устройстве.');
      } else if (result.created) {
        switchMode('login');
        setNotice('Аккаунт создан. Введи пароль, чтобы войти.');
      }
    } catch (error) {
      setNotice(error instanceof SyntaxError || error instanceof TypeError ? errors.unavailable : error.message);
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
        <h2 id="account-title">{title}</h2>
        {user && !linking ? <>
          <p className="account-email">{accountName || user.email}</p>
          <p>Фото, избранное и черновик открытки доступны на устройствах, где открыт этот аккаунт.</p>
          <div className="account-actions">
            {!accountName && <button type="button" className="account-primary" disabled={busy} onClick={() => switchMode('link')}>
              <KeyRound size={17} /> Добавить логин и пароль
            </button>}
            <button type="button" className={accountName ? 'account-primary' : 'account-secondary'} disabled={busy || uploadBusy}
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
          : <>
            <p>{linking ? 'Добавь данные для входа. Фото и избранное останутся в этом аккаунте.'
              : creating ? 'Придумай логин и пароль, чтобы открывать свой альбом на разных устройствах.'
                : 'Введи логин и пароль от своего аккаунта.'}</p>
            <form className="account-form" onSubmit={submitPassword}>
              <label htmlFor="account-username">Логин</label>
              <input id="account-username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false}
                placeholder="Например, murkot" required maxLength={24} value={username}
                onChange={(event) => setUsername(event.target.value)} />
              <label htmlFor="account-password">Пароль</label>
              <input id="account-password" type="password" autoComplete={creating || linking ? 'new-password' : 'current-password'}
                placeholder={creating || linking ? 'От 10 символов' : 'Твой пароль'} required maxLength={72}
                minLength={creating || linking ? PASSWORD_MIN : undefined} value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="submit" className="account-primary" disabled={busy}>
                {creating || linking ? <KeyRound size={18} /> : <LogIn size={18} />}
                {busy ? 'Подожди…' : creating ? 'Зарегистрироваться' : linking ? 'Сохранить логин и пароль' : 'Войти'}
              </button>
            </form>
            <div className="account-switches">
              {linking ? <button type="button" disabled={busy} onClick={() => switchMode('profile')}>К аккаунту</button>
                : <button type="button" disabled={busy} onClick={() => switchMode(creating ? 'login' : 'signup')}>
                  {creating ? 'Уже есть аккаунт' : 'Создать аккаунт'}
                </button>}
            </div>
          </>}
        <p className="account-notice" role="status">{notice}</p>
      </article>
    </dialog>
  );
}
