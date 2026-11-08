import {Vibration} from 'react-native';
import {ServicoAlerta, TipoDeAlertaSonoro} from './alertaTipos';

export type {ServicoAlerta, TipoDeAlertaSonoro} from './alertaTipos';
export {servicoAlertaNulo} from './alertaTipos';

// Padrões em ms (espera, vibra, espera, vibra...): cada alerta tem um ritmo reconhecível sem olhar a tela.
const PADROES: Record<TipoDeAlertaSonoro, number[]> = {
  aproximacao: [0, 200],
  desvio: [0, 400, 150, 400],
  velocidade: [0, 150, 100, 150, 100, 150],
};

export const servicoAlertaNativo: ServicoAlerta = {
  sinalizar: tipo => {
    try {
      Vibration.vibrate(PADROES[tipo]);
    } catch {
      // Sem vibrador (ou sem permissão): o aviso continua na tela e por voz.
    }
  },
};
