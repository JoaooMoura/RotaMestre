import {deslocar, distanciaMetros, PontoGeografico, rumoGraus} from '../geo';
import {LeituraBruta} from '../localizacao';
import {ErroLocalizacao, OpcoesColeta, ResultadoPermissao, ServicoLocalizacao} from './servicoLocalizacao';

export type CenarioSimulado = 'movimento' | 'parado' | 'desvio' | 'semSinal';

export type SimuladorGps = {
  servico: ServicoLocalizacao;
  definirCenario: (cenario: CenarioSimulado) => void;
  definirVelocidadeKmh: (velocidade: number) => void;
  definirRota: (rota: PontoGeografico[]) => void;
  definirPermissao: (permissao: ResultadoPermissao) => void;
  reiniciar: () => void;
  estado: () => {cenario: CenarioSimulado; velocidadeKmh: number; percorridoM: number};
};

type Parametros = {
  rota: PontoGeografico[];
  agora?: () => number;
  permissao?: ResultadoPermissao;
  velocidadeKmh?: number;
  desvioLateralM?: number;
};

type PontoNaRota = {ponto: PontoGeografico; rumo: number; fim: boolean};

function pontoNaRota(rota: PontoGeografico[], percorridoM: number): PontoNaRota {
  let restante = percorridoM;
  for (let i = 0; i < rota.length - 1; i++) {
    const comprimento = distanciaMetros(rota[i], rota[i + 1]);
    if (restante <= comprimento && comprimento > 0) {
      const fracao = restante / comprimento;
      return {
        ponto: {
          latitude: rota[i].latitude + (rota[i + 1].latitude - rota[i].latitude) * fracao,
          longitude: rota[i].longitude + (rota[i + 1].longitude - rota[i].longitude) * fracao,
        },
        rumo: rumoGraus(rota[i], rota[i + 1]),
        fim: false,
      };
    }
    restante -= comprimento;
  }
  const ultimo = rota[rota.length - 1];
  const rumo = rota.length > 1 ? rumoGraus(rota[rota.length - 2], ultimo) : 0;
  return {ponto: ultimo, rumo, fim: true};
}

/**
 * GPS simulado e controlável: reproduz uma rota a uma velocidade escolhida, para e desvia sob demanda.
 * Serve aos testes automatizados e ao modo de desenvolvimento (aparelho sobre a mesa).
 */
export function criarSimuladorGps({
  rota: rotaInicial,
  agora = Date.now,
  permissao: permissaoInicial = 'concedida',
  velocidadeKmh: velocidadeInicial = 40,
  desvioLateralM = 80,
}: Parametros): SimuladorGps {
  let rota = rotaInicial;
  let cenario: CenarioSimulado = 'movimento';
  let velocidadeKmh = velocidadeInicial;
  let permissao = permissaoInicial;
  let percorridoM = 0;

  function proximaLeitura(intervaloMs: number): LeituraBruta {
    const parado = cenario === 'parado';
    if (!parado) {
      percorridoM += (velocidadeKmh / 3.6) * (intervaloMs / 1000);
    }
    const {ponto, rumo, fim} = pontoNaRota(rota, percorridoM);
    const posicao = cenario === 'desvio' ? deslocar(ponto, (rumo + 90) % 360, desvioLateralM) : ponto;
    const velocidadeMs = parado || fim ? 0 : velocidadeKmh / 3.6;
    return {
      latitude: posicao.latitude,
      longitude: posicao.longitude,
      precisaoM: 5,
      velocidadeMs,
      rumoGraus: velocidadeMs === 0 ? null : rumo,
      registradaEm: agora(),
    };
  }

  const servico: ServicoLocalizacao = {
    verificarPermissao: async () => permissao,
    solicitarPermissao: async () => permissao,
    abrirConfiguracoes: async () => {},
    iniciarColeta(opcoes: OpcoesColeta, aoLeitura, aoErro: (erro: ErroLocalizacao) => void) {
      let avisouSemSinal = false;
      const temporizador = setInterval(() => {
        if (cenario === 'semSinal') {
          if (!avisouSemSinal) {
            avisouSemSinal = true;
            aoErro('gpsIndisponivel');
          }
          return;
        }
        avisouSemSinal = false;
        aoLeitura(proximaLeitura(opcoes.intervaloMs));
      }, opcoes.intervaloMs);
      return {parar: () => clearInterval(temporizador)};
    },
  };

  return {
    servico,
    definirCenario: novo => {
      cenario = novo;
    },
    definirVelocidadeKmh: velocidade => {
      velocidadeKmh = velocidade;
    },
    definirRota: nova => {
      rota = nova;
      percorridoM = 0;
    },
    definirPermissao: nova => {
      permissao = nova;
    },
    reiniciar: () => {
      percorridoM = 0;
      cenario = 'movimento';
    },
    estado: () => ({cenario, velocidadeKmh, percorridoM}),
  };
}
