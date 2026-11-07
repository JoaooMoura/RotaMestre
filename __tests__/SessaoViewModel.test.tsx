import React from 'react';
import {act, renderHook, waitFor} from '@testing-library/react-native';
import {ErroApi, SEM_CONEXAO} from '../src/servicos/api';
import {ArmazenamentoSessao} from '../src/servicos/armazenamentoSessao';
import {Sessao} from '../src/tipos';
import {
  ServicoAutenticacao,
  SessaoProvider,
  useSessao,
} from '../src/viewmodels/SessaoViewModel';

const SESSAO_GESTOR: Sessao = {
  token: 'token-gestor',
  usuario: {id: 'G-1', nome: 'Rodrigo', email: 'gestor@rotamestre.com', papel: 'gestor'},
  expiraEm: Date.now() + 12 * 60 * 60 * 1000,
};

function criarArmazenamentoFalso(salva: Sessao | null = null) {
  return {
    ler: jest.fn<Promise<Sessao | null>, []>().mockResolvedValue(salva),
    salvar: jest.fn<Promise<void>, [Sessao]>().mockResolvedValue(undefined),
    limpar: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  } satisfies ArmazenamentoSessao;
}

function criarServicoFalso() {
  let avisarExpiracao: () => void = () => {};
  const servico = {
    entrar: jest.fn<Promise<Sessao>, [string, string]>(),
    definirToken: jest.fn<void, [string | null]>(),
    aoExpirarSessao: jest.fn((callback: () => void) => {
      avisarExpiracao = callback;
      return () => {};
    }),
  } satisfies ServicoAutenticacao;
  return {servico, expirarSessao: () => avisarExpiracao()};
}

async function renderizarSessao(
  servico: ServicoAutenticacao,
  armazenamento: ArmazenamentoSessao = criarArmazenamentoFalso(),
) {
  const wrapper = ({children}: {children: React.ReactNode}) => (
    <SessaoProvider servico={servico} armazenamento={armazenamento}>
      {children}
    </SessaoProvider>
  );
  const {result} = await renderHook(() => useSessao(), {wrapper});
  await waitFor(() => expect(result.current.restaurando).toBe(false));
  return result;
}

test('credenciais certas não entram direto: a sessão começa só após o código', async () => {
  const {servico} = criarServicoFalso();
  servico.entrar.mockResolvedValue(SESSAO_GESTOR);
  const sessao = await renderizarSessao(servico);

  let aceitas = false;
  await act(async () => {
    aceitas = await sessao.current.verificarCredenciais(' gestor@rotamestre.com ', '123');
  });

  expect(aceitas).toBe(true);
  expect(servico.entrar).toHaveBeenCalledWith('gestor@rotamestre.com', '123');
  expect(sessao.current.usuario).toBeNull();
  expect(servico.definirToken).not.toHaveBeenCalled();

  await act(async () => {
    expect(sessao.current.confirmarCodigo('123456')).toBe(true);
  });

  expect(sessao.current.usuario).toEqual(SESSAO_GESTOR.usuario);
  expect(servico.definirToken).toHaveBeenCalledWith('token-gestor');
});

test('código que não tem 6 dígitos é recusado e não inicia a sessão', async () => {
  const {servico} = criarServicoFalso();
  servico.entrar.mockResolvedValue(SESSAO_GESTOR);
  const sessao = await renderizarSessao(servico);
  await act(async () => {
    await sessao.current.verificarCredenciais('gestor@rotamestre.com', '123');
  });

  await act(async () => {
    expect(sessao.current.confirmarCodigo('12a456')).toBe(false);
    expect(sessao.current.confirmarCodigo('12345')).toBe(false);
  });

  expect(sessao.current.usuario).toBeNull();
});

test('código sem credenciais verificadas antes não inicia a sessão', async () => {
  const {servico} = criarServicoFalso();
  const sessao = await renderizarSessao(servico);

  await act(async () => {
    expect(sessao.current.confirmarCodigo('123456')).toBe(false);
  });

  expect(sessao.current.usuario).toBeNull();
});

