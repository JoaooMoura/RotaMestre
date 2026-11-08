import {
  Anuncio,
  avancarNavegacao,
  EstadoDeNavegacao,
  estadoInicialDeNavegacao,
  GuiaDeNavegacao,
  PlanoDeNavegacao,
} from '../navegacao';
import {
  avaliarVelocidade,
  ESTADO_INICIAL_DA_VELOCIDADE,
  EstadoDaVelocidade,
  limiteEm,
  textoDoExcesso,
} from '../alertas';
import {Posicao, velocidadeKmh} from '../localizacao';
import {ServicoAlerta, servicoAlertaNulo} from '../servicos/alertaTipos';
import {DisponibilidadeDaVoz, ServicoVoz} from '../servicos/vozTipos';
import {Store} from './rastreamentoLocalizacao';

export type EstadoDaVoz = {
  disponibilidade: 'verificando' | DisponibilidadeDaVoz;
  ligada: boolean;
  /** A última tentativa de falar falhou: a orientação segue só na tela. */
  falhou: boolean;
  ultimaFala: string | null;
};

export const estadoInicialDaVoz: EstadoDaVoz = {disponibilidade: 'verificando', ligada: true, falhou: false, ultimaFala: null};

export type ParametrosGuia = {
  plano: PlanoDeNavegacao;
  /** O desvio foi confirmado (3 leituras fora da rota): é hora de pedir um novo trajeto (US05.04). */
  aoDesvio?: () => void;
  /** O veículo voltou ao trajeto: um recálculo em andamento deixa de ser necessário. */
  aoRetorno?: () => void;
  posicaoStore: Store<Posicao | null>;
  voz: ServicoVoz;
  /** Vibração dos alertas; omitido, só há tela e voz. */
  alerta?: ServicoAlerta;
  aoGuia: (guia: GuiaDeNavegacao) => void;
  aoEstadoDaVoz: (estado: EstadoDaVoz) => void;
};

export type Guia = {
  parar: () => void;
  /** Troca o trajeto (recálculo bem-sucedido): a orientação recomeça no novo plano, sem repetir "Navegação iniciada". */
  trocarPlano: (novo: PlanoDeNavegacao) => void;
  /** A localização está confiável (true) ou perdida/desatualizada (false). */
  definirLocalizacaoConfiavel: (confiavel: boolean) => void;
  definirVozLigada: (ligada: boolean) => void;
  instalarVozes: () => Promise<void>;
  verificarVozNovamente: () => Promise<void>;
};

const TEXTO_SINAL_PERDIDO = 'Sinal de GPS perdido. A orientação está pausada.';
const TEXTO_SINAL_RECUPERADO = 'Sinal de GPS recuperado.';

/**
 * Acompanha as posições, avança a orientação e fala os avisos. Não depende de React: o ViewModel
 * só liga `aoGuia` e `aoEstadoDaVoz` ao estado da tela. `parar()` libera a assinatura e a voz.
 */
