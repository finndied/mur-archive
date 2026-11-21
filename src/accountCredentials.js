export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/;
export const PASSWORD_MIN = 10;

export function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validPassword(value, min = PASSWORD_MIN) {
  return typeof value === 'string' && value.length >= min && value.length <= 72 && new TextEncoder().encode(value).length <= 72;
}
