import {buscarRotaAtual, ErroApi} from '../src/servicos/api';

function respostaFalsa(status: number, corpo: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response);
}

const fetchFalso = jest.fn();

beforeEach(() => {
  fetchFalso.mockReset();
  globalThis.fetch = fetchFalso;
});

test('buscarRotaAtual envia o motoristaId na URL', async () => {
  fetchFalso.mockReturnValue(respostaFalsa(200, {id: 'RT-1'}));

  const rota = await buscarRotaAtual('M 1');

  expect(fetchFalso.mock.calls[0][0]).toBe('http://127.0.0.1:3000/api/rotas/atual?motoristaId=M%201');
  expect(rota).toEqual({id: 'RT-1'});
});

test('sem motoristaId busca a rota atual sem filtro (visão do gestor)', async () => {
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
