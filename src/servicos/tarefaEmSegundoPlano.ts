import {atualizarProgramacao} from './atualizadorDeRotas';

type Evento = {taskId: string; timeout?: boolean};

/**
 * Tarefa que o Android executa com o app FECHADO (headless). `finalizar` avisa o sistema de que terminou
 * (obrigatório, senão ele passa a atrasar as próximas). Se o tempo acabar (`timeout`), só finaliza.
 */
export function criarTarefaEmSegundoPlano(finalizar: (taskId: string) => void, atualizar: () => Promise<unknown> = atualizarProgramacao) {
  return async ({taskId, timeout}: Evento) => {
    if (timeout) {
      finalizar(taskId);
      return;
    }
    try {
      await atualizar();
    } catch {
      // A falha fica registrada pelo atualizador; a próxima execução tenta de novo.
    } finally {
      finalizar(taskId);
    }
  };
}
