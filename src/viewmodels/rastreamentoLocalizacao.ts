import {
  estaDesatualizada,
  ESTADO_INICIAL_DO_MODO,
  intervaloDoModo,
  LeituraBruta,
  ModoColeta,
  POLITICA_LOCALIZACAO,
  Posicao,
  proximoModo,
  temBaixaPrecisao,
  velocidadeKmh,
} from '../localizacao';
import {Coleta, ErroLocalizacao, ServicoLocalizacao} from '../servicos/servicoLocalizacao';
import {ServicoPrimeiroPlano} from '../servicos/primeiroPlano';

export type Relogio = {agora: () => number};

/** Avisa quando o app vai para segundo plano (false) ou volta para a tela (true). */
export type ObservadorDeAppState = (aoMudar: (naTela: boolean) => void) => () => void;

export type EstadoLocalizacao =
  | {tipo: 'inativa'}
  | {tipo: 'solicitandoPermissao'}
  | {tipo: 'permissaoNegada'; permanente: boolean}
  | {tipo: 'permissaoAproximada'}
  | {tipo: 'gpsIndisponivel'}
  | {tipo: 'aguardandoPosicao'; semSinal: boolean}
  | {tipo: 'ativa'; modo: ModoColeta; desatualizada: boolean; baixaPrecisao: boolean};

export type Store<T> = {
  obter: () => T;
  definir: (valor: T) => void;
  assinar: (aoMudar: () => void) => () => void;
};

export function criarStore<T>(inicial: T): Store<T> {
  let valor = inicial;
  const assinantes = new Set<() => void>();
  return {
    obter: () => valor,
    definir: novo => {
      valor = novo;
      assinantes.forEach(avisar => avisar());
    },
    assinar: aoMudar => {
      assinantes.add(aoMudar);
      return () => assinantes.delete(aoMudar);
    },
  };
}

type EstatisticaDoModo = {leituras: number; intervalos: number; somaIntervalosMs: number};

/** Números do ensaio de campo (nunca guarda coordenadas). */
export type Diagnostico = {
  leituras: number;
  trocasDeModo: number;
  primeiraEm: number | null;
  ultimaEm: number | null;
  porModo: Record<ModoColeta, EstatisticaDoModo>;
};

const estatisticaVazia = (): EstatisticaDoModo => ({leituras: 0, intervalos: 0, somaIntervalosMs: 0});

export const diagnosticoInicial = (): Diagnostico => ({
  leituras: 0,
  trocasDeModo: 0,
  primeiraEm: null,
  ultimaEm: null,
  porModo: {emMovimento: estatisticaVazia(), parado: estatisticaVazia()},
});

export function intervaloMedioMs(diagnostico: Diagnostico, modo: ModoColeta) {
  const {intervalos, somaIntervalosMs} = diagnostico.porModo[modo];
  return intervalos === 0 ? null : Math.round(somaIntervalosMs / intervalos);
}

export type ParametrosRastreamento = {
  servico: ServicoLocalizacao;
  primeiroPlano: ServicoPrimeiroPlano;
  relogio: Relogio;
  observarAppState: ObservadorDeAppState;
  posicaoStore: Store<Posicao | null>;
  diagnosticoStore: Store<Diagnostico>;
  aoEstado: (estado: EstadoLocalizacao) => void;
  aoPrimeiroPlano: (ativo: boolean) => void;
};

const INTERVALO_DE_CONFERENCIA_MS = 5000;
const FRACAO_MINIMA_DO_INTERVALO = 0.25;
const ignorar = () => {};
const TITULO_NOTIFICACAO = 'RotaMestre';
const TEXTO_NOTIFICACAO = 'Acompanhando sua rota em andamento';

function mesmoEstado(a: EstadoLocalizacao, b: EstadoLocalizacao) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Mantém a localização enquanto a rota está em andamento: pede a permissão, sobe o serviço em
 * primeiro plano, coleta e ajusta a frequência ao movimento. `parar()` libera tudo e é idempotente.
 */
