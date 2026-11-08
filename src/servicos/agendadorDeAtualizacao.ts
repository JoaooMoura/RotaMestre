import BackgroundFetch from 'react-native-background-fetch';
import {POLITICA_ATUALIZACAO} from '../atualizacao';
import {AgendadorDeAtualizacao} from './agendadorTipos';

export type {AgendadorDeAtualizacao} from './agendadorTipos';
export {agendadorNulo} from './agendadorTipos';

/**
 * Usa o react-native-background-fetch (MIT, gratuito): a tarefa roda a cada 15 min no mínimo (o Android decide o
 * momento exato), mesmo com o app fechado (tarefa "headless" registrada no index.js), só com rede e bateria não
 * baixa, e é reagendada depois de reiniciar o aparelho.
 */
export const agendadorNativo: AgendadorDeAtualizacao = {
  async iniciar(aoExecutar) {
    try {
      const status = await BackgroundFetch.configure(
        {
          minimumFetchInterval: POLITICA_ATUALIZACAO.intervaloDoAgendadorMin,
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
          requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
          requiresBatteryNotLow: true,
        },
        async taskId => {
          try {
            await aoExecutar();
          } finally {
            BackgroundFetch.finish(taskId);
          }
        },
        taskId => BackgroundFetch.finish(taskId),
      );
      return status === BackgroundFetch.STATUS_AVAILABLE;
    } catch {
      return false;
    }
  },
  async parar() {
    try {
      await BackgroundFetch.stop();
    } catch {
      // Sem o módulo nativo não há o que parar.
    }
  },
};