export function iniciarGuia({
  plano: planoInicial,
  posicaoStore,
  voz,
  alerta = servicoAlertaNulo,
  aoDesvio,
  aoRetorno,
  aoGuia,
  aoEstadoDaVoz,
}: ParametrosGuia): Guia {
  let plano = planoInicial;
  let encerrado = false;
  let estado: EstadoDeNavegacao = estadoInicialDeNavegacao(plano);
  let estadoDaVoz: EstadoDaVoz = estadoInicialDaVoz;
  let confiavel = true;
  let ultimaPosicao: Posicao | null = null;
  let estadoDaVelocidade: EstadoDaVelocidade = ESTADO_INICIAL_DA_VELOCIDADE;

  function atualizarVoz(parcial: Partial<EstadoDaVoz>) {
    if (encerrado) {
      return;
    }
    estadoDaVoz = {...estadoDaVoz, ...parcial};
    aoEstadoDaVoz(estadoDaVoz);
  }

  function falar(texto: string, urgente: boolean) {
    atualizarVoz({ultimaFala: texto});
    if (!estadoDaVoz.ligada || estadoDaVoz.disponibilidade !== 'disponivel') {
      return;
    }
    voz.falar(texto, {interromper: urgente}).then(
      () => estadoDaVoz.falhou && atualizarVoz({falhou: false}),
      () => atualizarVoz({falhou: true}),
    );
  }

  function aoPosicao(posicao: Posicao | null) {
    // Enquanto a voz está sendo verificada a posição espera: o primeiro aviso não pode ficar mudo.
    if (encerrado || !posicao || posicao === ultimaPosicao || estadoDaVoz.disponibilidade === 'verificando') {
      return;
    }
    const anterior = ultimaPosicao;
    ultimaPosicao = posicao;
    if (!confiavel) {
      return;
    }
    const resultado = avancarNavegacao(plano, estado, posicao);
    estado = resultado.estado;

    // Velocidade x limite validado (US05.05). Fora da rota o trecho é desconhecido: sem limite.
    const limiteKmh = resultado.guia.foraDaRota ? null : limiteEm(plano, resultado.guia.progressoM);
    const velocidade = avaliarVelocidade(estadoDaVelocidade, {
      kmh: velocidadeKmh(posicao, anterior),
      limiteKmh,
      precisaoM: posicao.precisaoM,
      agora: posicao.recebidaEm,
    });
    estadoDaVelocidade = velocidade.estado;
    aoGuia({...resultado.guia, velocidade: velocidade.info});

    resultado.anuncios.forEach((anuncio: Anuncio) => {
      falar(anuncio.texto, anuncio.urgente);
      if (anuncio.tipo === 'saiuDaRota') {
        alerta.sinalizar('desvio');
        aoDesvio?.();
      } else if (anuncio.tipo === 'voltouParaRota') {
        aoRetorno?.();
      } else if (anuncio.daParada) {
        alerta.sinalizar('aproximacao');
      }
    });
    if (velocidade.alertar) {
      // Não interrompe uma instrução de manobra em andamento: entra na fila da fala.
      falar(textoDoExcesso(velocidade.info), false);
      alerta.sinalizar('velocidade');
    }
  }

  async function verificarVoz() {
    let disponibilidade: DisponibilidadeDaVoz;
    try {
      disponibilidade = await voz.verificarDisponibilidade();
    } catch {
      disponibilidade = 'indisponivel';
    }
    atualizarVoz({disponibilidade});
  }

  const cancelarAssinatura = posicaoStore.assinar(() => aoPosicao(posicaoStore.obter()));
  verificarVoz().then(() => aoPosicao(posicaoStore.obter()));

  return {
    parar() {
      if (encerrado) {
        return;
      }
      encerrado = true;
      cancelarAssinatura();
      voz.parar().catch(() => {});
    },

    trocarPlano(novo) {
      if (encerrado) {
        return;
      }
      plano = novo;
      estado = {...estadoInicialDeNavegacao(novo), iniciou: true};
      falar(novo.textoInicial ? `Rota recalculada. ${novo.textoInicial}` : 'Rota recalculada.', true);
      ultimaPosicao = null;
      aoPosicao(posicaoStore.obter());
    },

    definirLocalizacaoConfiavel(novo) {
      if (encerrado || novo === confiavel) {
        return;
      }
      confiavel = novo;
      falar(novo ? TEXTO_SINAL_RECUPERADO : TEXTO_SINAL_PERDIDO, true);
      if (novo) {
        // A posição mais recente chegou enquanto a orientação estava pausada: processa de novo.
        ultimaPosicao = null;
        aoPosicao(posicaoStore.obter());
      }
    },

    definirVozLigada(ligada) {
      atualizarVoz({ligada});
      if (!ligada) {
        voz.parar().catch(() => {});
      }
    },

    async instalarVozes() {
      try {
        await voz.instalarVozes();
      } catch {
        atualizarVoz({falhou: true});
      }
    },

    verificarVozNovamente: verificarVoz,
  };
}
