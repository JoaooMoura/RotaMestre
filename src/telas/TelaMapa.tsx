import React, {useMemo, useState} from 'react';
import {ActivityIndicator, Text, View} from 'react-native';
import {Camera, GeoJSONSource, Layer, Map, Marker} from '@maplibre/maplibre-react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {Botao, Cabecalho} from '../componentes';
import {URL_ESTILO_MAPA} from '../configuracao';
import {cores, estilos} from '../estilos';
import {formatarDistancia, formatarDuracao, limitesDasCoordenadas} from '../mapa';
import {Coordenada, Rota, Trajeto} from '../tipos';
import {useMapaViewModel} from '../viewmodels/MapaViewModel';

const PREENCHIMENTO_DO_TRAJETO = {top: 64, right: 48, bottom: 160, left: 48};
const POSICAO_ATRIBUICAO = {top: 8, right: 8};
const POSICAO_LOGO = {top: 8, left: 8};
const LAYOUT_LINHA = {'line-cap': 'round', 'line-join': 'round'} as const;
const PAINT_LINHA = {'line-color': cores.primaria, 'line-width': 5};

type Props = {
  rota: Rota;
  onVoltar: () => void;
};

export function TelaMapa({rota, onVoltar}: Props) {
  const {estado, recarregar} = useMapaViewModel(rota.id);

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

function MapaDoTrajeto({trajeto}: {trajeto: Trajeto}) {
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [mapaFalhou, setMapaFalhou] = useState(false);
  // Objetos estáveis: sem isso, cada toque numa parada reenviaria a geometria ao mapa nativo.
  const dadosDoTrajeto = useMemo(
    () => ({type: 'Feature' as const, properties: {}, geometry: trajeto.geometria}),
    [trajeto.geometria],
  );
  const visaoInicial = useMemo(() => {
    const limites = limitesDasCoordenadas(trajeto.geometria.coordinates);
    return limites
      ? {bounds: limites, padding: PREENCHIMENTO_DO_TRAJETO}
      : {center: [trajeto.paradas[0].longitude, trajeto.paradas[0].latitude] as Coordenada, zoom: 12};
  }, [trajeto.geometria, trajeto.paradas]);
  const posicoes = useMemo(
    () => trajeto.paradas.map(parada => [parada.longitude, parada.latitude] as Coordenada),
    [trajeto.paradas],
  );
  const selecionada = trajeto.paradas.find(parada => parada.id === selecionadaId);

  return (
    <View style={estilos.mapaTela}>
      <Map
        style={estilos.mapaTela}
        mapStyle={URL_ESTILO_MAPA}
        attributionPosition={POSICAO_ATRIBUICAO}
        logoPosition={POSICAO_LOGO}
        onDidFailLoadingMap={() => setMapaFalhou(true)}
        onDidFinishLoadingMap={() => setMapaFalhou(false)}>
        <Camera initialViewState={visaoInicial} />
        <GeoJSONSource id="trajeto" data={dadosDoTrajeto}>
          <Layer id="trajeto-linha" type="line" layout={LAYOUT_LINHA} paint={PAINT_LINHA} />
        </GeoJSONSource>
        {trajeto.paradas.map((parada, indice) => (
          <Marker
            key={parada.id}
            id={`parada-${parada.id}`}
            lngLat={posicoes[indice]}
            onPress={() => setSelecionadaId(parada.id)}>
            <View
              accessible
              accessibilityRole="button"
              accessibilityLabel={`Parada ${indice + 1}: ${parada.destinatario}, ${parada.status}`}
              style={[
                estilos.mapaMarcador,
                parada.status === 'Concluída' && estilos.mapaMarcadorConcluida,
                parada.id === selecionadaId && estilos.mapaMarcadorSelecionado,
              ]}>
              <View style={estilos.mapaMarcadorConteudo}>
                <Text style={estilos.mapaMarcadorTexto}>{indice + 1}</Text>
                {parada.status === 'Concluída' ? (
                  <MaterialDesignIcons name="check-bold" size={16} color="#FFFFFF" />
                ) : null}
              </View>
            </View>
          </Marker>
        ))}
      </Map>

      {mapaFalhou ? (
        <View style={estilos.mapaAviso} accessibilityLiveRegion="polite">
          <Text style={estilos.mapaAvisoTexto}>
            Não foi possível carregar o mapa de fundo. O trajeto e as paradas continuam disponíveis.
          </Text>
        </View>
      ) : null}

      <View style={estilos.mapaPainel}>
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
      </View>
    </View>
  );
}
