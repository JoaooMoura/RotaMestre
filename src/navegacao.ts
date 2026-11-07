import {distanciaMetros, PontoGeografico, projetarNoSegmento} from './geo';
import {ContextoDaManobra, iconeDaManobra, NomeDeIcone, textoDaManobra, textoDeAviso} from './instrucoes';
import {Manobra, Trajeto} from './tipos';

export const POLITICA_NAVEGACAO = {
  avisoDistanteM: 300,
  avisoProximoM: 50,
  chegadaM: 30,
  desvioM: 50,
  retornoM: 30,
  leiturasParaDesvio: 3,
  leiturasParaRetorno: 2,
  manobraCumpridaM: 15,
  janelaParaFrenteM: 800,
  janelaParaTrasM: 80,
  relocalizacaoM: 30,
  inicioDaRotaM: 100,
} as const;

export type ManobraPlanejada = Manobra & {
  /** Distância ao longo da rota, desde o início, em que a manobra acontece. */
  posicaoM: number;
  texto: string;
  icone: NomeDeIcone;
  contexto: ContextoDaManobra;
};

export type PlanoDeNavegacao = {
  pontos: PontoGeografico[];
  acumuladoM: number[];
  totalM: number;
  duracaoS: number;
  manobras: ManobraPlanejada[];
  /** Instrução de saída ("Siga pela Rua X"), dita ao iniciar. */
  textoInicial: string | null;
};

export function criarPlano(trajeto: Trajeto): PlanoDeNavegacao {
  const pontos = trajeto.geometria.coordinates.map(([longitude, latitude]) => ({latitude, longitude}));
  const acumuladoM: number[] = [0];
  for (let i = 1; i < pontos.length; i++) {
    acumuladoM.push(acumuladoM[i - 1] + distanciaMetros(pontos[i - 1], pontos[i]));
  }

  const ultimaPerna = trajeto.manobras.reduce((maior, m) => Math.max(maior, m.perna), 0);
  const manobras = trajeto.manobras.map<ManobraPlanejada>(m => {
    const contexto: ContextoDaManobra = {numeroDaParada: m.perna + 2, destinoFinal: m.perna === ultimaPerna};
    return {
      ...m,
      posicaoM: acumuladoM[Math.min(m.indice, acumuladoM.length - 1)] ?? 0,
      texto: textoDaManobra(m, contexto),
      icone: iconeDaManobra(m),
      contexto,
    };
  });

  const saida = manobras.find(m => m.tipo === 'depart');
  return {
    pontos,
    acumuladoM,
    totalM: acumuladoM[acumuladoM.length - 1] ?? 0,
    duracaoS: trajeto.duracaoS,
    manobras,
    textoInicial: saida?.texto ?? null,
  };
}

export type Projecao = {
  segmento: number;
  progressoM: number;
  distanciaDaRotaM: number;
};

function projetarEmSegmentos(plano: PlanoDeNavegacao, ponto: PontoGeografico, de: number, ate: number): Projecao | null {
  let melhor: Projecao | null = null;
  for (let i = de; i <= ate && i < plano.pontos.length - 1; i++) {
    const projecao = projetarNoSegmento(ponto, plano.pontos[i], plano.pontos[i + 1]);
    if (!melhor || projecao.distanciaM < melhor.distanciaDaRotaM) {
      melhor = {
        segmento: i,
        progressoM: plano.acumuladoM[i] + projecao.t * (plano.acumuladoM[i + 1] - plano.acumuladoM[i]),
        distanciaDaRotaM: projecao.distanciaM,
      };
    }
  }
  return melhor;
}

function segmentoEm(plano: PlanoDeNavegacao, progressoM: number) {
  let baixo = 0;
  let alto = plano.pontos.length - 2;
  while (baixo < alto) {
    const meio = Math.ceil((baixo + alto) / 2);
    if (plano.acumuladoM[meio] <= progressoM) {
      baixo = meio;
    } else {
      alto = meio - 1;
    }
  }
  return Math.max(0, baixo);
}

/**
 * Projeta a posição na rota. Procura perto do progresso já conhecido (rotas que se cruzam não
 * "pulam" de trecho); se estiver longe dela, tenta reencontrá-la em toda a rota, sem voltar muito.
 */
