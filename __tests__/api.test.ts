import {
  aoExpirarSessao,
  buscarRotaAtual,
  definirToken,
  entrar,
  ErroApi,
  SEM_CONEXAO,
} from '../src/servicos/api';

function respostaFalsa(status: number, corpo: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response);
}

const fetchFalso = jest.fn();

function cabecalhosEnviados(chamada = 0) {
  return fetchFalso.mock.calls[chamada][1].headers as Record<string, string>;
}

beforeEach(() => {
  fetchFalso.mockReset();
  globalThis.fetch = fetchFalso;
  definirToken(null);
});

test('buscarRotaAtual envia o motoristaId na URL', async () => {
  fetchFalso.mockReturnValue(respostaFalsa(200, {id: 'RT-1'}));

  const rota = await buscarRotaAtual('M 1');

  expect(fetchFalso.mock.calls[0][0]).toBe('http://127.0.0.1:3000/api/rotas/atual?motoristaId=M%201');
  expect(rota).toEqual({id: 'RT-1'});
});

test('sem motoristaId busca a rota atual sem filtro', async () => {
  fetchFalso.mockReturnValue(respostaFalsa(200, {id: 'RT-1'}));

  await buscarRotaAtual();

  expect(fetchFalso.mock.calls[0][0]).toBe('http://127.0.0.1:3000/api/rotas/atual');
});

test('buscarRotaAtual devolve null quando o backend responde 404', async () => {
  fetchFalso.mockReturnValue(respostaFalsa(404, {mensagem: 'Nenhuma rota encontrada.'}));

  await expect(buscarRotaAtual('M-1')).resolves.toBeNull();
});

test('outros erros continuam sendo lançados com o status', async () => {
  fetchFalso.mockReturnValue(respostaFalsa(500, {mensagem: 'Erro interno.'}));

  const falha = await buscarRotaAtual('M-1').catch(erro => erro);

  expect(falha).toBeInstanceOf(ErroApi);
  expect(falha.status).toBe(500);
  expect(falha.message).toBe('Erro interno.');
});

describe('token de sessão', () => {
  test('sem token, nenhuma requisição leva Authorization', async () => {
    fetchFalso.mockReturnValue(respostaFalsa(200, {id: 'RT-1'}));

    await buscarRotaAtual();

    expect(cabecalhosEnviados()).not.toHaveProperty('Authorization');
  });

  test('depois de definirToken, toda requisição leva o Bearer', async () => {
    fetchFalso.mockReturnValue(respostaFalsa(200, {id: 'RT-1'}));
    definirToken('abc.def.ghi');

    await buscarRotaAtual();

    expect(cabecalhosEnviados().Authorization).toBe('Bearer abc.def.ghi');
  });

  test('entrar envia e-mail e senha para /auth/login e devolve a sessão', async () => {
    const sessao = {token: 't', usuario: {id: 'G-1', nome: 'G', email: 'g@x.com', papel: 'gestor'}};
    fetchFalso.mockReturnValue(respostaFalsa(200, sessao));

    await expect(entrar('g@x.com', '123')).resolves.toEqual(sessao);
    expect(fetchFalso.mock.calls[0][0]).toBe('http://127.0.0.1:3000/api/auth/login');
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({email: 'g@x.com', senha: '123'});
  });

  test('401 em requisição autenticada avisa que a sessão expirou', async () => {
    const expirou = jest.fn();
    const cancelar = aoExpirarSessao(expirou);
    definirToken('vencido');
    fetchFalso.mockReturnValue(respostaFalsa(401, {mensagem: 'Sessão expirada. Entre novamente.'}));

    await expect(buscarRotaAtual()).rejects.toMatchObject({status: 401});
    expect(expirou).toHaveBeenCalledTimes(1);
    cancelar();
  });

  test('401 do login (senha errada) não é tratado como sessão expirada', async () => {
    const expirou = jest.fn();
    const cancelar = aoExpirarSessao(expirou);
    fetchFalso.mockReturnValue(respostaFalsa(401, {mensagem: 'E-mail ou senha incorretos.'}));

    await expect(entrar('g@x.com', 'errada')).rejects.toMatchObject({
      status: 401,
      message: 'E-mail ou senha incorretos.',
    });
    expect(expirou).not.toHaveBeenCalled();
    cancelar();
  });
});

describe('falhas de rede e respostas fora do padrão', () => {
  test('sem conexão vira ErroApi com status SEM_CONEXAO e mensagem clara', async () => {
    fetchFalso.mockRejectedValue(new TypeError('Network request failed'));

    const falha = await entrar('g@x.com', '123').catch(erro => erro);

    expect(falha).toBeInstanceOf(ErroApi);
    expect(falha.status).toBe(SEM_CONEXAO);
    expect(falha.message).toBe('Sem conexão com o servidor. Verifique a internet e tente novamente.');
  });

  test('resposta de erro sem JSON usa a mensagem padrão', async () => {
    fetchFalso.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.reject(new SyntaxError('JSON Parse error')),
      } as Response),
    );

    await expect(buscarRotaAtual()).rejects.toMatchObject({
      status: 502,
      message: 'Não foi possível acessar o servidor.',
    });
  });
});
