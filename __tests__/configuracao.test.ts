import {resolverUrlApi} from '../src/configuracao';

test('em desenvolvimento usa a API local via adb reverse', () => {
  expect(resolverUrlApi(true)).toBe('http://127.0.0.1:3000/api');
});

test('em release sem URL de produção falha de forma explícita', () => {
  expect(() => resolverUrlApi(false)).toThrow('URL da API de produção não configurada');
});

test('em release recusa URL sem HTTPS', () => {
  expect(() => resolverUrlApi(false, 'http://api.exemplo.com/api')).toThrow('precisa usar HTTPS');
});

test('em release aceita HTTPS e remove a barra final', () => {
  expect(resolverUrlApi(false, 'https://api.exemplo.com/api/')).toBe('https://api.exemplo.com/api');
});
