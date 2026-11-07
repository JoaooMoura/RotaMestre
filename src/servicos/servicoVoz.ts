import Speech from '@mhpdev/react-native-speech';

import {ServicoVoz} from './vozTipos';

export type {DisponibilidadeDaVoz, OpcoesDeFala, ServicoVoz} from './vozTipos';
export {servicoVozNulo} from './vozTipos';

const IDIOMA = 'pt-BR';

let configurada = false;
function configurarUmaVez() {
  if (!configurada) {
    // "ducking" abaixa a música de outros apps enquanto a instrução é falada.
    Speech.configure({language: IDIOMA, ducking: true});
    configurada = true;
  }
}

export const servicoVozNativo: ServicoVoz = {
  async verificarDisponibilidade() {
    try {
      configurarUmaVez();
      const vozes = await Speech.getAvailableVoices(IDIOMA);
      return vozes.length > 0 ? 'disponivel' : 'semPortugues';
    } catch {
      return 'indisponivel';
    }
  },

  async falar(texto, opcoes = {}) {
    configurarUmaVez();
    if (opcoes.interromper) {
      await Speech.stop();
    }
    await Speech.speak(texto, {language: IDIOMA, ducking: true});
  },

  async parar() {
    await Speech.stop();
  },

  async instalarVozes() {
    await Speech.openVoiceDataInstaller();
  },
};
