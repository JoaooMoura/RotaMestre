import EncryptedStorage from 'react-native-encrypted-storage';
import {Sessao} from '../tipos';

export type ArmazenamentoSessao = {
  ler: () => Promise<Sessao | null>;
  salvar: (sessao: Sessao) => Promise<void>;
  limpar: () => Promise<void>;
};

const CHAVE = 'rotamestre.sessao.v1';

function sessaoValida(dados: any): dados is Sessao {
  return (
    typeof dados?.token === 'string' &&
    typeof dados.expiraEm === 'number' &&
    typeof dados.usuario?.id === 'string' &&
    typeof dados.usuario.nome === 'string' &&
    typeof dados.usuario.email === 'string' &&
    (dados.usuario.papel === 'gestor' || dados.usuario.papel === 'motorista')
  );
}

export const armazenamentoSessaoSeguro: ArmazenamentoSessao = {
  async ler() {
    const bruto = await EncryptedStorage.getItem(CHAVE);
    if (!bruto) {
      return null;
    }
    try {
      const dados = JSON.parse(bruto);
      return sessaoValida(dados) ? dados : null;
    } catch {
      return null;
    }
  },
  salvar: sessao => EncryptedStorage.setItem(CHAVE, JSON.stringify(sessao)),
  limpar: () => EncryptedStorage.removeItem(CHAVE),
};
