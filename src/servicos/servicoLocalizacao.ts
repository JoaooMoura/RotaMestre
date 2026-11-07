import {Linking, PermissionsAndroid} from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import {LeituraBruta} from '../localizacao';

export type ResultadoPermissao = 'concedida' | 'aproximada' | 'negada' | 'negadaPermanente';

export type ErroLocalizacao = 'permissaoNegada' | 'gpsIndisponivel' | 'tempoEsgotado';

export type OpcoesColeta = {intervaloMs: number};

export type Coleta = {parar: () => void};

export type ServicoLocalizacao = {
  /** Consulta a permissão atual sem abrir diálogo. */
  verificarPermissao: () => Promise<ResultadoPermissao>;
  solicitarPermissao: () => Promise<ResultadoPermissao>;
  iniciarColeta: (
    opcoes: OpcoesColeta,
    aoLeitura: (leitura: LeituraBruta) => void,
    aoErro: (erro: ErroLocalizacao) => void,
  ) => Coleta;
  abrirConfiguracoes: (qual: 'aplicativo' | 'localizacao') => Promise<void>;
};

const FINA = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const APROXIMADA = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

const CODIGO_PERMISSAO_NEGADA = 1;
const CODIGO_INDISPONIVEL = 2;

function traduzirErro(codigo: number): ErroLocalizacao {
  if (codigo === CODIGO_PERMISSAO_NEGADA) {
    return 'permissaoNegada';
  }
  return codigo === CODIGO_INDISPONIVEL ? 'gpsIndisponivel' : 'tempoEsgotado';
}

let configurado = false;
function configurarUmaVez() {
  if (!configurado) {
    // A permissão é pedida por este serviço, não pela biblioteca; o provedor fundido do Google
    // gasta menos bateria que o LocationManager puro.
    Geolocation.setRNConfiguration({skipPermissionRequests: true, locationProvider: 'playServices'});
    configurado = true;
  }
}

export const servicoLocalizacaoNativo: ServicoLocalizacao = {
  async verificarPermissao() {
    if (await PermissionsAndroid.check(FINA)) {
      return 'concedida';
    }
    return (await PermissionsAndroid.check(APROXIMADA)) ? 'aproximada' : 'negada';
  },

  async solicitarPermissao() {
    const resultados = await PermissionsAndroid.requestMultiple([FINA, APROXIMADA]);
    if (resultados[FINA] === PermissionsAndroid.RESULTS.GRANTED) {
      return 'concedida';
    }
    if (resultados[APROXIMADA] === PermissionsAndroid.RESULTS.GRANTED) {
      return 'aproximada';
    }
    const permanente =
      resultados[FINA] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
      resultados[APROXIMADA] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
    return permanente ? 'negadaPermanente' : 'negada';
  },

  iniciarColeta({intervaloMs}, aoLeitura, aoErro) {
    configurarUmaVez();
    const identificador = Geolocation.watchPosition(
      ({coords, timestamp}) =>
        aoLeitura({
          latitude: coords.latitude,
          longitude: coords.longitude,
          precisaoM: Number.isFinite(coords.accuracy) ? coords.accuracy : null,
          velocidadeMs: coords.speed !== null && coords.speed >= 0 ? coords.speed : null,
          rumoGraus: coords.heading !== null && coords.heading >= 0 ? coords.heading : null,
          registradaEm: timestamp,
        }),
      erro => aoErro(traduzirErro(erro.code)),
      {enableHighAccuracy: true, interval: intervaloMs, fastestInterval: intervaloMs, distanceFilter: 0},
    );
    let ativa = true;
    return {
      parar() {
        if (ativa) {
          ativa = false;
          Geolocation.clearWatch(identificador);
        }
      },
    };
  },

  async abrirConfiguracoes(qual) {
    if (qual === 'aplicativo') {
      await Linking.openSettings();
    } else {
      await Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS');
    }
  },
};
