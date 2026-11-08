import EncryptedStorage from 'react-native-encrypted-storage';
import {PontoRegistrado, ResumoDaViagem, validarPontos, validarResumo} from '../viagens';

/** Viagens gravadas no armazenamento cifrado do aparelho (nada vai ao servidor). */
export type ArmazenamentoViagens = {
  /** Viagens do motorista, da mais nova para a mais antiga. */
  listar: (usuarioId: string) => Promise<ResumoDaViagem[]>;
  salvarResumo: (resumo: ResumoDaViagem) => Promise<void>;
  /** Guarda só os pontos novos, num bloco próprio (não reescreve o que já está gravado). */
  salvarSegmento: (viagemId: string, indice: number, pontos: PontoRegistrado[]) => Promise<void>;
  /** Todos os pontos, na ordem do registro. Bloco ilegível é ignorado. */
  lerPontos: (viagemId: string, segmentos: number) => Promise<PontoRegistrado[]>;
  remover: (viagemId: string, segmentos: number) => Promise<void>;
};

const CHAVE_INDICE = 'rotamestre.viagens.indice.v1';
const prefixoSegmento = (viagemId: string) => `rotamestre.viagens.pontos.v1.${viagemId}.`;

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

async function lerIndice(): Promise<ResumoDaViagem[]> {
  const dados = await lerJson(CHAVE_INDICE);
  return Array.isArray(dados) ? dados.filter(validarResumo) : [];
}

// Duas gravações do índice ao mesmo tempo perderiam uma: tudo passa por uma fila.
let fila: Promise<unknown> = Promise.resolve();
function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = fila.then(tarefa, tarefa);
  fila = resultado.catch(() => {});
  return resultado;
}

export const armazenamentoViagensSeguro: ArmazenamentoViagens = {
  async listar(usuarioId) {
    const indice = await lerIndice();
    return indice.filter(r => r.usuarioId === usuarioId).sort((a, b) => b.iniciadaEm - a.iniciadaEm);
  },

  salvarResumo(resumo) {
    return emFila(async () => {
      const indice = await lerIndice();
      const outros = indice.filter(r => r.id !== resumo.id);
      await EncryptedStorage.setItem(CHAVE_INDICE, JSON.stringify([...outros, resumo]));
    });
  },

  async salvarSegmento(viagemId, indice, pontos) {
    await EncryptedStorage.setItem(`${prefixoSegmento(viagemId)}${indice}`, JSON.stringify(pontos));
  },

  async lerPontos(viagemId, segmentos) {
    const todos: PontoRegistrado[] = [];
    for (let i = 0; i < segmentos; i++) {
      const dados = await lerJson(`${prefixoSegmento(viagemId)}${i}`);
      if (validarPontos(dados)) {
        todos.push(...dados);
      }
    }
    return todos;
  },

  remover(viagemId, segmentos) {
    return emFila(async () => {
      for (let i = 0; i < segmentos; i++) {
        await EncryptedStorage.removeItem(`${prefixoSegmento(viagemId)}${i}`).catch(() => {});
      }
      const indice = await lerIndice();
      await EncryptedStorage.setItem(CHAVE_INDICE, JSON.stringify(indice.filter(r => r.id !== viagemId)));
    });
  },
};