test('senha errada mostra a mensagem do backend e não avança', async () => {
  const {servico} = criarServicoFalso();
  servico.entrar.mockRejectedValue(new ErroApi('E-mail ou senha incorretos.', 401));
  const sessao = await renderizarSessao(servico);

  let aceitas = true;
  await act(async () => {
    aceitas = await sessao.current.verificarCredenciais('gestor@rotamestre.com', 'errada');
  });

  expect(aceitas).toBe(false);
  expect(sessao.current.erro).toBe('E-mail ou senha incorretos.');
  expect(sessao.current.verificando).toBe(false);
});

test('sem conexão a mensagem é diferente da de senha errada', async () => {
  const {servico} = criarServicoFalso();
  servico.entrar.mockRejectedValue(
    new ErroApi('Sem conexão com o servidor. Verifique a internet e tente novamente.', SEM_CONEXAO),
  );
  const sessao = await renderizarSessao(servico);

  await act(async () => {
    await sessao.current.verificarCredenciais('gestor@rotamestre.com', '123');
  });

  expect(sessao.current.erro).toBe('Sem conexão com o servidor. Verifique a internet e tente novamente.');
});

test('campos vazios são recusados sem chamar o backend', async () => {
  const {servico} = criarServicoFalso();
  const sessao = await renderizarSessao(servico);

  await act(async () => {
    expect(await sessao.current.verificarCredenciais('   ', '123')).toBe(false);
    expect(await sessao.current.verificarCredenciais('gestor@rotamestre.com', '')).toBe(false);
  });

  expect(servico.entrar).not.toHaveBeenCalled();
  expect(sessao.current.erro).toBe('Informe o e-mail e a senha.');
});

async function entrarComoGestor(
  servico: ReturnType<typeof criarServicoFalso>['servico'],
  armazenamento: ArmazenamentoSessao = criarArmazenamentoFalso(),
  manterConectado = false,
) {
  servico.entrar.mockResolvedValue(SESSAO_GESTOR);
  const sessao = await renderizarSessao(servico, armazenamento);
  await act(async () => {
    await sessao.current.verificarCredenciais('gestor@rotamestre.com', '123');
  });
  await act(async () => {
    sessao.current.confirmarCodigo('123456', manterConectado);
  });
  return sessao;
}

test('sair apaga o token e o usuário', async () => {
  const {servico} = criarServicoFalso();
  const sessao = await entrarComoGestor(servico);

  await act(async () => {
    sessao.current.sair();
  });

  expect(sessao.current.usuario).toBeNull();
  expect(servico.definirToken).toHaveBeenLastCalledWith(null);
});

test('sessão expirada no meio do uso volta ao login com aviso', async () => {
  const {servico, expirarSessao} = criarServicoFalso();
  const sessao = await entrarComoGestor(servico);

  await act(async () => {
    expirarSessao();
  });

  expect(sessao.current.usuario).toBeNull();
  expect(sessao.current.erro).toBe('Sessão expirada. Entre novamente.');
  expect(servico.definirToken).toHaveBeenLastCalledWith(null);
});