export function projetar(plano: PlanoDeNavegacao, ponto: PontoGeografico, progressoAtualM: number | null): Projecao | null {
  if (plano.pontos.length < 2) {
    return null;
  }
  const {janelaParaFrenteM, janelaParaTrasM, relocalizacaoM} = POLITICA_NAVEGACAO;
  const ultimoSegmento = plano.pontos.length - 2;
  if (progressoAtualM === null) {
    return projetarEmSegmentos(plano, ponto, 0, ultimoSegmento);
  }

  const de = segmentoEm(plano, Math.max(0, progressoAtualM - janelaParaTrasM));
  const ate = segmentoEm(plano, progressoAtualM + janelaParaFrenteM);
  const local = projetarEmSegmentos(plano, ponto, de, ate);
  if (local && local.distanciaDaRotaM <= POLITICA_NAVEGACAO.desvioM) {
    return local;
  }
  const global = projetarEmSegmentos(plano, ponto, 0, ultimoSegmento);
  if (global && global.distanciaDaRotaM <= relocalizacaoM && global.progressoM >= progressoAtualM - janelaParaTrasM) {
    return global;
  }
  return local ?? global;
}

export type TipoDeAnuncio = 'inicio' | 'aviso' | 'proximidade' | 'chegadaParada' | 'chegada' | 'saiuDaRota' | 'voltouParaRota';

export type Anuncio = {
  tipo: TipoDeAnuncio;
  texto: string;
  /** Interrompe a fala em andamento (manobra iminente). */
  urgente: boolean;
};

export type EstadoDeNavegacao = {
  progressoM: number | null;
  proximaManobra: number;
  anunciadas: Record<number, {distante: boolean; proximo: boolean}>;
  iniciou: boolean;
  chegou: boolean;
  foraDaRota: boolean;
  leiturasFora: number;
  leiturasDentro: number;
};

export type GuiaDeNavegacao = {
  /** Distância já percorrida ao longo da rota. */
  progressoM: number;
  manobra: ManobraPlanejada | null;
  seguinte: ManobraPlanejada | null;
  distanciaAteManobraM: number;
  restanteM: number;
  restanteS: number;
  foraDaRota: boolean;
  distanciaDaRotaM: number;
  chegou: boolean;
};

export function estadoInicialDeNavegacao(plano: PlanoDeNavegacao): EstadoDeNavegacao {
  const primeira = plano.manobras[0]?.tipo === 'depart' ? 1 : 0;
  return {
    progressoM: null,
    proximaManobra: primeira,
    anunciadas: {},
    iniciou: false,
    chegou: false,
    foraDaRota: false,
    leiturasFora: 0,
    leiturasDentro: 0,
  };
}

function montarGuia(plano: PlanoDeNavegacao, estado: EstadoDeNavegacao, distanciaDaRotaM: number): GuiaDeNavegacao {
  const manobra = plano.manobras[estado.proximaManobra] ?? plano.manobras[plano.manobras.length - 1] ?? null;
  const progresso = estado.progressoM ?? 0;
  const restanteM = Math.max(0, plano.totalM - progresso);
  return {
    progressoM: progresso,
    manobra,
    seguinte: plano.manobras[estado.proximaManobra + 1] ?? null,
    distanciaAteManobraM: manobra ? Math.max(0, manobra.posicaoM - progresso) : 0,
    restanteM,
    restanteS: plano.totalM > 0 ? Math.round(plano.duracaoS * (restanteM / plano.totalM)) : 0,
    foraDaRota: estado.foraDaRota,
    distanciaDaRotaM,
    chegou: estado.chegou,
  };
}

export type ResultadoDoAvanco = {estado: EstadoDeNavegacao; guia: GuiaDeNavegacao; anuncios: Anuncio[]};

