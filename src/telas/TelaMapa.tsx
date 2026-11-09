import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, Text, useWindowDimensions, View} from 'react-native';
import {Camera, CameraRef, GeoJSONSource, Layer, Map, Marker} from '@maplibre/maplibre-react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {Botao, BotaoPrincipal, Cabecalho} from '../componentes';
import {
  AlertasDaNavegacaoConectados,
  FaixaDaManobraConectada,
  PainelDeNavegacaoConectado,
  PrevisaoDeChegadaConectada,
  ChipDeVelocidadeConectado,
} from '../componentesNavegacao';
import {IndicadorLocalizacaoConectado, ResumoDeAvisosConectado} from '../componentesLocalizacao';
import {AvisoSemConexaoConectado} from '../componentesOffline';
import {URL_ESTILO_MAPA} from '../configuracao';
import {cores, estilos} from '../estilos';
import {formatarDistancia, formatarDuracao, limitesDasCoordenadas} from '../mapa';
import {Coordenada, Rota, Trajeto} from '../tipos';
import {useLocalizacao, usePosicaoAtual, useStoreDaPosicao} from '../viewmodels/LocalizacaoViewModel';
import {useMapaViewModel} from '../viewmodels/MapaViewModel';
import {useNavegacaoViewModel} from '../viewmodels/NavegacaoViewModel';
import {useOffline} from '../viewmodels/OfflineViewModel';
import {PainelSimuladorGps} from './PainelSimuladorGps';

// O painel aberto ocupa no máximo esta fração da altura; o enquadramento do trajeto deixa esse espaço livre.
const FRACAO_MAXIMA_DO_PAINEL = 0.4;
const POSICAO_ATRIBUICAO = {top: 8, right: 8};
const POSICAO_LOGO = {top: 8, left: 8};
// A bússola (aparece quando o mapa gira) fica ao lado da atribuição, nunca por cima dela.
const POSICAO_BUSSOLA = {top: 8, right: 64};
const ZOOM_DA_NAVEGACAO = 16.5;
const INTERVALO_DA_CAMERA_MS = 1500;
const LAYOUT_LINHA = {'line-cap': 'round', 'line-join': 'round'} as const;
const PAINT_LINHA = {'line-color': cores.primaria, 'line-width': 5};

type Props = {
  rota: Rota;
  onVoltar: () => void;
};

export function TelaMapa({rota, onVoltar}: Props) {
  const offline = useOffline();
  const baixado = offline.pacote?.rota.id === rota.id ? offline.pacote.trajeto : null;
  const {estado, recarregar} = useMapaViewModel(rota.id, undefined, {baixado, somenteBaixado: offline.semConexao});

  return (
    <View style={estilos.tela}>
      <Cabecalho titulo="Mapa da rota" subtitulo={`${rota.id} - ${rota.nome}`} onVoltar={onVoltar} />
      {estado.tipo === 'carregando' ? (
        <View style={estilos.centro}>
          <ActivityIndicator size="large" />
          <Text style={estilos.subtitulo}>Traçando o trajeto...</Text>
        </View>
      ) : null}
      {estado.tipo === 'erro' ? (
        <View style={estilos.centro}>
          <Text style={[estilos.titulo, estilos.textoCentral]}>Não foi possível abrir o mapa</Text>
          <Text style={[estilos.subtitulo, estilos.textoCentral]}>{estado.mensagem}</Text>
          <View style={estilos.larguraTotalTopo18}>
            <Botao titulo="Tentar novamente" onPress={recarregar} />
          </View>
        </View>
      ) : null}
      {estado.tipo === 'semTrajeto' ? (
        <View style={estilos.centro}>
          <Text style={[estilos.titulo, estilos.textoCentral]}>Trajeto indisponível</Text>
          <Text style={[estilos.subtitulo, estilos.textoCentral]}>{estado.mensagem}</Text>
          <View style={estilos.larguraTotalTopo18}>
            <Botao titulo="Tentar novamente" secundario onPress={recarregar} />
          </View>
        </View>
      ) : null}
      {estado.tipo === 'pronto' ? <MapaDoTrajeto trajeto={estado.trajeto} /> : null}
    </View>
  );
}

