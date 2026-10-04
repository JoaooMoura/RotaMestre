import {act, renderHook} from '@testing-library/react-native';
import {ErroApi, SEM_CONEXAO} from '../src/servicos/api';
import {Motorista, Rota, Usuario} from '../src/tipos';
import {ServicoOperacao, useOperacaoViewModel} from '../src/viewmodels/OperacaoViewModel';

const GESTOR: Usuario = {id: 'G-1', nome: 'Rodrigo', email: 'gestor@rotamestre.com', papel: 'gestor'};
const MOTORISTA: Usuario = {id: '1', nome: 'Carlos', email: 'motorista@rotamestre.com', papel: 'motorista'};

const ROTA: Rota = {
  id: 'RT-001',
  nome: 'Rota de teste',
  data: 'Hoje',
  horario: '08:00',
  motoristaId: '1',
  status: 'Programada',
  paradas: [],
};

const EQUIPE: Motorista[] = [
  {id: '1', nome: 'Carlos', email: 'motorista@rotamestre.com', veiculo: 'Van', disponivel: true},
];

// Serviço falso injetado: nenhuma chamada de rede nos testes.
function criarServicoFalso() {
  return {
    buscarRotaAtual: jest.fn<Promise<Rota | null>, []>().mockResolvedValue(ROTA),
    buscarMotoristas: jest.fn<Promise<Motorista[]>, []>().mockResolvedValue(EQUIPE),
    salvarRota: jest.fn<Promise<Rota>, [Rota]>(rota => Promise.resolve(rota)),
  } satisfies ServicoOperacao;
}

// Promessa controlada pelo teste, para simular uma resposta que chega depois.
function adiada<T>() {
  let resolver: (valor: T) => void = () => {};
  const promessa = new Promise<T>(resolve => (resolver = resolve));
  return {promessa, resolver};
}

async function renderizar(usuario: Usuario | null, servico: ServicoOperacao) {
  return renderHook(
    (props: {usuario: Usuario | null}) => useOperacaoViewModel(props.usuario, servico),
    {initialProps: {usuario}},
  );
}

describe('carga por papel', () => {
  test('gestor carrega a rota e a equipe', async () => {
    const servico = criarServicoFalso();
    const {result} = await renderizar(GESTOR, servico);

    expect(result.current.estado).toEqual({tipo: 'pronto', rota: ROTA, motoristas: EQUIPE});
    expect(servico.buscarMotoristas).toHaveBeenCalledTimes(1);
  });

  test('motorista carrega só a própria rota, sem pedir a lista de motoristas', async () => {
    const servico = criarServicoFalso();
    const {result} = await renderizar(MOTORISTA, servico);

    expect(result.current.estado).toEqual({tipo: 'pronto', rota: ROTA, motoristas: []});
    expect(servico.buscarMotoristas).not.toHaveBeenCalled();
  });

  test('sem usuário nenhum dado é buscado', async () => {
    const servico = criarServicoFalso();
    const {result} = await renderizar(null, servico);

    expect(result.current.estado).toEqual({tipo: 'carregando'});
    expect(servico.buscarRotaAtual).not.toHaveBeenCalled();
  });
});

