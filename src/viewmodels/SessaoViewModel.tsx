import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import * as api from '../servicos/api';
import {Sessao, Usuario} from '../tipos';

export type ServicoAutenticacao = {
  entrar: (email: string, senha: string) => Promise<Sessao>;
  definirToken: (token: string | null) => void;
  aoExpirarSessao: (callback: () => void) => () => void;
};

export const servicoAutenticacaoApi: ServicoAutenticacao = {
  entrar: api.entrar,
  definirToken: api.definirToken,
  aoExpirarSessao: api.aoExpirarSessao,
};

export type SessaoViewModel = {
  usuario: Usuario | null;
  verificando: boolean;
  erro: string;
  verificarCredenciais: (email: string, senha: string) => Promise<boolean>;
  confirmarCodigo: (codigo: string) => boolean;
  sair: () => void;
  limparErro: () => void;
};

const CODIGO_SIMULADO = /^\d{6}$/;

function mensagemDeFalha(falha: unknown) {
  if (falha instanceof api.ErroApi) {
    return falha.message;
  }
  return 'Não foi possível entrar. Tente novamente.';
}

export function useSessaoViewModel(servico: ServicoAutenticacao): SessaoViewModel {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pendente, setPendente] = useState<Sessao | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState('');

  const sair = useCallback(() => {
    servico.definirToken(null);
    setPendente(null);
    setUsuario(null);
  }, [servico]);

  useEffect(
    () =>
      servico.aoExpirarSessao(() => {
        sair();
        setErro('Sessão expirada. Entre novamente.');
      }),
    [servico, sair],
  );

  const verificarCredenciais = useCallback(
    async (email: string, senha: string) => {
      if (!email.trim() || !senha) {
        setErro('Informe o e-mail e a senha.');
        return false;
      }

      setVerificando(true);
      setErro('');
      try {
        setPendente(await servico.entrar(email.trim(), senha));
        return true;
      } catch (falha) {
        setErro(mensagemDeFalha(falha));
        return false;
      } finally {
        setVerificando(false);
      }
    },
    [servico],
  );

  const confirmarCodigo = useCallback(
    (codigo: string) => {
      if (!pendente || !CODIGO_SIMULADO.test(codigo)) {
        return false;
      }
      servico.definirToken(pendente.token);
      setUsuario(pendente.usuario);
      setPendente(null);
      return true;
    },
    [pendente, servico],
  );

  const limparErro = useCallback(() => setErro(''), []);

  return useMemo(
    () => ({usuario, verificando, erro, verificarCredenciais, confirmarCodigo, sair, limparErro}),
    [usuario, verificando, erro, verificarCredenciais, confirmarCodigo, sair, limparErro],
  );
}

const SessaoContexto = createContext<SessaoViewModel | null>(null);

type ProviderProps = {
  servico?: ServicoAutenticacao;
  children: React.ReactNode;
};

export function SessaoProvider({servico = servicoAutenticacaoApi, children}: ProviderProps) {
  const viewModel = useSessaoViewModel(servico);
  return <SessaoContexto.Provider value={viewModel}>{children}</SessaoContexto.Provider>;
}

export function useSessao() {
  const viewModel = useContext(SessaoContexto);
  if (!viewModel) {
    throw new Error('useSessao precisa estar dentro de <SessaoProvider>.');
  }
  return viewModel;
}
