import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {ArmazenamentoViagens, armazenamentoViagensSeguro} from '../servicos/armazenamentoViagens';
import {atrasoDoPasso, PontoRegistrado, ResumoDaViagem} from '../viagens';
import {useStoreDaPosicao} from './LocalizacaoViewModel';
import {DadosDaViagem, EstadoDoRegistro, iniciarRegistro} from './registroDeViagem';

// ---------------------------------------------------------------------------------------------
// Gravação enquanto a rota está em andamento
// ---------------------------------------------------------------------------------------------

const ContextoDoRegistro = createContext<EstadoDoRegistro>('inativo');

type PropsDoRegistro = {
  /** Dados da viagem enquanto houver rota em andamento; `null` quando não se deve gravar. */
  viagem: DadosDaViagem | null;
  armazenamento?: ArmazenamentoViagens;
  children: React.ReactNode;
};

/** Grava o trajeto percorrido (no aparelho); dentro do `LocalizacaoProvider`. Funciona sem internet. */
export function RegistroDeViagemProvider({viagem, armazenamento = armazenamentoViagensSeguro, children}: PropsDoRegistro) {
  const posicaoStore = useStoreDaPosicao();
  const [estado, setEstado] = useState<EstadoDoRegistro>('inativo');
  const usuarioId = viagem?.usuarioId ?? null;
  const rotaId = viagem?.rotaId ?? null;
  const rotaNome = viagem?.rotaNome ?? '';

  useEffect(() => {
    if (!usuarioId || !rotaId) {
      setEstado('inativo');
      return undefined;
    }
    const registro = iniciarRegistro({
      posicaoStore,
      armazenamento,
      relogio: {agora: Date.now},
      viagem: {usuarioId, rotaId, rotaNome},
      aoEstado: setEstado,
    });
    return () => {
      registro.parar().catch(() => {});
    };
    // O nome da rota pode mudar sem que a viagem seja outra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuarioId, rotaId, posicaoStore, armazenamento]);

  return <ContextoDoRegistro.Provider value={estado}>{children}</ContextoDoRegistro.Provider>;
}

export function useEstadoDoRegistro(): EstadoDoRegistro {
  return useContext(ContextoDoRegistro);
}

// ---------------------------------------------------------------------------------------------
// Lista de viagens
// ---------------------------------------------------------------------------------------------

export type EstadoDasViagens =
  | {tipo: 'carregando'}
  | {tipo: 'erro'; mensagem: string}
  | {tipo: 'pronto'; viagens: ResumoDaViagem[]};

export type ViagensViewModel = {
  estado: EstadoDasViagens;
  recarregar: () => Promise<void>;
  /** Apaga a viagem (e seus pontos) deste aparelho. */
  apagar: (viagem: ResumoDaViagem) => Promise<boolean>;
};

export function useViagensViewModel(usuarioId: string, armazenamento: ArmazenamentoViagens = armazenamentoViagensSeguro): ViagensViewModel {
  const [estado, setEstado] = useState<EstadoDasViagens>({tipo: 'carregando'});
  const consulta = useRef(0);

  const recarregar = useCallback(async () => {
    const minha = ++consulta.current;
    try {
      const viagens = await armazenamento.listar(usuarioId);
      if (minha === consulta.current) {
        setEstado({tipo: 'pronto', viagens});
      }
    } catch {
      if (minha === consulta.current) {
        setEstado({tipo: 'erro', mensagem: 'Não foi possível ler as viagens gravadas neste aparelho.'});
      }
    }
  }, [armazenamento, usuarioId]);

  useEffect(() => {
    recarregar();
    return () => {
      // Resposta que chegar depois de sair da tela é descartada.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      consulta.current++;
    };
  }, [recarregar]);

  const apagar = useCallback(
    async (viagem: ResumoDaViagem) => {
      try {
        await armazenamento.remover(viagem.id, viagem.segmentos);
      } catch {
        return false;
      }
      await recarregar();
      return true;
    },
    [armazenamento, recarregar],
  );

  return useMemo(() => ({estado, recarregar, apagar}), [estado, recarregar, apagar]);
}

// ---------------------------------------------------------------------------------------------
// Reprodução
// ---------------------------------------------------------------------------------------------

export type EstadoDaReproducao =
  | {tipo: 'carregando'}
  | {tipo: 'erro'; mensagem: string}
  | {tipo: 'pronto'; pontos: PontoRegistrado[]};

export const VELOCIDADES_DA_REPRODUCAO = [1, 5, 20] as const;

export type ReproducaoViewModel = {
  estado: EstadoDaReproducao;
  /** Ponto atual (índice na ordem do registro). */
  indice: number;
  tocando: boolean;
  velocidade: number;
  alternar: () => void;
  reiniciar: () => void;
  definirVelocidade: (velocidade: number) => void;
};

/** Reproduz os pontos na ordem do registro, com o tempo comprimido; lacunas são saltadas, nunca preenchidas. */
export function useReproducaoViewModel(
  viagem: ResumoDaViagem,
  armazenamento: ArmazenamentoViagens = armazenamentoViagensSeguro,
): ReproducaoViewModel {
  const [estado, setEstado] = useState<EstadoDaReproducao>({tipo: 'carregando'});
  const [indice, setIndice] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [velocidade, setVelocidade] = useState<number>(VELOCIDADES_DA_REPRODUCAO[1]);
  const pontos = estado.tipo === 'pronto' ? estado.pontos : null;

  useEffect(() => {
    let ativo = true;
    setEstado({tipo: 'carregando'});
    setIndice(0);
    setTocando(false);
    armazenamento.lerPontos(viagem.id, viagem.segmentos).then(
      lidos => {
        if (!ativo) {
          return;
        }
        setEstado(lidos.length > 0 ? {tipo: 'pronto', pontos: lidos} : {tipo: 'erro', mensagem: 'Esta viagem não tem pontos gravados.'});
      },
      () => ativo && setEstado({tipo: 'erro', mensagem: 'Não foi possível ler os pontos desta viagem.'}),
    );
    return () => {
      ativo = false;
    };
  }, [viagem.id, viagem.segmentos, armazenamento]);

  useEffect(() => {
    if (!tocando || !pontos) {
      return undefined;
    }
    if (indice >= pontos.length - 1) {
      setTocando(false);
      return undefined;
    }
    const espera = atrasoDoPasso(pontos[indice], pontos[indice + 1], velocidade);
    const id = setTimeout(() => setIndice(atual => Math.min(atual + 1, pontos.length - 1)), espera);
    return () => clearTimeout(id);
  }, [tocando, indice, pontos, velocidade]);

  const alternar = useCallback(() => {
    setTocando(atual => {
      if (!atual && pontos && indice >= pontos.length - 1) {
        setIndice(0); // terminou: tocar de novo recomeça
      }
      return !atual;
    });
  }, [pontos, indice]);

  const reiniciar = useCallback(() => {
    setIndice(0);
    setTocando(false);
  }, []);

  return useMemo(
    () => ({estado, indice, tocando, velocidade, alternar, reiniciar, definirVelocidade: setVelocidade}),
    [estado, indice, tocando, velocidade, alternar, reiniciar],
  );
}