describe('estados da carga', () => {
  test('começa em carregando até a resposta chegar', async () => {
    const servico = criarServicoFalso();
    const resposta = adiada<Rota | null>();
    servico.buscarRotaAtual.mockReturnValue(resposta.promessa);
    const {result} = await renderizar(MOTORISTA, servico);

    expect(result.current.estado).toEqual({tipo: 'carregando'});

    await act(async () => resposta.resolver(ROTA));
    expect(result.current.estado.tipo).toBe('pronto');
  });

  test('sem rota atribuída vira semRota', async () => {
    const servico = criarServicoFalso();
    servico.buscarRotaAtual.mockResolvedValue(null);
    const {result} = await renderizar(MOTORISTA, servico);

    expect(result.current.estado).toEqual({tipo: 'semRota'});
  });

  test('falha de rede vira erro com a mensagem, e recarregar tenta de novo', async () => {
    const servico = criarServicoFalso();
    servico.buscarRotaAtual.mockRejectedValueOnce(
      new ErroApi('Sem conexão com o servidor. Verifique a internet e tente novamente.', SEM_CONEXAO),
    );
    const {result} = await renderizar(MOTORISTA, servico);

    expect(result.current.estado).toEqual({
      tipo: 'erro',
      mensagem: 'Sem conexão com o servidor. Verifique a internet e tente novamente.',
    });

    await act(async () => {
      await result.current.recarregar();
    });
    expect(result.current.estado.tipo).toBe('pronto');
    expect(servico.buscarRotaAtual).toHaveBeenCalledTimes(2);
  });

  test('401 na carga não vira tela de erro (a sessão volta ao login)', async () => {
    const servico = criarServicoFalso();
    servico.buscarRotaAtual.mockRejectedValue(new ErroApi('Sessão expirada. Entre novamente.', 401));
    const {result} = await renderizar(MOTORISTA, servico);

    expect(result.current.estado.tipo).not.toBe('erro');
  });

  test('resposta que chega depois do logout é descartada', async () => {
    const servico = criarServicoFalso();
    const resposta = adiada<Rota | null>();
    servico.buscarRotaAtual.mockReturnValue(resposta.promessa);
    const {result, rerender} = await renderizar(MOTORISTA, servico);

    await rerender({usuario: null});
    await act(async () => resposta.resolver(ROTA));

    expect(result.current.estado).toEqual({tipo: 'carregando'});
  });

  test('resposta de outro usuário não aparece para quem entrou depois', async () => {
    const servico = criarServicoFalso();
    const rotaDoMotorista = adiada<Rota | null>();
    servico.buscarRotaAtual
      .mockReturnValueOnce(rotaDoMotorista.promessa)
      .mockResolvedValueOnce({...ROTA, id: 'RT-GESTOR'});
    const {result, rerender} = await renderizar(MOTORISTA, servico);

    await rerender({usuario: GESTOR});
    await act(async () => rotaDoMotorista.resolver({...ROTA, id: 'RT-ATRASADA'}));

    expect(result.current.estado).toMatchObject({tipo: 'pronto', rota: {id: 'RT-GESTOR'}});
  });
});

describe('salvar rota', () => {
  test('sucesso atualiza a rota e mantém a equipe do gestor', async () => {
    const servico = criarServicoFalso();
    const {result} = await renderizar(GESTOR, servico);
    const alterada = {...ROTA, status: 'Em andamento' as const};

    let resultado;
    await act(async () => {
      resultado = await result.current.atualizarRota(alterada);
    });

    expect(resultado).toEqual({ok: true});
    expect(result.current.estado).toEqual({tipo: 'pronto', rota: alterada, motoristas: EQUIPE});
  });

  test('falha devolve a mensagem e mantém a rota anterior na tela', async () => {
    const servico = criarServicoFalso();
    servico.salvarRota.mockRejectedValue(new ErroApi('Comprovante de entrega inválido.', 400));
    const {result} = await renderizar(MOTORISTA, servico);

    let resultado;
    await act(async () => {
      resultado = await result.current.atualizarRota({...ROTA, status: 'Concluída'});
    });

    expect(resultado).toEqual({ok: false, mensagem: 'Comprovante de entrega inválido.'});
    expect(result.current.estado).toMatchObject({tipo: 'pronto', rota: ROTA});
  });

  test('401 ao salvar devolve falha sem mensagem (sem alerta duplicado)', async () => {
    const servico = criarServicoFalso();
    servico.salvarRota.mockRejectedValue(new ErroApi('Sessão expirada. Entre novamente.', 401));
    const {result} = await renderizar(MOTORISTA, servico);

    let resultado;
    await act(async () => {
      resultado = await result.current.atualizarRota(ROTA);
    });

    expect(resultado).toEqual({ok: false});
  });

  test('salvamento que termina depois de um "Atualizar" não é descartado', async () => {
    const servico = criarServicoFalso();
    const salvamento = adiada<Rota>();
    servico.salvarRota.mockReturnValue(salvamento.promessa);
    const {result} = await renderizar(MOTORISTA, servico);
    const alterada = {...ROTA, status: 'Em andamento' as const};

    let pendente: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pendente = result.current.atualizarRota(alterada);
      await result.current.recarregar();
      salvamento.resolver(alterada);
      await pendente;
    });

    expect(result.current.estado).toMatchObject({tipo: 'pronto', rota: {status: 'Em andamento'}});
  });
});
