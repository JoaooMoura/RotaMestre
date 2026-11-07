const URL_DESENVOLVIMENTO = 'http://127.0.0.1:3000/api';
const URL_PRODUCAO = '';

export function resolverUrlApi(desenvolvimento: boolean, urlProducao: string = URL_PRODUCAO) {
  if (desenvolvimento) {
    return URL_DESENVOLVIMENTO;
  }
  if (!urlProducao) {
    throw new Error('URL da API de produção não configurada. Defina URL_PRODUCAO em src/configuracao.ts.');
  }
  if (!urlProducao.startsWith('https://')) {
    throw new Error('A URL da API de produção precisa usar HTTPS.');
  }
  return urlProducao.replace(/\/+$/, '');
}

export const API_URL = resolverUrlApi(__DEV__);
