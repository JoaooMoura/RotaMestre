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
  /**
   * Quem estava com "Manter conectado" neste aparelho, mas com o token vencido. Não é login (nada vai ao
   * servidor), só identifica o dono para coletar assinaturas sem rede. Some ao sair da conta.
   */
  usuarioGuardado: Usuario | null;
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
  const [usuarioGuardado, setUsuarioGuardado] = useState<Usuario | null>(null);
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
    setUsuarioGuardado(null);
    armazenamento.limpar().catch(() => {});
  }, [servico, armazenamento]);

  /** Troca a sessão guardada por uma só com a identidade: o token vencido é descartado, o dono continua conhecido. */
  const guardarSoIdentidade = useCallback(
    async (salva: Sessao) => {
      setUsuarioGuardado(salva.usuario);
      await armazenamento.salvar({...salva, token: '', expiraEm: 0}).catch(() => {});
    },
    [armazenamento],
  );

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
          await guardarSoIdentidade(salva);
        }
      } catch {
        await armazenamento.limpar().catch(() => {});
      } finally {
        setRestaurando(false);
      }
    }

    restaurar();
  }, [servico, armazenamento, guardarSoIdentidade]);

  useEffect(
    () =>
      servico.aoExpirarSessao(() => {
        // O token venceu no meio do uso: volta ao login, mas se o aparelho guardava a sessão, o dono continua
        // conhecido (para coletar assinaturas sem rede). Sem sessão guardada, não sobra nada.
        const minhaGeracao = ++geracao.current;
        servico.definirToken(null);
        setPendente(null);
        setUsuario(null);
        armazenamento
          .ler()
          .then(salva => {
            if (geracao.current !== minhaGeracao) {
              return undefined;
            }
            return salva ? guardarSoIdentidade(salva) : undefined;
          })
          .catch(() => {});
        setErro('Sessão expirada. Entre novamente.');
      }),
    [servico, armazenamento, guardarSoIdentidade],
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
      setUsuarioGuardado(null);
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
      usuarioGuardado,
      restaurando,
      verificando,
      erro,
      verificarCredenciais,
      confirmarCodigo,
      sair,
      limparErro,
    }),
    [usuario, usuarioGuardado, restaurando, verificando, erro, verificarCredenciais, confirmarCodigo, sair, limparErro],
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
