import React from 'react';
import {Alert, Pressable, Text, View} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {BotaoContornado, BotaoPrincipal} from './componentes';
import {cores, estilos} from './estilos';
import {formatarDataEHora, MENSAGEM_ENTRAR_PARA_COLETAR, PacoteOffline, Pendencia} from './offline';
import {descreverAtualizacao, EstadoDaAtualizacao} from './atualizacao';
import {textoDoMotivo} from './sincronizacao';
import {useAtualizacao} from './viewmodels/AtualizacaoViewModel';
import {Confirmacao, EstadoDoDownload, EstadoDoEnvio, SituacaoDoPacote, useOffline} from './viewmodels/OfflineViewModel';

type Props = {
  situacao: SituacaoDoPacote;
  pacote: PacoteOffline | null;
  download: EstadoDoDownload;
  aoBaixar: () => void;
  aoCancelar: () => void;
};

/** Estado do download da rota e do mapa: sempre com ícone e texto, e o "concluído" só quando está tudo no aparelho. */
export function CartaoDeDownload({situacao, pacote, download, aoBaixar, aoCancelar}: Props) {
  if (download.tipo === 'baixando') {
    const etapa = download.etapa === 'rota' ? 'Buscando a rota...' : `Baixando o mapa... ${Math.round(download.percentual)}%`;
    return (
      <View style={estilos.cartaoOffline} accessibilityLiveRegion="polite">
        <View style={estilos.localizacaoLinha}>
          <MaterialDesignIcons name="download-outline" size={24} color={cores.primaria} />
          <Text style={estilos.mapaPainelTitulo}>{etapa}</Text>
        </View>
        <View
          style={estilos.progressoFundo}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Progresso do download"
          accessibilityValue={{min: 0, max: 100, now: Math.round(download.percentual)}}>
          <View style={[estilos.progresso, {width: `${download.etapa === 'rota' ? 0 : download.percentual}%`}]} />
        </View>
        <Text style={estilos.textoApoio}>Mantenha o app aberto e conectado até terminar.</Text>
        <BotaoContornado titulo="Cancelar download" onPress={aoCancelar} />
      </View>
    );
  }

  const interrompido = download.tipo === 'interrompido' ? download : null;
  const completo = situacao === 'completo' && pacote;

  return (
    <View style={estilos.cartaoOffline}>
      {completo ? (
        <View style={estilos.localizacaoLinha}>
          <MaterialDesignIcons name="check-circle-outline" size={24} color={cores.sucesso} />
          <View style={estilos.flex}>
            <Text style={[estilos.mapaPainelTitulo, {color: cores.sucesso}]}>Disponível sem internet</Text>
            <Text style={estilos.textoApoio}>Rota e mapa baixados em {formatarDataEHora(pacote.baixadoEm)}.</Text>
          </View>
        </View>
      ) : (
        <View style={estilos.localizacaoLinha}>
          <MaterialDesignIcons name="cloud-off-outline" size={24} color={cores.acentoTexto} />
          <View style={estilos.flex}>
            <Text style={estilos.mapaPainelTitulo}>
              {situacao === 'incompleto' ? 'Mapa não está mais no aparelho' : 'Rota ainda não baixada'}
            </Text>
            <Text style={estilos.textoApoio}>
              {situacao === 'verificando'
                ? 'Conferindo o que há no aparelho...'
                : 'Baixe com internet antes de sair para consultar a rota e o mapa sem conexão.'}
            </Text>
          </View>
        </View>
      )}
      {interrompido ? (
        <View style={estilos.localizacaoLinha} accessibilityRole="alert">
          <MaterialDesignIcons name="alert-circle-outline" size={24} color={cores.erro} />
          <Text style={[estilos.textoApoio, estilos.flex]}>{interrompido.mensagem}</Text>
        </View>
      ) : null}
      {situacao === 'verificando' ? null : completo && !interrompido ? (
        <BotaoContornado titulo="Atualizar download" icone="refresh" onPress={aoBaixar} />
      ) : (
        <BotaoPrincipal titulo={interrompido ? 'Tentar baixar de novo' : 'Baixar rota e mapa'} onPress={aoBaixar} />
      )}
    </View>
  );
}

export function CartaoDeDownloadConectado({rotaId}: {rotaId: string}) {
  const offline = useOffline();
  // Sem entrar na conta não há como baixar: o servidor exige login.
  if (offline.semSessao) {
    return null;
  }
  // O pacote baixado é de OUTRA rota (a rota do dia mudou): não pode aparecer como "disponível sem internet".
  const doutraRota = offline.pacote !== null && offline.pacote.rota.id !== rotaId;
  return (
    <CartaoDeDownload
      situacao={doutraRota ? 'nenhum' : offline.situacao}
      pacote={doutraRota ? null : offline.pacote}
      download={offline.download}
      aoBaixar={offline.baixar}
      aoCancelar={offline.cancelar}
    />
  );
}

