import {distanciaMetros} from '../geo';
import {Posicao} from '../localizacao';
import {ArmazenamentoViagens} from '../servicos/armazenamentoViagens';
import {deveGravar, PontoRegistrado, POLITICA_REGISTRO, ResumoDaViagem} from '../viagens';
import {Relogio, Store} from './rastreamentoLocalizacao';

export type EstadoDoRegistro = 'inativo' | 'gravando' | 'cheio' | 'falhou';

export type DadosDaViagem = {usuarioId: string; rotaId: string; rotaNome: string};

type Parametros = {
  posicaoStore: Store<Posicao | null>;
  armazenamento: ArmazenamentoViagens;
  relogio: Relogio;
  viagem: DadosDaViagem;
  aoEstado: (estado: EstadoDoRegistro) => void;
  novoId?: (agora: number) => string;
};

/**
 * Grava o trajeto percorrido enquanto a rota está em andamento (US09.02), no armazenamento do aparelho.
 * Cada viagem tem seu id e o que foi gravado nunca é misturado com outra. Lacunas (mais de 120 s sem
 * leitura aceita) viram um novo trecho: nada é preenchido. `parar()` descarrega o que falta e fecha a viagem.
 */
export function iniciarRegistro({posicaoStore, armazenamento, relogio, viagem, aoEstado, novoId}: Parametros): {parar: () => Promise<void>} {
  const {precisaoMaximaM, lacunaMs, descarregarACadaPontos, descarregarACadaMs, maximoDePontos, maximoDeViagens} = POLITICA_REGISTRO;
  const inicio = relogio.agora();
  const id = novoId ? novoId(inicio) : `V-${inicio}-${Math.random().toString(36).slice(2, 8)}`;
  let resumo: ResumoDaViagem = {
    id,
    usuarioId: viagem.usuarioId,
    rotaId: viagem.rotaId,
    rotaNome: viagem.rotaNome,
    iniciadaEm: inicio,
    encerradaEm: null,
    ultimoPontoEm: null,
    pontos: 0,
    lacunas: 0,
    distanciaM: 0,
    segmentos: 0,
  };
  let encerrado = false;
  let ultimoPonto: PontoRegistrado | null = null;
  let ultimaLida: Posicao | null = null;
  let pendentes: PontoRegistrado[] = [];
  let ultimoDescarregoEm = inicio;
  let estado: EstadoDoRegistro = 'gravando';
  // Tudo que escreve no armazenamento passa por esta fila, na ordem.
  let fila: Promise<void> = Promise.resolve();

  function definirEstado(novo: EstadoDoRegistro) {
    if (novo !== estado) {
      estado = novo;
      aoEstado(novo);
    }
  }

  function enfileirar(tarefa: () => Promise<void>) {
    fila = fila.then(tarefa).catch(() => definirEstado('falhou'));
    return fila;
  }

  function descarregar() {
    ultimoDescarregoEm = relogio.agora();
    const lote = pendentes;
    pendentes = [];
    const copia = {...resumo, segmentos: lote.length > 0 ? resumo.segmentos + 1 : resumo.segmentos};
    const indiceDoBloco = resumo.segmentos;
    resumo = copia;
    return enfileirar(async () => {
      if (lote.length > 0) {
        await armazenamento.salvarSegmento(id, indiceDoBloco, lote);
      }
      await armazenamento.salvarResumo(copia);
    });
  }

  // Ao começar: fecha viagens deixadas abertas (o app foi encerrado no meio) e aplica o limite de viagens.
  enfileirar(async () => {
    const existentes = await armazenamento.listar(viagem.usuarioId);
    for (const antiga of existentes) {
      if (antiga.encerradaEm === null && antiga.id !== id) {
        await armazenamento.salvarResumo({...antiga, encerradaEm: antiga.ultimoPontoEm ?? antiga.iniciadaEm});
      }
    }
    const excedentes = existentes.filter(v => v.id !== id).slice(maximoDeViagens - 1);
    for (const velha of excedentes) {
      await armazenamento.remover(velha.id, velha.segmentos);
    }
    await armazenamento.salvarResumo(resumo);
  });
  aoEstado(estado);

  function aoPosicao() {
    const posicao = posicaoStore.obter();
    if (encerrado || !posicao || posicao === ultimaLida || estado === 'cheio') {
      return;
    }
    ultimaLida = posicao;
    if (posicao.precisaoM !== null && posicao.precisaoM > precisaoMaximaM) {
      return;
    }
    const instante = posicao.registradaEm;
    const primeiraDepoisDeLacuna = ultimoPonto !== null && instante - ultimoPonto.t > lacunaMs;
    if (!primeiraDepoisDeLacuna && !deveGravar(ultimoPonto, posicao)) {
      return;
    }
    if (resumo.pontos >= maximoDePontos) {
      definirEstado('cheio');
      resumo = {...resumo, cheia: true};
      descarregar();
      return;
    }
    const ponto: PontoRegistrado = {
      la: Number(posicao.latitude.toFixed(6)),
      lo: Number(posicao.longitude.toFixed(6)),
      t: instante,
      p: posicao.precisaoM === null ? null : Math.round(posicao.precisaoM),
      ...(primeiraDepoisDeLacuna ? {g: 1 as const} : {}),
    };
    const distancia = ultimoPonto && !primeiraDepoisDeLacuna ? distanciaMetros({latitude: ultimoPonto.la, longitude: ultimoPonto.lo}, posicao) : 0;
    resumo = {
      ...resumo,
      pontos: resumo.pontos + 1,
      lacunas: resumo.lacunas + (primeiraDepoisDeLacuna ? 1 : 0),
      distanciaM: resumo.distanciaM + distancia,
      ultimoPontoEm: instante,
    };
    ultimoPonto = ponto;
    pendentes.push(ponto);
    if (pendentes.length >= descarregarACadaPontos || relogio.agora() - ultimoDescarregoEm >= descarregarACadaMs) {
      descarregar();
    }
  }

  const cancelar = posicaoStore.assinar(aoPosicao);
  aoPosicao();

  return {
    async parar() {
      if (encerrado) {
        return;
      }
      encerrado = true;
      cancelar();
      resumo = {...resumo, encerradaEm: relogio.agora()};
      await descarregar();
      aoEstado('inativo');
    },
  };
}
