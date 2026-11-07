import {NativeModules} from 'react-native';

import {ServicoTela} from './telaTipos';

export type {ServicoTela} from './telaTipos';
export {servicoTelaNulo} from './telaTipos';

type ModuloTela = {manterAcesa: (ligada: boolean) => void};

function modulo(): ModuloTela | undefined {
  return NativeModules.TelaAcesa as ModuloTela | undefined;
}

/** Usa o módulo nativo `TelaAcesa` (FLAG_KEEP_SCREEN_ON da janela). Sem o módulo, não faz nada. */
export const servicoTelaNativo: ServicoTela = {
  manterAcesa: () => modulo()?.manterAcesa(true),
  liberar: () => modulo()?.manterAcesa(false),
};
