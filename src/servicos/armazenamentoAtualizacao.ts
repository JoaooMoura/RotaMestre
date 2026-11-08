import EncryptedStorage from 'react-native-encrypted-storage';
import {EstadoDaAtualizacao, validarEstadoDaAtualizacao} from '../atualizacao';

/** Resultado da última atualização em segundo plano, guardado no aparelho (sem dados da rota em si). */
export type ArmazenamentoDeAtualizacao = {
  ler: () => Promise<EstadoDaAtualizacao | null>;
  salvar: (estado: EstadoDaAtualizacao) => Promise<void>;
};

const CHAVE = 'rotamestre.atualizacao.v1';

export const armazenamentoDeAtualizacaoSeguro: ArmazenamentoDeAtualizacao = {
  async ler() {
    const bruto = await EncryptedStorage.getItem(CHAVE);
    if (!bruto) {
      return null;
    }
    try {
      const dados = JSON.parse(bruto);
      return validarEstadoDaAtualizacao(dados) ? dados : null;
    } catch {
      return null;
    }
  },
  salvar: estado => EncryptedStorage.setItem(CHAVE, JSON.stringify(estado)),
};
