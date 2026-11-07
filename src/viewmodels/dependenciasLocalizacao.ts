import {AppState} from 'react-native';
import {servicoPrimeiroPlanoNativo} from '../servicos/primeiroPlano';
import {servicoLocalizacaoNativo} from '../servicos/servicoLocalizacao';
import {criarSimuladorGps} from '../servicos/servicoLocalizacaoSimulado';
import {DependenciasLocalizacao} from './LocalizacaoViewModel';

// Trecho curto e reto de São José dos Campos; a tela do mapa troca pela rota real ao ligar o simulador.
const ROTA_SIMULADA_PADRAO = [
  {latitude: -23.18231, longitude: -45.879214},
  {latitude: -23.223555, longitude: -45.883748},
];

export const dependenciasLocalizacaoPadrao: DependenciasLocalizacao = {
  servico: servicoLocalizacaoNativo,
  primeiroPlano: servicoPrimeiroPlanoNativo,
  relogio: {agora: Date.now},
  observarAppState: aoMudar => {
    const assinatura = AppState.addEventListener('change', estado => aoMudar(estado === 'active'));
    return () => assinatura.remove();
  },
  simulador: __DEV__ ? criarSimuladorGps({rota: ROTA_SIMULADA_PADRAO}) : undefined,
};