export function iniciarRastreamento(parametros: ParametrosRastreamento): {parar: () => void} {
  const {servico, primeiroPlano, relogio, observarAppState, posicaoStore, diagnosticoStore} = parametros;

  let encerrado = false;
  let coleta: Coleta | null = null;
  let geracaoDaColeta = 0;
  let estadoDoModo = ESTADO_INICIAL_DO_MODO;
  let leituraAnterior: LeituraBruta | null = null;
  let recebeuPosicao = false;
  let gpsComErro = false;
  let estadoAtual: EstadoLocalizacao = {tipo: 'inativa'};
  let temporizadorSemSinal: ReturnType<typeof setTimeout> | null = null;
  let temporizadorDeConferencia: ReturnType<typeof setInterval> | null = null;
  let deixarDeObservarAppState: (() => void) | null = null;

  diagnosticoStore.definir(diagnosticoInicial());
  posicaoStore.definir(null);

  function definirEstado(novo: EstadoLocalizacao) {
    if (!encerrado && !mesmoEstado(estadoAtual, novo)) {
      estadoAtual = novo;
      parametros.aoEstado(novo);
    }
  }

  function pararColeta() {
    geracaoDaColeta++;
    coleta?.parar();
    coleta = null;
  }

  function iniciarColeta() {
    const minhaGeracao = ++geracaoDaColeta;
    coleta = servico.iniciarColeta(
      {intervaloMs: intervaloDoModo(estadoDoModo.modo)},
      leitura => minhaGeracao === geracaoDaColeta && aoLeitura(leitura),
      erro => minhaGeracao === geracaoDaColeta && aoErro(erro),
    );
  }

  function registrarNoDiagnostico(posicao: Posicao, modo: ModoColeta, trocouDeModo: boolean) {
    const atual = diagnosticoStore.obter();
    const porModo = {
      emMovimento: {...atual.porModo.emMovimento},
      parado: {...atual.porModo.parado},
    };
    porModo[modo].leituras++;
    const decorrido = atual.ultimaEm === null ? 0 : posicao.recebidaEm - atual.ultimaEm;
    // Ao recriar a coleta o provedor devolve na hora a última posição: não é uma leitura no ritmo pedido.
    const noRitmo = decorrido >= intervaloDoModo(modo) * FRACAO_MINIMA_DO_INTERVALO;
    if (atual.ultimaEm !== null && !trocouDeModo && noRitmo) {
      porModo[modo].intervalos++;
      porModo[modo].somaIntervalosMs += decorrido;
    }
    diagnosticoStore.definir({
      leituras: atual.leituras + 1,
      trocasDeModo: atual.trocasDeModo + (trocouDeModo ? 1 : 0),
      primeiraEm: atual.primeiraEm ?? posicao.recebidaEm,
      ultimaEm: posicao.recebidaEm,
      porModo,
    });
  }

  function aoLeitura(leitura: LeituraBruta) {
    if (encerrado) {
      return;
    }
    const posicao: Posicao = {...leitura, recebidaEm: relogio.agora()};
    const velocidade = velocidadeKmh(leitura, leituraAnterior);
    const novoModo = proximoModo(estadoDoModo, leitura, velocidade);
    const trocouDeModo = novoModo.modo !== estadoDoModo.modo;
    estadoDoModo = novoModo;
    leituraAnterior = leitura;
    recebeuPosicao = true;
    gpsComErro = false;

    posicaoStore.definir(posicao);
    registrarNoDiagnostico(posicao, novoModo.modo, trocouDeModo);

    if (trocouDeModo) {
      pararColeta();
      iniciarColeta();
    }
    definirEstado({
      tipo: 'ativa',
      modo: estadoDoModo.modo,
      desatualizada: false,
      baixaPrecisao: temBaixaPrecisao(posicao),
    });
  }

  function encerrarPorPermissao() {
    pararColeta();
    posicaoStore.definir(null);
    primeiroPlano.desativar().catch(ignorar);
    definirEstado({tipo: 'permissaoNegada', permanente: false});
  }

  function aoErro(erro: ErroLocalizacao) {
    if (encerrado) {
      return;
    }
    if (erro === 'permissaoNegada') {
      encerrarPorPermissao();
      return;
    }
    // O provedor avisa "indisponível" também em oscilações passageiras e antes do primeiro sinal.
    // Só vira aviso quando a última posição realmente ficou velha; a coleta continua tentando.
    gpsComErro = true;
    const posicao = posicaoStore.obter();
    if (!recebeuPosicao || (posicao && !estaDesatualizada(posicao, relogio.agora(), estadoDoModo.modo))) {
      return;
    }
    definirEstado({tipo: 'gpsIndisponivel'});
  }

  function conferirDesatualizacao() {
    const posicao = posicaoStore.obter();
    if (encerrado || estadoAtual.tipo !== 'ativa' || !posicao) {
      return;
    }
    const desatualizada = estaDesatualizada(posicao, relogio.agora(), estadoAtual.modo);
    if (desatualizada && gpsComErro) {
      definirEstado({tipo: 'gpsIndisponivel'});
      return;
    }
    if (desatualizada !== estadoAtual.desatualizada) {
      definirEstado({...estadoAtual, desatualizada});
    }
  }

  function ligarConferencia() {
    if (!temporizadorDeConferencia) {
      temporizadorDeConferencia = setInterval(conferirDesatualizacao, INTERVALO_DE_CONFERENCIA_MS);
    }
  }

  function desligarConferencia() {
    if (temporizadorDeConferencia) {
      clearInterval(temporizadorDeConferencia);
      temporizadorDeConferencia = null;
    }
  }

  async function revalidarPermissaoAoVoltar() {
    const permissao = await servico.verificarPermissao();
    if (!encerrado && permissao !== 'concedida') {
      pararColeta();
      posicaoStore.definir(null);
      primeiroPlano.desativar().catch(ignorar);
      definirEstado(
        permissao === 'aproximada' ? {tipo: 'permissaoAproximada'} : {tipo: 'permissaoNegada', permanente: false},
      );
    }
  }

  async function comecar() {
    let permissao = await servico.verificarPermissao();
    if (encerrado) {
      return;
    }
    if (permissao !== 'concedida') {
      definirEstado({tipo: 'solicitandoPermissao'});
      permissao = await servico.solicitarPermissao();
      if (encerrado) {
        return;
      }
    }
    if (permissao === 'aproximada') {
      definirEstado({tipo: 'permissaoAproximada'});
      return;
    }
    if (permissao !== 'concedida') {
      definirEstado({tipo: 'permissaoNegada', permanente: permissao === 'negadaPermanente'});
      return;
    }

    // A permissão precisa estar concedida antes: no Android 14+ o serviço de localização a exige.
    definirEstado({tipo: 'aguardandoPosicao', semSinal: false});
    const resultado = await primeiroPlano.ativar(TITULO_NOTIFICACAO, TEXTO_NOTIFICACAO);
    if (encerrado) {
      primeiroPlano.desativar().catch(ignorar);
      return;
    }
    parametros.aoPrimeiroPlano(resultado === 'ativo');

    iniciarColeta();
    definirEstado({tipo: 'aguardandoPosicao', semSinal: false});
    temporizadorSemSinal = setTimeout(() => {
      if (!recebeuPosicao) {
        definirEstado({tipo: 'aguardandoPosicao', semSinal: true});
      }
    }, POLITICA_LOCALIZACAO.semSinalMs);

    ligarConferencia();
    deixarDeObservarAppState = observarAppState(naTela => {
      if (naTela) {
        conferirDesatualizacao();
        ligarConferencia();
        revalidarPermissaoAoVoltar().catch(ignorar);
      } else {
        desligarConferencia();
      }
    });
  }

  comecar().catch(() => definirEstado({tipo: 'gpsIndisponivel'}));

  return {
    parar() {
      if (encerrado) {
        return;
      }
      encerrado = true;
      pararColeta();
      desligarConferencia();
      if (temporizadorSemSinal) {
        clearTimeout(temporizadorSemSinal);
      }
      deixarDeObservarAppState?.();
      primeiroPlano.desativar().catch(ignorar);
      posicaoStore.definir(null);
    },
  };
}
