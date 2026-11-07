import EncryptedStorage from 'react-native-encrypted-storage';
import {Pendencia, PacoteOffline, pacoteValido, pendenciaValida, ResumoDoPacote, resumoDe} from '../offline';

/** Dados offline guardados no armazenamento cifrado do aparelho (react-native-encrypted-storage). */
export type ArmazenamentoOffline = {
  lerPacote: (usuarioId: string) => Promise<PacoteOffline | null>;
  salvarPacote: (pacote: PacoteOffline) => Promise<void>;
  removerPacote: (usuarioId: string) => Promise<void>;
  /** Resumo do último pacote baixado neste aparelho (para a tela de entrada). */
  lerResumo: () => Promise<ResumoDoPacote | null>;
  listarPendencias: () => Promise<Pendencia[]>;
  salvarPendencia: (pendencia: Pendencia) => Promise<void>;
  removerPendencia: (id: string) => Promise<void>;
};

const PREFIXO_PACOTE = 'rotamestre.offline.pacote.v1.';
const CHAVE_RESUMO = 'rotamestre.offline.resumo.v1';
const CHAVE_INDICE = 'rotamestre.offline.pendencias.v1';
const PREFIXO_PENDENCIA = 'rotamestre.offline.pendencia.v1.';

async function lerJson(chave: string): Promise<unknown> {
  const bruto = await EncryptedStorage.getItem(chave);
  if (!bruto) {
    return null;
  }
  try {
    return JSON.parse(bruto);
  } catch {
    return null;
  }
}

async function lerIndice(): Promise<string[]> {
  const dados = await lerJson(CHAVE_INDICE);
  return Array.isArray(dados) ? dados.filter((id): id is string => typeof id === 'string') : [];
}

export const armazenamentoOfflineSeguro: ArmazenamentoOffline = {
  async lerPacote(usuarioId) {
    const dados = await lerJson(PREFIXO_PACOTE + usuarioId);
    return pacoteValido(dados) && dados.usuario.id === usuarioId ? dados : null;
  },

  async salvarPacote(pacote) {
    await EncryptedStorage.setItem(PREFIXO_PACOTE + pacote.usuario.id, JSON.stringify(pacote));
    await EncryptedStorage.setItem(CHAVE_RESUMO, JSON.stringify(resumoDe(pacote)));
  },

  async removerPacote(usuarioId) {
    await EncryptedStorage.removeItem(PREFIXO_PACOTE + usuarioId);
    const resumo = (await lerJson(CHAVE_RESUMO)) as ResumoDoPacote | null;
    if (resumo?.usuarioId === usuarioId) {
      await EncryptedStorage.removeItem(CHAVE_RESUMO);
    }
  },

  async lerResumo() {
    const dados = (await lerJson(CHAVE_RESUMO)) as Partial<ResumoDoPacote> | null;
    return dados &&
      typeof dados.usuarioId === 'string' &&
      typeof dados.rotaId === 'string' &&
      typeof dados.baixadoEm === 'number'
      ? (dados as ResumoDoPacote)
      : null;
  },

  async listarPendencias() {
    const pendencias: Pendencia[] = [];
    for (const id of await lerIndice()) {
      const dados = await lerJson(PREFIXO_PENDENCIA + id);
      if (pendenciaValida(dados)) {
        pendencias.push(dados);
      }
    }
    return pendencias.sort((a, b) => a.coletadoEm - b.coletadoEm);
  },

  async salvarPendencia(pendencia) {
    // Primeiro o conteúdo, depois o índice: uma queda no meio nunca deixa um índice sem conteúdo.
    await EncryptedStorage.setItem(PREFIXO_PENDENCIA + pendencia.id, JSON.stringify(pendencia));
    const indice = await lerIndice();
    if (!indice.includes(pendencia.id)) {
      await EncryptedStorage.setItem(CHAVE_INDICE, JSON.stringify([...indice, pendencia.id]));
    }
  },

  async removerPendencia(id) {
    const indice = await lerIndice();
    await EncryptedStorage.setItem(CHAVE_INDICE, JSON.stringify(indice.filter(item => item !== id)));
    await EncryptedStorage.removeItem(PREFIXO_PENDENCIA + id);
  },
};
