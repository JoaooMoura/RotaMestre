import {OfflineManager} from '@maplibre/maplibre-react-native';
import {URL_ESTILO_MAPA} from '../configuracao';
import {LimitesDoMapa} from '../mapa';

export type PedidoDeMapa = {
  rotaId: string;
  limites: LimitesDoMapa;
  minZoom: number;
  maxZoom: number;
};

/** Pacote de mapa guardado no aparelho (blocos, estilo, fontes e ícones). */
export type ServicoMapaOffline = {
  /** Baixa a região; só resolve quando o pacote está completo. Rejeita se falhar ou for cancelado. */
  baixar: (
    pedido: PedidoDeMapa,
    aoProgresso: (percentual: number) => void,
    sinal?: {cancelado: boolean},
  ) => Promise<string>;
  /** O pacote existe e está completo. */
  disponivel: (packId: string) => Promise<boolean>;
  remover: (packId: string) => Promise<void>;
  /** Apaga pacotes que não pertencem a nenhum download concluído (restos de um download interrompido pelo sistema). */
  limparOrfaos: (manter: string[]) => Promise<void>;
};

export const servicoMapaOfflineNativo: ServicoMapaOffline = {
  baixar(pedido, aoProgresso, sinal) {
    return new Promise<string>((resolve, reject) => {
      let encerrado = false;
      let packId: string | null = null;

      const concluir = (id: string) => {
        if (!encerrado) {
          encerrado = true;
          resolve(id);
        }
      };
      const falhar = (mensagem: string) => {
        if (encerrado) {
          return;
        }
        encerrado = true;
        // Pacote incompleto não fica no aparelho: apaga antes de avisar a falha.
        (packId ? OfflineManager.deletePack(packId).catch(() => {}) : Promise.resolve()).then(() =>
          reject(new Error(mensagem)),
        );
      };

      OfflineManager.createPack(
        {
          mapStyle: URL_ESTILO_MAPA,
          bounds: pedido.limites,
          minZoom: pedido.minZoom,
          maxZoom: pedido.maxZoom,
          metadata: {rotaId: pedido.rotaId},
        },
        (pack, status) => {
          packId = pack.id;
          aoProgresso(Math.max(0, Math.min(100, status.percentage)));
          if (sinal?.cancelado) {
            falhar('Download cancelado.');
          } else if (status.state === 'complete') {
            concluir(pack.id);
          }
        },
        (pack, erro) => {
          packId = pack.id;
          falhar(erro.message || 'Falha ao baixar o mapa.');
        },
      )
        .then(pack => {
          packId = pack.id;
          if (sinal?.cancelado) {
            falhar('Download cancelado.');
          }
        })
        .catch(erro => falhar(erro instanceof Error ? erro.message : 'Falha ao iniciar o download do mapa.'));
    });
  },

  async disponivel(packId) {
    try {
      const pack = await OfflineManager.getPack(packId);
      const status = await pack.status();
      return status.state === 'complete';
    } catch {
      return false;
    }
  },

  async remover(packId) {
    try {
      await OfflineManager.deletePack(packId);
    } catch {
      // Pacote que já não existe: nada a remover.
    }
  },

  async limparOrfaos(manter) {
    try {
      const pacotes = await OfflineManager.getPacks();
      await Promise.all(pacotes.filter(pack => !manter.includes(pack.id)).map(pack => OfflineManager.deletePack(pack.id).catch(() => {})));
    } catch {
      // Sem acesso ao banco de mapas offline: nada a limpar.
    }
  },
};
