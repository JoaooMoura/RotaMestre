import {iniciais, primeiroNome} from '../src/nomes';

describe('iniciais', () => {
  test('usa a primeira letra do primeiro e do último nome', () => {
    expect(iniciais('Carlos Mendes')).toBe('CM');
    expect(iniciais('João Vitor de Moura')).toBe('JM');
  });

  test('ignora palavras que não começam com letra', () => {
    expect(iniciais('Carlos Mendes (Demo)')).toBe('CM');
    expect(iniciais('Ana 2')).toBe('A');
    expect(iniciais('- Ana Souza -')).toBe('AS');
  });

  test('aceita letras acentuadas e minúsculas', () => {
    expect(iniciais('élcio ávila')).toBe('ÉÁ');
  });

  test('nome com uma palavra usa só uma inicial', () => {
    expect(iniciais('Carlos')).toBe('C');
  });

  test('nome vazio ou sem letras devolve texto vazio', () => {
    expect(iniciais('')).toBe('');
    expect(iniciais('   ')).toBe('');
    expect(iniciais('(123)')).toBe('');
  });
});

describe('primeiroNome', () => {
  test('devolve a primeira palavra sem espaços extras', () => {
    expect(primeiroNome('  Carlos Mendes ')).toBe('Carlos');
  });
});
