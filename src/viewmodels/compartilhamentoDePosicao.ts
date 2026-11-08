import {distanciaMetros} from '../geo';
import {Posicao} from '../localizacao';
import {Relogio, Store} from './rastreamentoLocalizacao';

/** O que vai ao servidor: só a leitura atual (nada de velocidade, rumo ou histórico). */
export type PosicaoCompartilhada = {
  latitude: number;
  longitude: number;
  precisaoM: number | null;
  registradaEm: number;
};

export type ServicoCompartilhamento = {
  enviar: (posicao: PosicaoCompartilhada) => Promise<void>;
  /** Avisa que deixou de compartilhar (o servidor apaga a última posição). */
  parar: () => Promise<void>;
};

export type EstadoDoCompartilhamento = 'inativo' | 'ativo' | 'falhou';

export const POLITICA_COMPARTILHAMENTO = {
  intervaloMinimoMs: 15_000,
  distanciaMinimaM: 30,
  intervaloMaximoMs: 60_000,
  precisaoMaximaM: 200,
  /** Posição mais velha que isso não é enviada como se fosse atual. */
  idadeMaximaMs: 30_000,
} as const;

type Parametros = {
  posicaoStore: Store<Posicao | null>;
  servico: ServicoCompartilhamento;
  relogio: Relogio;
  aoEstado: (estado: EstadoDoCompartilhamento) => void;
};

/**
 * Compartilha a posição com o gestor enquanto está ligado: envia ao começar, a cada 30 m andados (no mínimo
 * 15 s entre envios) e a cada 60 s no máximo. Leituras imprecisas ou velhas não são enviadas. Falha de rede
 * não acumula nada: só a leitura mais nova importa. `parar()` avisa o servidor e é idempotente.
 */
export function iniciarCompartilhamento({posicaoStore, servico, relogio, aoEstado}: Parametros): {parar: () => void} {
  const {intervaloMinimoMs, distanciaMinimaM, intervaloMaximoMs, precisaoMaximaM, idadeMaximaMs} = POLITICA_COMPARTILHAMENTO;
  let encerrado = false;
  let enviando = false;
  let ultimoEnvioEm: number | null = null;
  let ultimaEnviada: Posicao | null = null;
  let estado: EstadoDoCompartilhamento = 'ativo';
  aoEstado(estado);

  function definirEstado(novo: EstadoDoCompartilhamento) {
    if (!encerrado && novo !== estado) {
      estado = novo;
      aoEstado(novo);
    }
  }

  function devida(posicao: Posicao, agora: number) {
    if (ultimoEnvioEm === null || ultimaEnviada === null) {
      return true;
    }
    const passou = agora - ultimoEnvioEm;
    if (passou >= intervaloMaximoMs) {
      return true;
    }
    return passou >= intervaloMinimoMs && distanciaMetros(ultimaEnviada, posicao) >= distanciaMinimaM;
  }

  async function aoPosicao() {
    const posicao = posicaoStore.obter();
    const agora = relogio.agora();
    if (encerrado || enviando || !posicao) {
      return;
    }
    if (agora - posicao.recebidaEm > idadeMaximaMs || (posicao.precisaoM !== null && posicao.precisaoM > precisaoMaximaM)) {
      return;
    }
    if (!devida(posicao, agora)) {
      return;
    }
    enviando = true;
    ultimoEnvioEm = agora;
    ultimaEnviada = posicao;
    try {
      await servico.enviar({
        latitude: posicao.latitude,
        longitude: posicao.longitude,
        precisaoM: posicao.precisaoM,
        registradaEm: posicao.registradaEm,
      });
      definirEstado('ativo');
    } catch {
      definirEstado('falhou');
    } finally {
      enviando = false;
    }
  }

  const cancelar = posicaoStore.assinar(() => {
    aoPosicao();
  });
  aoPosicao();

  return {
    parar() {
      if (encerrado) {
        return;
      }
      cancelar();
      servico.parar().catch(() => {});
      encerrado = true;
      aoEstado('inativo');
    },
  };
}