/** Processa uma nova posição: atualiza o progresso, a próxima manobra e decide o que anunciar. */
export function avancarNavegacao(plano: PlanoDeNavegacao, anterior: EstadoDeNavegacao, posicao: PontoGeografico): ResultadoDoAvanco {
  const {avisoDistanteM, avisoProximoM, chegadaM, desvioM, retornoM, leiturasParaDesvio, leiturasParaRetorno, manobraCumpridaM} =
    POLITICA_NAVEGACAO;
  const anuncios: Anuncio[] = [];
  const estado: EstadoDeNavegacao = {...anterior, anunciadas: {...anterior.anunciadas}};

  if (estado.chegou) {
    return {estado, guia: montarGuia(plano, estado, 0), anuncios};
  }
  const projecao = projetar(plano, posicao, estado.progressoM);
  if (!projecao) {
    return {estado, guia: montarGuia(plano, estado, 0), anuncios};
  }

  if (!estado.iniciou) {
    estado.iniciou = true;
    const noComeco = projecao.progressoM <= POLITICA_NAVEGACAO.inicioDaRotaM;
    anuncios.push({
      tipo: 'inicio',
      texto: noComeco && plano.textoInicial ? `Navegação iniciada. ${plano.textoInicial}` : 'Navegação iniciada.',
      urgente: false,
    });
  }

  // Desvio: precisa de leituras seguidas longe da rota, e de duas perto para voltar (histerese).
  if (projecao.distanciaDaRotaM > desvioM) {
    estado.leiturasFora++;
    estado.leiturasDentro = 0;
    if (estado.leiturasFora >= leiturasParaDesvio && !estado.foraDaRota) {
      estado.foraDaRota = true;
      anuncios.push({tipo: 'saiuDaRota', texto: 'Você saiu da rota.', urgente: true});
    }
  } else if (projecao.distanciaDaRotaM <= retornoM) {
    estado.leiturasFora = 0;
    if (estado.foraDaRota) {
      estado.leiturasDentro++;
      if (estado.leiturasDentro >= leiturasParaRetorno) {
        estado.foraDaRota = false;
        estado.leiturasDentro = 0;
        anuncios.push({tipo: 'voltouParaRota', texto: 'De volta à rota.', urgente: false});
      }
    }
  } else if (!estado.foraDaRota) {
    estado.leiturasFora = 0;
  }

  if (estado.foraDaRota || projecao.distanciaDaRotaM > desvioM) {
    if (estado.progressoM === null) {
      estado.progressoM = projecao.progressoM;
    }
    return {estado, guia: montarGuia(plano, estado, projecao.distanciaDaRotaM), anuncios};
  }

  estado.progressoM = Math.max(estado.progressoM ?? 0, projecao.progressoM);

  // Manobras já cumpridas (passou delas) ficam para trás.
  while (
    estado.proximaManobra < plano.manobras.length - 1 &&
    plano.manobras[estado.proximaManobra].tipo !== 'arrive' &&
    plano.manobras[estado.proximaManobra].posicaoM + manobraCumpridaM < estado.progressoM
  ) {
    estado.proximaManobra++;
  }

  const manobra = plano.manobras[estado.proximaManobra];
  if (manobra) {
    const distancia = manobra.posicaoM - estado.progressoM;
    const marcas = estado.anunciadas[estado.proximaManobra] ?? {distante: false, proximo: false};

    if (manobra.tipo === 'arrive' && distancia <= chegadaM) {
      const final = manobra.contexto.destinoFinal !== false;
      anuncios.push({tipo: final ? 'chegada' : 'chegadaParada', texto: manobra.texto, urgente: true});
      if (final) {
        estado.chegou = true;
      } else {
        estado.proximaManobra++;
      }
    } else if (distancia <= avisoProximoM && !marcas.proximo) {
      estado.anunciadas[estado.proximaManobra] = {distante: true, proximo: true};
      const texto = manobra.tipo === 'arrive' ? `${manobra.contexto.destinoFinal === false ? 'A parada' : 'O destino'} está logo à frente` : manobra.texto;
      anuncios.push({tipo: 'proximidade', texto, urgente: true});
    } else if (distancia <= avisoDistanteM && !marcas.distante) {
      estado.anunciadas[estado.proximaManobra] = {...marcas, distante: true};
      anuncios.push({tipo: 'aviso', texto: textoDeAviso(manobra, distancia, manobra.contexto), urgente: false});
    }
  }

  return {estado, guia: montarGuia(plano, estado, projecao.distanciaDaRotaM), anuncios};
}
