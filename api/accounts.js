import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { normalizeUsername, USERNAME_PATTERN, validPassword } from '../src/accountCredentials.js';

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const authActions = new Set(['login', 'signup', 'link']);
const badCredentials = 'invalid_credentials';

function recentAuthentication(token) {
  try {
    // getUser() must validate the token before relying on its signed claims.
    const { amr } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    return Array.isArray(amr) && amr.some(({ timestamp }) => Number.isInteger(timestamp) && timestamp <= now + 60 && timestamp >= now - 900);
  } catch {
    return false;
  }
}

async function lookupName(admin, username) {
  const { data, error } = await admin.from('mur_account_names').select('user_id').eq('username', username).maybeSingle();
  if (error) throw error;
  return data?.user_id;
}

async function passwordSession(publicClient, email, password) {
  const { data, error } = await publicClient.auth.signInWithPassword({ email, password });
  if (error || !data?.session) return { error };
  const { access_token, refresh_token } = data.session;
  return { access_token, refresh_token };
}

async function linkAccount(request, response, admin, publicClient, username, password) {
  const token = typeof request.headers.authorization === 'string' ? request.headers.authorization.match(/^Bearer ([^\s]+)$/i)?.[1] : null;
  if (!token) return response.status(401).json({ code: 'session_required' });

  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user?.email_confirmed_at || !recentAuthentication(token)) return response.status(401).json({ code: 'reauth_required' });
  if (user.app_metadata?.mur_username) return response.status(409).json({ code: 'already_linked' });
  if (await lookupName(admin, username)) return response.status(409).json({ code: 'name_taken' });

  // The Auth trigger links the name in the same transaction as the password update.
  const updated = await admin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: { ...user.app_metadata, mur_username: username },
  });
  if (updated.error) {
    if (await lookupName(admin, username)) return response.status(409).json({ code: 'name_taken' });
    if (updated.error.code === 'weak_password') return response.status(400).json({ code: 'weak_password' });
    throw updated.error;
  }
  const session = await passwordSession(publicClient, user.email, password);
  return response.status(200).json(session.access_token ? { ...session, username } : { username });
}

export default async function accountHandler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ code: 'method' });
  }
  const contentType = request.headers['content-type'];
  if (typeof contentType !== 'string' || contentType.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return response.status(415).json({ code: 'json_required' });
  }
  if (request.headers.origin) {
    const protocol = process.env.VERCEL ? 'https:' : 'http:';
    if (request.headers.origin !== protocol + '//' + request.headers.host) return response.status(403).json({ code: 'origin' });
  }

  const { action, password } = request.body ?? {};
  const username = normalizeUsername(request.body?.username);
  if (!authActions.has(action) || !USERNAME_PATTERN.test(username) || !validPassword(password, action === 'login' ? 1 : undefined)) {
    return response.status(400).json({ code: 'invalid_input' });
  }

  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: publicKey, SUPABASE_SECRET_KEY: secret } = process.env;
  if (!url || !publicKey || !secret?.startsWith('sb_secret_')) return response.status(503).json({ code: 'unavailable' });

  try {
    const admin = createClient(url, secret, options);
    const header = request.headers['x-vercel-forwarded-for'];
    const forwarded = typeof header === 'string' ? header.split(',')[0].trim() : undefined;
    const ip = process.env.VERCEL ? forwarded : request.socket?.remoteAddress;
    const rateKey = createHmac('sha256', secret).update(`mur-archive:${action}:${isIP(ip ?? '') ? ip : 'unknown'}`).digest('hex');
    const rate = await admin.rpc('mur_allow_auth_attempt', { p_key: rateKey, p_action: action });
    if (rate.error) throw rate.error;
    if (!rate.data) return response.status(429).json({ code: 'rate_limit' });
    const publicClient = createClient(url, publicKey, options);
    if (action === 'link') return await linkAccount(request, response, admin, publicClient, username, password);
    const existingId = await lookupName(admin, username);
    if (action === 'login') {
      if (!existingId) return response.status(401).json({ code: badCredentials });
      const found = await admin.auth.admin.getUserById(existingId);
      if (found.error) throw found.error;
      if (!found.data.user?.email) return response.status(401).json({ code: badCredentials });
      const session = await passwordSession(publicClient, found.data.user.email, password);
      if (session.error || !session.access_token) {
        if (session.error?.status === 429) return response.status(429).json({ code: 'rate_limit' });
        if (session.error?.status >= 500) throw session.error;
        return response.status(401).json({ code: badCredentials });
      }
      return response.status(200).json(session);
    }

    if (existingId) return response.status(409).json({ code: 'name_taken' });
    // Internal addresses are randomly assigned. The public username is never an email address.
    const email = `${randomUUID()}@accounts.mur-archive.invalid`;
    const created = await admin.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { mur_username: username },
    });
    if (created.error) {
      if (await lookupName(admin, username)) return response.status(409).json({ code: 'name_taken' });
      if (created.error.code === 'weak_password') return response.status(400).json({ code: 'weak_password' });
      throw created.error;
    }
    const session = await passwordSession(publicClient, email, password);
    return response.status(201).json(session.access_token ? session : { created: true });
  } catch (error) {
    console.error('Mur Archive account request failed', { action, status: error?.status, code: error?.code });
    return response.status(503).json({ code: 'unavailable' });
  }
}