type AvisoProps = {baixadoEm: number | null; semSessao?: boolean; somenteLeitura?: boolean};

/** Faixa "sem conexão": diz o que o aparelho está mostrando e o que não dá para fazer agora. */
export function AvisoSemConexao({baixadoEm, semSessao, somenteLeitura}: AvisoProps) {
  const quando = baixadoEm === null ? '' : ` (baixada em ${formatarDataEHora(baixadoEm)})`;
  return (
    <View accessible style={[estilos.localizacaoLinha, estilos.restricaoAviso]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <MaterialDesignIcons name="cloud-off-outline" size={24} color={cores.acentoTexto} />
      <Text style={[estilos.textoApoio, estilos.flex]}>
        {somenteLeitura
          ? `Somente leitura: você está vendo a rota baixada${quando} sem entrar na conta. Dá para ver a rota, o mapa e navegar. ${MENSAGEM_ENTRAR_PARA_COLETAR}`
          : semSessao
            ? `Sessão vencida: você está vendo a rota baixada${quando}. Dá para coletar assinaturas; elas ficam guardadas e só são enviadas depois que você entrar na conta. Não é possível recalcular a rota nem alterar a programação.`
            : `Sem conexão com o servidor: você está vendo a rota baixada${quando}. Não é possível recalcular a rota nem alterar a programação; as assinaturas coletadas ficam guardadas para envio.`}
      </Text>
    </View>
  );
}

export function AvisoSemConexaoConectado() {
  const offline = useOffline();
  if (!offline.semConexao) {
    return null;
  }
  return (
    <AvisoSemConexao baixadoEm={offline.pacote?.baixadoEm ?? null} semSessao={offline.semSessao} somenteLeitura={offline.somenteLeitura} />
  );
}

type PainelDeEnviosProps = {
  pendencias: Pendencia[];
  envio: EstadoDoEnvio;
  confirmacoes: Confirmacao[];
  /** Sem login: nada vai ao servidor até entrar. */
  semSessao: boolean;
  aoEnviar: () => void;
  aoDescartar: (id: string) => void;
  aoDispensar: (id: string) => void;
};

function textoDoEstadoDeEnvio(envio: EstadoDoEnvio, semSessao: boolean) {
  if (semSessao) {
    return 'Entre na sua conta para enviar. Até lá, as assinaturas ficam guardadas neste aparelho.';
  }
  if (envio.tipo === 'enviando') {
    return 'Enviando...';
  }
  if (envio.tipo === 'aguardando') {
    if (envio.parou === 'semConexao') {
      return 'Sem conexão com o servidor. O envio é tentado de novo automaticamente.';
    }
    if (envio.parou === 'precisaLogin') {
      return 'Sua sessão expirou. Entre de novo para enviar; nada foi perdido.';
    }
    return 'O servidor não confirmou o envio. Uma nova tentativa será feita automaticamente.';
  }
  return 'Serão enviadas quando houver conexão com o servidor.';
}

/** Assinaturas coletadas sem rede: o que está aguardando, o que o servidor confirmou e o que ele rejeitou. */
export function PainelDeEnvios({pendencias, envio, confirmacoes, semSessao, aoEnviar, aoDescartar, aoDispensar}: PainelDeEnviosProps) {
  const aguardando = pendencias.filter(p => p.status !== 'rejeitada');
  const rejeitadas = pendencias.filter(p => p.status === 'rejeitada');
  if (aguardando.length === 0 && rejeitadas.length === 0 && confirmacoes.length === 0) {
    return null;
  }
  const enviando = envio.tipo === 'enviando';
  return (
    <View style={estilos.cartaoOffline}>
      {confirmacoes.map(c => (
        <View key={c.id} style={estilos.localizacaoLinha} accessibilityLiveRegion="polite">
          <MaterialDesignIcons name="check-circle-outline" size={24} color={cores.sucesso} />
          <Text style={[estilos.textoApoio, estilos.flex]}>Enviada e confirmada pelo servidor: {c.destinatario}.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Dispensar aviso de ${c.destinatario}`} style={estilos.localizacaoAcao} onPress={() => aoDispensar(c.id)}>
            <Text style={estilos.localizacaoAcaoTexto}>Dispensar</Text>
          </Pressable>
        </View>
      ))}
      {aguardando.length > 0 ? (
        <>
          <View style={estilos.localizacaoLinha}>
            <MaterialDesignIcons name="cloud-upload-outline" size={24} color={cores.acentoTexto} />
            <View style={estilos.flex}>
              <Text style={estilos.mapaPainelTitulo}>
                {aguardando.length === 1 ? '1 assinatura aguardando envio' : `${aguardando.length} assinaturas aguardando envio`}
              </Text>
              <Text style={estilos.textoApoio}>{textoDoEstadoDeEnvio(envio, semSessao)}</Text>
            </View>
          </View>
          {semSessao ? null : (
            <BotaoContornado titulo={enviando ? 'Enviando...' : 'Enviar agora'} icone="upload-outline" onPress={enviando ? () => {} : aoEnviar} />
          )}
        </>
      ) : null}
      {rejeitadas.map(p => (
        <View key={p.id} style={estilos.restricaoAviso} accessibilityRole="alert">
          <View style={estilos.localizacaoLinha}>
            <MaterialDesignIcons name="alert-circle-outline" size={24} color={cores.erro} />
            <Text style={[estilos.mapaPainelTitulo, estilos.flex]}>Rejeitada pelo servidor: {p.destinatario}</Text>
          </View>
          <Text style={estilos.textoApoio}>{textoDoMotivo(p)}</Text>
          <Text style={estilos.textoApoio}>A assinatura continua guardada neste aparelho até você decidir.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Descartar assinatura rejeitada de ${p.destinatario}`}
            style={estilos.localizacaoAcao}
            onPress={() => aoDescartar(p.id)}>
            <Text style={estilos.localizacaoAcaoTexto}>Descartar assinatura</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function PainelDeEnviosConectado() {
  const offline = useOffline();
  const descartar = (id: string) =>
    Alert.alert('Descartar assinatura?', 'Ela será apagada deste aparelho e não poderá ser recuperada.', [
      {text: 'Cancelar', style: 'cancel'},
      {text: 'Descartar', style: 'destructive', onPress: () => offline.descartarPendencia(id)},
    ]);
  return (
    <PainelDeEnvios
      pendencias={offline.pendencias}
      envio={offline.envio}
      confirmacoes={offline.confirmacoes}
      semSessao={offline.semSessao}
      aoEnviar={() => offline.enviarAgora()}
      aoDescartar={descartar}
      aoDispensar={offline.dispensarConfirmacao}
    />
  );
}

type AvisoDeAtualizacaoProps = {
  estado: EstadoDaAtualizacao | null;
  atualizando: boolean;
  aoAtualizar: () => void;
};

/** Situação da atualização da programação em segundo plano (US06.05), sempre em texto. */
export function AvisoDeAtualizacao({estado, atualizando, aoAtualizar}: AvisoDeAtualizacaoProps) {
  const descricao = descreverAtualizacao(estado);
  if (!estado && !atualizando) {
    return null;
  }
  return (
    <View style={estilos.cartaoOffline}>
      {estado?.novaRota ? (
        <View style={estilos.localizacaoLinha} accessibilityRole="alert">
          <MaterialDesignIcons name="map-marker-plus-outline" size={24} color={cores.acentoTexto} />
          <Text style={[estilos.textoApoio, estilos.flex, {color: cores.acentoTexto}]}>
            Há uma nova rota para você: {estado.novaRota.nome}. Abra a rota e baixe de novo para usá-la sem internet.
          </Text>
        </View>
      ) : null}
      {estado?.trajetoDesatualizado ? (
        <View style={estilos.localizacaoLinha} accessibilityRole="alert">
          <MaterialDesignIcons name="alert-circle-outline" size={24} color={cores.acentoTexto} />
          <Text style={[estilos.textoApoio, estilos.flex, {color: cores.acentoTexto}]}>
            As paradas mudaram, mas o trajeto no mapa ainda não foi atualizado. Conecte-se e abra o mapa.
          </Text>
        </View>
      ) : null}
      <View style={estilos.localizacaoLinha}>
        <MaterialDesignIcons name={atualizando ? 'sync' : 'update'} size={24} color={cores.textoApoio} />
        <Text style={[estilos.textoApoio, estilos.flex]} accessibilityLiveRegion="polite">
          {atualizando ? 'Atualizando a programação...' : descricao ?? 'Programação ainda não atualizada em segundo plano.'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Atualizar programação agora"
        accessibilityState={{disabled: atualizando}}
        disabled={atualizando}
        style={estilos.localizacaoAcao}
        onPress={aoAtualizar}>
        <Text style={estilos.localizacaoAcaoTexto}>Atualizar agora</Text>
      </Pressable>
    </View>
  );
}

export function AvisoDeAtualizacaoConectado() {
  const {estado, atualizando, atualizarAgora} = useAtualizacao();
  return <AvisoDeAtualizacao estado={estado} atualizando={atualizando} aoAtualizar={() => atualizarAgora()} />;
}
