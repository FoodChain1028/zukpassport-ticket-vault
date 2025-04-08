function sanitizeEnv(envStr: string | undefined): string | undefined {
  if (envStr === '' || envStr === undefined) {
    return undefined;
  }
  return envStr;
}

export const IS_PROD = sanitizeEnv(process.env.NEXT_PUBLIC_IS_PROD) === 'true';
export const ZUPASS_CLIENT_URL_ENV = sanitizeEnv(process.env.ZUPASS_CLIENT_URL_CONSUMER);
export const ZUPASS_SERVER_URL_ENV = sanitizeEnv(process.env.ZUPASS_SERVER_URL_CONSUMER);

export const ZUPASS_URL = ZUPASS_CLIENT_URL_ENV
  ? ZUPASS_CLIENT_URL_ENV
  : IS_PROD
    ? 'https://zupass.org/'
    : 'http://localhost:3000/';

export const ZUPASS_SERVER_URL = ZUPASS_SERVER_URL_ENV
  ? ZUPASS_SERVER_URL_ENV
  : IS_PROD
    ? 'https://api.zupass.org/'
    : 'http://localhost:3002/';