describe('sessão persistente', () => {
  test('sessão salva e dentro da validade é restaurada sem pedir login', async () => {
    const {servico} = criarServicoFalso();
    const sessao = await renderizarSessao(servico, criarArmazenamentoFalso(SESSAO_GESTOR));

    expect(sessao.current.usuario).toEqual(SESSAO_GESTOR.usuario);
    expect(servico.definirToken).toHaveBeenCalledWith('token-gestor');
  });

  test('sessão salva e vencida é apagada e leva ao login', async () => {
    const {servico} = criarServicoFalso();
    const armazenamento = criarArmazenamentoFalso({...SESSAO_GESTOR, expiraEm: Date.now() - 1000});
    const sessao = await renderizarSessao(servico, armazenamento);

    expect(sessao.current.usuario).toBeNull();
    expect(servico.definirToken).not.toHaveBeenCalled();
    expect(armazenamento.limpar).toHaveBeenCalledTimes(1);
  });

  test('sem nada salvo vai ao login sem apagar nada', async () => {
    const {servico} = criarServicoFalso();
    const armazenamento = criarArmazenamentoFalso();
    const sessao = await renderizarSessao(servico, armazenamento);

    expect(sessao.current.usuario).toBeNull();
    expect(armazenamento.limpar).not.toHaveBeenCalled();
  });

  test('falha ao ler o armazenamento apaga o conteúdo e leva ao login', async () => {
    const {servico} = criarServicoFalso();
    const armazenamento = criarArmazenamentoFalso();
    armazenamento.ler.mockRejectedValue(new Error('Keystore indisponível'));
    const sessao = await renderizarSessao(servico, armazenamento);

    expect(sessao.current.usuario).toBeNull();
    expect(sessao.current.restaurando).toBe(false);
    expect(armazenamento.limpar).toHaveBeenCalledTimes(1);
  });

  test('só grava a sessão depois do código e quando o usuário escolheu manter', async () => {
    const {servico} = criarServicoFalso();
    const armazenamento = criarArmazenamentoFalso();
    servico.entrar.mockResolvedValue(SESSAO_GESTOR);
    const sessao = await renderizarSessao(servico, armazenamento);

    await act(async () => {
      await sessao.current.verificarCredenciais('gestor@rotamestre.com', '123');
    });
    expect(armazenamento.salvar).not.toHaveBeenCalled();

    await act(async () => {
      sessao.current.confirmarCodigo('123456', true);
    });
    expect(armazenamento.salvar).toHaveBeenCalledWith(SESSAO_GESTOR);
  });

  test('sem escolher manter conectado nada é gravado', async () => {
    const {servico} = criarServicoFalso();
    const armazenamento = criarArmazenamentoFalso();
    await entrarComoGestor(servico, armazenamento);

    expect(armazenamento.salvar).not.toHaveBeenCalled();
  });

  test('sair apaga a sessão guardada', async () => {
    const {servico} = criarServicoFalso();
    const armazenamento = criarArmazenamentoFalso();
    const sessao = await entrarComoGestor(servico, armazenamento, true);

    await act(async () => {
      sessao.current.sair();
    });

    expect(armazenamento.limpar).toHaveBeenCalledTimes(1);
  });

  test('401 no meio do uso também apaga a sessão guardada', async () => {
    const {servico, expirarSessao} = criarServicoFalso();
    const armazenamento = criarArmazenamentoFalso();
    await entrarComoGestor(servico, armazenamento, true);

    await act(async () => {
      expirarSessao();
    });

    expect(armazenamento.limpar).toHaveBeenCalledTimes(1);
  });

  test('sair com a gravação ainda em andamento não deixa a sessão no armazenamento', async () => {
    const {servico} = criarServicoFalso();
    const armazenamento = criarArmazenamentoFalso();
    let terminarGravacao: () => void = () => {};
    armazenamento.salvar.mockReturnValue(
      new Promise<void>(resolve => {
        terminarGravacao = resolve;
      }),
    );
    const sessao = await entrarComoGestor(servico, armazenamento, true);

    await act(async () => {
      sessao.current.sair();
    });
    expect(armazenamento.limpar).toHaveBeenCalledTimes(1);

    await act(async () => {
      terminarGravacao();
    });

    expect(armazenamento.limpar).toHaveBeenCalledTimes(2);
  });
});

test('useSessao fora do provider falha com mensagem clara', async () => {
  const erroConsole = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(renderHook(() => useSessao())).rejects.toThrow(
    'useSessao precisa estar dentro de <SessaoProvider>.',
  );
  erroConsole.mockRestore();
});
