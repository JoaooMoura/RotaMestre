import {PermissionsAndroid, Platform} from 'react-native';
import BackgroundService from 'react-native-background-actions';

export type ResultadoPrimeiroPlano = 'ativo' | 'indisponivel';

export type ServicoPrimeiroPlano = {
  /** Mantém o app vivo com o aparelho bloqueado ou o app minimizado (notificação fixa do Android). */
  ativar: (titulo: string, descricao: string) => Promise<ResultadoPrimeiroPlano>;
  desativar: () => Promise<void>;
};

const API_NOTIFICACOES_EM_EXECUCAO = 33;

async function pedirPermissaoDeNotificacao() {
  if (Platform.OS !== 'android' || Platform.Version < API_NOTIFICACOES_EM_EXECUCAO) {
    return;
  }
  try {
    await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
  } catch {
    // Sem permissão a notificação fica oculta, mas o serviço continua funcionando.
  }
}

export const servicoPrimeiroPlanoNativo: ServicoPrimeiroPlano = {
  async ativar(titulo, descricao) {
    try {
      if (BackgroundService.isRunning()) {
        await BackgroundService.updateNotification({taskTitle: titulo, taskDesc: descricao});
        return 'ativo';
      }
      // O serviço funciona sem a notificação visível; o diálogo não pode atrasar a coleta de localização.
      pedirPermissaoDeNotificacao().catch(() => {});
      // A tarefa só segura o serviço em primeiro plano; a coleta é feita pelo serviço de localização.
      await BackgroundService.start(() => new Promise<void>(() => {}), {
        taskName: 'RotaMestreLocalizacao',
        taskTitle: titulo,
        taskDesc: descricao,
        taskIcon: {name: 'ic_launcher', type: 'mipmap'},
        color: '#1D4ED8',
        foregroundServiceType: ['location'],
      });
      return 'ativo';
    } catch {
      return 'indisponivel';
    }
  },

  async desativar() {
    try {
      if (BackgroundService.isRunning()) {
        await BackgroundService.stop();
      }
    } catch {
      // Parar um serviço que já não existe não é erro.
    }
  },
};
