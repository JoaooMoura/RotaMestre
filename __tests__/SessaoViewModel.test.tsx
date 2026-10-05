import React from 'react';
import {act, renderHook} from '@testing-library/react-native';
import {ErroApi, SEM_CONEXAO} from '../src/servicos/api';
import {Sessao} from '../src/tipos';
import {
  ServicoAutenticacao,
  SessaoProvider,
  useSessao,
} from '../src/viewmodels/SessaoViewModel';

const SESSAO_GESTOR: Sessao = {
  token: 'token-gestor',
  usuario: {id: 'G-1', nome: 'Rodrigo', email: 'gestor@rotamestre.com', papel: 'gestor'},
};

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

async function renderizarSessao(servico: ServicoAutenticacao) {
  const wrapper = ({children}: {children: React.ReactNode}) => (
    <SessaoProvider servico={servico}>{children}</SessaoProvider>
  );
  return (await renderHook(() => useSessao(), {wrapper})).result;
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

async function entrarComoGestor(servico: ReturnType<typeof criarServicoFalso>['servico']) {
  servico.entrar.mockResolvedValue(SESSAO_GESTOR);
  const sessao = await renderizarSessao(servico);
  await act(async () => {
    await sessao.current.verificarCredenciais('gestor@rotamestre.com', '123');
  });
  await act(async () => {
    sessao.current.confirmarCodigo('123456');
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

test('useSessao fora do provider falha com mensagem clara', async () => {
  const erroConsole = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(renderHook(() => useSessao())).rejects.toThrow(
    'useSessao precisa estar dentro de <SessaoProvider>.',
  );
  erroConsole.mockRestore();
});