function MapaDoTrajeto({trajeto: trajetoOriginal}: {trajeto: Trajeto}) {
  const offline = useOffline();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [mapaFalhou, setMapaFalhou] = useState(false);
  // Sem sessão não há como pedir um novo trajeto ao servidor (US05.04). Depois de um recálculo, `trajeto` é o novo.
  const navegacao = useNavegacaoViewModel(trajetoOriginal, undefined, {recalculoDisponivel: !offline.semSessao});
  const trajeto = navegacao.trajeto;
  // Objetos estáveis: sem isso, cada toque numa parada reenviaria a geometria ao mapa nativo.
  const dadosDoTrajeto = useMemo(
    () => ({type: 'Feature' as const, properties: {}, geometry: trajeto.geometria}),
    [trajeto.geometria],
  );
  const {height: alturaDaTela} = useWindowDimensions();
  const alturaMaximaDoPainel = Math.round(alturaDaTela * FRACAO_MAXIMA_DO_PAINEL);
  // Só o padding muda com o painel: o mapa ocupa a tela toda e o trajeto é enquadrado acima do painel.
  const preenchimentoDoTrajeto = useMemo(
    () => ({top: 64, right: 48, bottom: alturaMaximaDoPainel, left: 48}),
    [alturaMaximaDoPainel],
  );
  const visaoInicial = useMemo(() => {
    const limites = limitesDasCoordenadas(trajeto.geometria.coordinates);
    return limites
      ? {bounds: limites, padding: preenchimentoDoTrajeto}
      : {center: [trajeto.paradas[0].longitude, trajeto.paradas[0].latitude] as Coordenada, zoom: 12};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trajeto.geometria, trajeto.paradas]);
  const posicoes = useMemo(
    () => trajeto.paradas.map(parada => [parada.longitude, parada.latitude] as Coordenada),
    [trajeto.paradas],
  );
  const selecionada = trajeto.paradas.find(parada => parada.id === selecionadaId);
  const posicaoStore = useStoreDaPosicao();
  const cameraRef = useRef<CameraRef>(null);
  const navegando = navegacao.estado.tipo !== 'inativa';
  const seguindo = navegacao.estado.tipo === 'navegando';
  // Painel: aberto fora da navegação, fechado durante ela (o mapa fica livre). Ao iniciar fecha; ao encerrar abre.
  const [painelAberto, setPainelAberto] = useState(!navegando);
  const navegandoAntes = useRef(navegando);
  useEffect(() => {
    if (navegandoAntes.current !== navegando) {
      navegandoAntes.current = navegando;
      setPainelAberto(!navegando);
    }
  }, [navegando]);

  // Durante a navegação a câmera acompanha o veículo (no máximo a cada 1,5 s, para não pesar na tela).
  useEffect(() => {
    if (!seguindo) {
      return undefined;
    }
    let ultimaEm = 0;
    const seguir = () => {
      const posicao = posicaoStore.obter();
      const agora = Date.now();
      if (posicao && agora - ultimaEm >= INTERVALO_DA_CAMERA_MS) {
        ultimaEm = agora;
        cameraRef.current?.easeTo({
          center: [posicao.longitude, posicao.latitude],
          zoom: ZOOM_DA_NAVEGACAO,
          bearing: posicao.rumoGraus ?? 0,
          duration: 1000,
        });
      }
    };
    seguir();
    return posicaoStore.assinar(seguir);
  }, [seguindo, posicaoStore]);

  // Ao encerrar, volta a enquadrar a rota inteira.
  const estavaNavegando = useRef(false);
  useEffect(() => {
    if (estavaNavegando.current && !navegando) {
      const limites = limitesDasCoordenadas(trajeto.geometria.coordinates);
      if (limites) {
        cameraRef.current?.fitBounds(limites, {padding: preenchimentoDoTrajeto, bearing: 0, duration: 800});
      }
    }
    estavaNavegando.current = navegando;
  }, [navegando, trajeto.geometria, preenchimentoDoTrajeto]);
  const rotaSimulada = useMemo(
    () => trajeto.geometria.coordinates.map(([longitude, latitude]) => ({latitude, longitude})),
    [trajeto.geometria],
  );

  return (
    <View style={estilos.mapaTela}>
      <Map
        style={estilos.mapaTela}
        mapStyle={URL_ESTILO_MAPA}
        attributionPosition={POSICAO_ATRIBUICAO}
        logoPosition={POSICAO_LOGO}
        compassPosition={POSICAO_BUSSOLA}
        onDidFailLoadingMap={() => setMapaFalhou(true)}
        onDidFinishLoadingMap={() => setMapaFalhou(false)}>
        <Camera ref={cameraRef} initialViewState={visaoInicial} />
        <GeoJSONSource id="trajeto" data={dadosDoTrajeto}>
          <Layer id="trajeto-linha" type="line" layout={LAYOUT_LINHA} paint={PAINT_LINHA} />
        </GeoJSONSource>
        {trajeto.paradas.map((parada, indice) =>
          parada.origem ? null : (
          <Marker
            key={parada.id}
            id={`parada-${parada.id}`}
            lngLat={posicoes[indice]}
            onPress={() => setSelecionadaId(parada.id)}>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Parada ${parada.numero ?? indice + 1}: ${parada.destinatario}, ${parada.status}`}
              style={[
                estilos.mapaMarcador,
                parada.status === 'Concluída' && estilos.mapaMarcadorConcluida,
                parada.id === selecionadaId && estilos.mapaMarcadorSelecionado,
              ]}>
              <View style={estilos.mapaMarcadorConteudo}>
                <Text style={estilos.mapaMarcadorTexto}>{parada.numero ?? indice + 1}</Text>
                {parada.status === 'Concluída' ? (
                  <MaterialDesignIcons name="check-bold" size={16} color="#FFFFFF" />
                ) : null}
              </View>
            </View>
          </Marker>
          ),
        )}
        <MarcadorDoVeiculo />
      </Map>

      {mapaFalhou || navegando ? (
        <View style={estilos.mapaFaixaDeNavegacao}>
          {mapaFalhou ? (
            <View style={estilos.mapaAvisoEmLinha} accessibilityLiveRegion="polite">
              <Text style={estilos.mapaAvisoTexto}>
                Não foi possível carregar o mapa de fundo. O trajeto e as paradas continuam disponíveis.
              </Text>
            </View>
          ) : null}
          {navegando ? (
            <>
              <FaixaDaManobraConectada navegacao={navegacao} />
              <AlertasDaNavegacaoConectados navegacao={navegacao} />
            </>
          ) : null}
        </View>
      ) : null}

      <View style={estilos.mapaRodape}>
        <View style={estilos.mapaRodapeLinha}>
          {navegando ? <ChipDeVelocidadeConectado navegacao={navegacao} /> : <View />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={painelAberto ? 'Fechar painel da rota' : 'Abrir painel da rota'}
            accessibilityState={{expanded: painelAberto}}
            onPress={() => setPainelAberto(aberto => !aberto)}
            style={({pressed}) => [estilos.mapaFab, pressed && estilos.mapaFabPressionado]}>
            <MaterialDesignIcons name={painelAberto ? 'close' : 'menu'} size={28} color="#FFFFFF" />
          </Pressable>
        </View>

        {painelAberto ? (
          <View style={[estilos.mapaPainelFolha, {maxHeight: alturaMaximaDoPainel}]}>
            <View style={estilos.mapaPainelCabecalho}>
              <Text style={estilos.mapaPainelTitulo}>Painel da rota</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fechar painel"
                style={estilos.mapaPainelFechar}
                onPress={() => setPainelAberto(false)}>
                <MaterialDesignIcons name="close" size={24} color={cores.textoApoio} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={estilos.mapaPainelConteudo} nestedScrollEnabled>
              <AvisoSemConexaoConectado />
              {navegando ? (
                <PainelDeNavegacaoConectado navegacao={navegacao}>
                  <PrevisaoDeChegadaConectada trajeto={trajeto} navegacao={navegacao} compacta />
                  <ResumoDeAvisosConectado />
                </PainelDeNavegacaoConectado>
              ) : (
                <>
                  <IndicadorLocalizacaoConectado />
                  {selecionada ? (
                    <>
                      <Text style={estilos.mapaPainelTitulo}>{selecionada.destinatario}</Text>
                      <Text style={estilos.textoApoio}>{selecionada.endereco}</Text>
                      <Text style={estilos.textoApoio}>
                        {selecionada.tipo} • {selecionada.status}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={estilos.mapaPainelTitulo}>
                        {trajeto.paradas.length} paradas • {formatarDistancia(trajeto.distanciaM)} •{' '}
                        {formatarDuracao(trajeto.duracaoS)}
                      </Text>
                      <Text style={estilos.textoApoio}>
                        Estimativa pela distância das vias, sem trânsito. Toque em uma parada para ver os detalhes.
                      </Text>
                    </>
                  )}
                  <PrevisaoDeChegadaConectada trajeto={trajeto} navegacao={navegacao} />
                </>
              )}
              <PainelSimuladorGps rota={rotaSimulada} recolhivel={navegando} />
            </ScrollView>
            {navegando ? null : (
              // A ação principal fica fixa embaixo da folha, sempre à vista, mesmo com o conteúdo rolando.
              <View style={estilos.mapaPainelRodapeFixo}>
                <BotaoPrincipal titulo="Iniciar navegação" desabilitado={!navegacao.podeIniciar} onPress={navegacao.iniciar} />
                {navegacao.motivoDeNaoPoderIniciar ? <Text style={estilos.textoApoio}>{navegacao.motivoDeNaoPoderIniciar}</Text> : null}
              </View>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Posição do veículo; só este componente renderiza a cada leitura de GPS. */
function MarcadorDoVeiculo() {
  const posicao = usePosicaoAtual();
  const {estado} = useLocalizacao();
  if (!posicao || estado.tipo === 'permissaoNegada' || estado.tipo === 'permissaoAproximada') {
    return null;
  }
  const atual = estado.tipo === 'ativa' && !estado.desatualizada;
  return (
    <Marker id="veiculo" lngLat={[posicao.longitude, posicao.latitude]}>
      <View
        accessible
        accessibilityLabel={atual ? 'Sua posição' : 'Última posição conhecida, desatualizada'}
        style={[estilos.mapaVeiculo, !atual && estilos.mapaVeiculoAntigo]}
      />
    </Marker>
  );
}
