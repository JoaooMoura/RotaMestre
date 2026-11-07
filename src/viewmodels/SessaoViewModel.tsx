import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as api from '../servicos/api';
import {ArmazenamentoSessao, armazenamentoSessaoSeguro} from '../servicos/armazenamentoSessao';
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
  restaurando: boolean;
  verificando: boolean;
  erro: string;
  verificarCredenciais: (email: string, senha: string) => Promise<boolean>;
  confirmarCodigo: (codigo: string, manterConectado?: boolean) => boolean;
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

export function useSessaoViewModel(
  servico: ServicoAutenticacao,
  armazenamento: ArmazenamentoSessao,
): SessaoViewModel {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pendente, setPendente] = useState<Sessao | null>(null);
  const [restaurando, setRestaurando] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState('');
  const geracao = useRef(0);

  const sair = useCallback(() => {
    geracao.current++;
    servico.definirToken(null);
    setPendente(null);
    setUsuario(null);
    armazenamento.limpar().catch(() => {});
  }, [servico, armazenamento]);

  useEffect(() => {
    const geracaoInicial = geracao.current;

    async function restaurar() {
      try {
        const salva = await armazenamento.ler();
        if (geracao.current !== geracaoInicial) {
          return;
        }
        if (salva && salva.expiraEm > Date.now()) {
          servico.definirToken(salva.token);
          setUsuario(salva.usuario);
        } else if (salva) {
          await armazenamento.limpar();
        }
      } catch {
        await armazenamento.limpar().catch(() => {});
      } finally {
        setRestaurando(false);
      }
    }

    restaurar();
  }, [servico, armazenamento]);

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
    (codigo: string, manterConectado = false) => {
      if (!pendente || !CODIGO_SIMULADO.test(codigo)) {
        return false;
      }
      const minhaGeracao = ++geracao.current;
      servico.definirToken(pendente.token);
      setUsuario(pendente.usuario);
      if (manterConectado) {
        armazenamento
          .salvar(pendente)
          .then(() => {
            if (geracao.current !== minhaGeracao) {
              return armazenamento.limpar();
            }
          })
          .catch(() => {});
      }
      setPendente(null);
      return true;
    },
    [pendente, servico, armazenamento],
  );

  const limparErro = useCallback(() => setErro(''), []);

  return useMemo(
    () => ({
      usuario,
      restaurando,
      verificando,
      erro,
      verificarCredenciais,
      confirmarCodigo,
      sair,
      limparErro,
    }),
    [usuario, restaurando, verificando, erro, verificarCredenciais, confirmarCodigo, sair, limparErro],
  );
}

const SessaoContexto = createContext<SessaoViewModel | null>(null);

type ProviderProps = {
  servico?: ServicoAutenticacao;
  armazenamento?: ArmazenamentoSessao;
  children: React.ReactNode;
};

export function SessaoProvider({
  servico = servicoAutenticacaoApi,
  armazenamento = armazenamentoSessaoSeguro,
  children,
}: ProviderProps) {
  const viewModel = useSessaoViewModel(servico, armazenamento);
  return <SessaoContexto.Provider value={viewModel}>{children}</SessaoContexto.Provider>;
}

export function useSessao() {
  const viewModel = useContext(SessaoContexto);
  if (!viewModel) {
    throw new Error('useSessao precisa estar dentro de <SessaoProvider>.');
  }
  return viewModel;
}
