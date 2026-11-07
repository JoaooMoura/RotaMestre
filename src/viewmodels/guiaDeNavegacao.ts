import {
  Anuncio,
  avancarNavegacao,
  EstadoDeNavegacao,
  estadoInicialDeNavegacao,
  GuiaDeNavegacao,
  PlanoDeNavegacao,
} from '../navegacao';
import {Posicao} from '../localizacao';
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
  posicaoStore: Store<Posicao | null>;
  voz: ServicoVoz;
  aoGuia: (guia: GuiaDeNavegacao) => void;
  aoEstadoDaVoz: (estado: EstadoDaVoz) => void;
};

export type Guia = {
  parar: () => void;
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
export function iniciarGuia({plano, posicaoStore, voz, aoGuia, aoEstadoDaVoz}: ParametrosGuia): Guia {
  let encerrado = false;
  let estado: EstadoDeNavegacao = estadoInicialDeNavegacao(plano);
  let estadoDaVoz: EstadoDaVoz = estadoInicialDaVoz;
  let confiavel = true;
  let ultimaPosicao: Posicao | null = null;

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
    ultimaPosicao = posicao;
    if (!confiavel) {
      return;
    }
    const resultado = avancarNavegacao(plano, estado, posicao);
    estado = resultado.estado;
    aoGuia(resultado.guia);
    resultado.anuncios.forEach((anuncio: Anuncio) => falar(anuncio.texto, anuncio.urgente));
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
