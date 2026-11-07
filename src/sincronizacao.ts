import {Pendencia} from './offline';
import {EnvioDeComprovante, ErroApi, RespostaDoEnvio, SEM_CONEXAO} from './servicos/api';

export type DependenciasDeSincronizacao = {
  enviar: (rotaId: string, paradaId: string, envio: EnvioDeComprovante) => Promise<RespostaDoEnvio>;
  /** Persiste a pendência (antes e depois de cada tentativa: uma queda nunca perde nem duplica). */
  salvar: (pendencia: Pendencia) => Promise<void>;
  remover: (id: string) => Promise<void>;
  /** Chamada quando o servidor confirmou o recebimento (a pendência já foi removida). */
  aoConfirmar?: (pendencia: Pendencia, resposta: RespostaDoEnvio) => Promise<void> | void;
  aoRejeitar?: (pendencia: Pendencia) => Promise<void> | void;
  /** Interrompe o laço (usuário saiu, app fechou a tela). */
  cancelado?: () => boolean;
};

/** Por que o laço parou: tudo certo, sem servidor, sem login, ou erro que merece nova tentativa. */
export type MotivoDaParada = 'concluida' | 'semConexao' | 'precisaLogin' | 'falhou' | 'cancelada';

export type ResumoDaSincronizacao = {
  confirmadas: number;
  rejeitadas: number;
  restantes: number;
  parou: MotivoDaParada;
};

async function tentar(acao: () => Promise<void> | void | undefined) {
  try {
    await acao();
  } catch {
    // Efeito colateral opcional (atualizar tela, pacote): falhar aqui não desfaz o envio.
  }
}

/** O servidor recusou pela regra do envio (autorização, reatribuição, validação): não adianta repetir. */
function ehRejeicao(falha: unknown): falha is ErroApi {
  return falha instanceof ErroApi && [400, 403, 404, 409, 413, 422].includes(falha.status);
}

export const MOTIVOS_DE_REJEICAO: Record<string, string> = {
  REATRIBUIDA: 'Esta rota não pertence a esta conta (foi reatribuída a outro motorista).',
  JA_CONCLUIDA: 'Esta parada já foi concluída por outro registro.',
  PARADA_INEXISTENTE: 'A parada não existe mais na rota.',
  ROTA_INEXISTENTE: 'A rota não existe mais.',
  ENVIO_DE_OUTRO_USUARIO: 'Este envio pertence a outra conta.',
  ENVIO_CONFLITANTE: 'Este envio já foi usado para outra parada.',
};

export const textoDoMotivo = (pendencia: Pendencia) =>
  (pendencia.motivoDaRejeicao && MOTIVOS_DE_REJEICAO[pendencia.motivoDaRejeicao]) ||
  pendencia.ultimoErro ||
  'O servidor não aceitou este envio.';

/**
 * Envia as pendências, uma de cada vez, da mais antiga à mais nova. Só mexe nas "pendente": as
 * "rejeitada" ficam guardadas até o motorista tratar. Repetir o laço é seguro: o servidor reconhece
 * o mesmo `id` de envio e não cria outro comprovante.
 */
export async function sincronizarPendencias(
  pendencias: Pendencia[],
  dependencias: DependenciasDeSincronizacao,
): Promise<ResumoDaSincronizacao> {
  const fila = pendencias.filter(p => p.status === 'pendente');
  let confirmadas = 0;
  let rejeitadas = 0;

  const resumo = (parou: MotivoDaParada, restantesNaFila: number): ResumoDaSincronizacao => ({
    confirmadas,
    rejeitadas,
    restantes: restantesNaFila,
    parou,
  });

  for (let i = 0; i < fila.length; i++) {
    if (dependencias.cancelado?.()) {
      return resumo('cancelada', fila.length - i);
    }
    const pendencia = fila[i];
    await dependencias.salvar({...pendencia, status: 'enviando'});
    let resposta: RespostaDoEnvio;
    try {
      resposta = await dependencias.enviar(pendencia.rotaId, pendencia.paradaId, {
        idEnvio: pendencia.id,
        recebedor: pendencia.recebedor,
        assinatura: pendencia.assinatura,
        ...(pendencia.foto ? {foto: pendencia.foto} : {}),
        coletadoEm: pendencia.coletadoEm,
        coletadoPor: pendencia.usuarioId,
      });
    } catch (falha) {
      if (falha instanceof ErroApi && falha.codigo === 'COLETADO_POR_OUTRO_USUARIO') {
        // O login atual não é de quem coletou: não é rejeição da assinatura (o dono ainda pode enviá-la).
        // Volta a pendente, sem contar tentativa, e para até a conta certa entrar.
        await dependencias.salvar({...pendencia, status: 'pendente', ultimoErro: falha.message});
        return resumo('precisaLogin', fila.length - i);
      }
      if (ehRejeicao(falha)) {
        const rejeitada: Pendencia = {
          ...pendencia,
          status: 'rejeitada',
          tentativas: pendencia.tentativas + 1,
          ultimoErro: falha.message,
          motivoDaRejeicao: falha.codigo ?? `HTTP_${falha.status}`,
        };
        await dependencias.salvar(rejeitada);
        rejeitadas++;
        await tentar(() => dependencias.aoRejeitar?.(rejeitada));
        continue;
      }
      const semLogin = falha instanceof ErroApi && falha.status === 401;
      // Falha de rede ou do servidor: volta a "pendente" (o conteúdo continua intacto) e para o laço.
      await dependencias.salvar({
        ...pendencia,
        status: 'pendente',
        tentativas: semLogin ? pendencia.tentativas : pendencia.tentativas + 1,
        ultimoErro: falha instanceof Error ? falha.message : 'Falha ao enviar.',
      });
      const parou: MotivoDaParada = semLogin ? 'precisaLogin' : falha instanceof ErroApi && falha.status === SEM_CONEXAO ? 'semConexao' : 'falhou';
      return resumo(parou, fila.length - i);
    }

    // O servidor confirmou: a pendência sai do aparelho. Um erro em quem reage à confirmação não pode
    // trazê-la de volta nem contar como falha de envio.
    await dependencias.remover(pendencia.id);
    confirmadas++;
    await tentar(() => dependencias.aoConfirmar?.(pendencia, resposta));
  }
  return resumo('concluida', 0);
}
