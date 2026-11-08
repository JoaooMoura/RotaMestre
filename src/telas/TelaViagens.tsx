import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, ScrollView, Text, View} from 'react-native';
import {Camera, CameraRef, GeoJSONSource, Layer, Map, Marker} from '@maplibre/maplibre-react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {Botao, BotaoContornado, BotaoPrincipal, Cabecalho} from '../componentes';
import {URL_ESTILO_MAPA} from '../configuracao';
import {cores, estilos} from '../estilos';
import {limitesDasCoordenadas} from '../mapa';
import {ArmazenamentoViagens} from '../servicos/armazenamentoViagens';
import {Coordenada} from '../tipos';
import {
  descreverLacunas,
  duracaoDaViagemMs,
  formatarDataHora,
  formatarDistanciaViagem,
  formatarDuracaoCurta,
  formatarHoraCompleta,
  ResumoDaViagem,
  trechosDoTrajeto,
} from '../viagens';
import {
  useReproducaoViewModel,
  useViagensViewModel,
  VELOCIDADES_DA_REPRODUCAO,
} from '../viewmodels/ViagensViewModel';

const PREENCHIMENTO = {top: 48, right: 48, bottom: 48, left: 48};
const LAYOUT_LINHA = {'line-cap': 'round', 'line-join': 'round'} as const;
const PAINT_GRAVADO = {'line-color': cores.contorno, 'line-width': 3, 'line-opacity': 0.6};
const PAINT_PERCORRIDO = {'line-color': cores.primaria, 'line-width': 5};

type Props = {
  usuarioId: string;
  onVoltar: () => void;
  armazenamento?: ArmazenamentoViagens;
};

/** Viagens gravadas neste aparelho (US09.02): lista e reprodução. Nada disso vai ao servidor. */
export function TelaViagens({usuarioId, onVoltar, armazenamento}: Props) {
  const {estado, recarregar, apagar} = useViagensViewModel(usuarioId, armazenamento);
  const [aberta, setAberta] = useState<ResumoDaViagem | null>(null);

  if (aberta) {
    return <TelaReproducao viagem={aberta} armazenamento={armazenamento} onVoltar={() => setAberta(null)} />;
  }

  function confirmarApagar(viagem: ResumoDaViagem) {
    Alert.alert('Apagar viagem', `Apagar a viagem de ${formatarDataHora(viagem.iniciadaEm)} deste aparelho? Isso não pode ser desfeito.`, [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: () => {
          apagar(viagem).then(ok => {
            if (!ok) {
              Alert.alert('Não foi possível apagar', 'Tente novamente.');
            }
          });
        },
      },
    ]);
  }

  return (
    <View style={estilos.tela}>
      <Cabecalho titulo="Minhas viagens" subtitulo="Gravadas só neste aparelho" onVoltar={onVoltar} />
      {estado.tipo === 'carregando' ? (
        <View style={estilos.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}
      {estado.tipo === 'erro' ? (
        <View style={estilos.centro}>
          <Text style={[estilos.subtitulo, estilos.textoCentral]}>{estado.mensagem}</Text>
          <View style={estilos.larguraTotalTopo18}>
            <Botao titulo="Tentar novamente" onPress={recarregar} />
          </View>
        </View>
      ) : null}
      {estado.tipo === 'pronto' ? (
        <ScrollView contentContainerStyle={estilos.frotaLista}>
          {estado.viagens.length === 0 ? (
            <View style={estilos.frotaVazia}>
              <MaterialDesignIcons name="map-marker-path" size={36} color={cores.textoApoio} />
              <Text style={estilos.linhaListaTitulo}>Nenhuma viagem gravada</Text>
              <Text style={[estilos.textoApoio, estilos.textoCentral]}>
                O trajeto é gravado neste aparelho enquanto a rota estiver em andamento, mesmo sem internet.
              </Text>
            </View>
          ) : null}
          {estado.viagens.map(viagem => {
            const resumo = `${formatarDataHora(viagem.iniciadaEm)} • ${formatarDuracaoCurta(duracaoDaViagemMs(viagem))} • ${formatarDistanciaViagem(viagem.distanciaM)}`;
            return (
              <View key={viagem.id} style={estilos.frotaCartao}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${viagem.rotaNome}. ${resumo}. ${descreverLacunas(viagem.lacunas)}. Abrir reprodução`}
                  style={estilos.viagemLinha}
                  onPress={() => setAberta(viagem)}>
                  <Text style={estilos.linhaListaTitulo}>{viagem.rotaNome}</Text>
                  <Text style={estilos.textoApoio}>{resumo}</Text>
                  <Text style={estilos.textoApoio}>
                    {viagem.pontos} pontos • {descreverLacunas(viagem.lacunas)}
                    {viagem.encerradaEm === null ? ' • não foi fechada normalmente' : ''}
                    {viagem.cheia ? ' • limite de pontos atingido' : ''}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Apagar a viagem de ${formatarDataHora(viagem.iniciadaEm)}`}
                  style={estilos.localizacaoAcao}
                  onPress={() => confirmarApagar(viagem)}>
                  <Text style={[estilos.localizacaoAcaoTexto, {color: cores.erro}]}>Apagar</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

type PropsReproducao = {viagem: ResumoDaViagem; onVoltar: () => void; armazenamento?: ArmazenamentoViagens};

export function TelaReproducao({viagem, onVoltar, armazenamento}: PropsReproducao) {
  const repro = useReproducaoViewModel(viagem, armazenamento);
  const cameraRef = useRef<CameraRef>(null);
  const [mapaFalhou, setMapaFalhou] = useState(false);
  const pontos = repro.estado.tipo === 'pronto' ? repro.estado.pontos : null;

  const gravado = useMemo(
    () => ({type: 'Feature' as const, properties: {}, geometry: {type: 'MultiLineString' as const, coordinates: pontos ? trechosDoTrajeto(pontos) : []}}),
    [pontos],
  );
  const percorrido = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: {type: 'MultiLineString' as const, coordinates: pontos ? trechosDoTrajeto(pontos.slice(0, repro.indice + 1)) : []},
    }),
    [pontos, repro.indice],
  );

  useEffect(() => {
    if (!pontos) {
      return;
    }
    const coordenadas = pontos.map(p => [p.lo, p.la] as Coordenada);
    const limites = limitesDasCoordenadas(coordenadas);
    if (limites && coordenadas.length > 1) {
      cameraRef.current?.fitBounds(limites, {padding: PREENCHIMENTO, duration: 0});
    } else if (coordenadas[0]) {
      cameraRef.current?.easeTo({center: coordenadas[0], zoom: 15, duration: 0});
    }
  }, [pontos]);

  const atual = pontos ? pontos[Math.min(repro.indice, pontos.length - 1)] : null;
  const posicaoTexto = pontos && atual ? `Ponto ${repro.indice + 1} de ${pontos.length} • ${formatarHoraCompleta(atual.t)}` : '';

  return (
    <View style={estilos.tela}>
      <Cabecalho
        titulo="Reprodução da viagem"
        subtitulo={`${viagem.rotaNome} • ${formatarDataHora(viagem.iniciadaEm)}`}
        onVoltar={onVoltar}
      />
      {repro.estado.tipo === 'carregando' ? (
        <View style={estilos.centro}>
          <ActivityIndicator size="large" />
        </View>
      ) : null}
      {repro.estado.tipo === 'erro' ? (
        <View style={estilos.centro}>
          <Text style={[estilos.subtitulo, estilos.textoCentral]}>{repro.estado.mensagem}</Text>
        </View>
      ) : null}
      {pontos && atual ? (
        <>
          <View style={estilos.viagemMapa}>
            <Map
              mapStyle={URL_ESTILO_MAPA}
              style={estilos.mapaTela}
              onDidFailLoadingMap={() => setMapaFalhou(true)}
              onDidFinishLoadingMap={() => setMapaFalhou(false)}>
              <Camera ref={cameraRef} initialViewState={{center: [atual.lo, atual.la], zoom: 13}} />
              <GeoJSONSource id="trajeto-gravado" data={gravado}>
                <Layer id="trajeto-gravado-linha" type="line" layout={LAYOUT_LINHA} paint={PAINT_GRAVADO} />
              </GeoJSONSource>
              <GeoJSONSource id="trajeto-percorrido" data={percorrido}>
                <Layer id="trajeto-percorrido-linha" type="line" layout={LAYOUT_LINHA} paint={PAINT_PERCORRIDO} />
              </GeoJSONSource>
              <Marker id="veiculo-gravado" lngLat={[atual.lo, atual.la]}>
                <View accessible accessibilityLabel="Posição na reprodução" style={estilos.mapaVeiculo} />
              </Marker>
            </Map>
          </View>
          <ScrollView contentContainerStyle={estilos.frotaLista}>
            {mapaFalhou ? (
              <Text style={estilos.textoApoio}>Não foi possível carregar o mapa de fundo. O trajeto gravado continua disponível.</Text>
            ) : null}
            <Text style={estilos.mapaPainelTitulo} accessibilityLabel={`Reprodução. ${posicaoTexto}`}>
              {posicaoTexto}
            </Text>
            {atual.g === 1 ? (
              <View style={[estilos.alertaLinha, estilos.alertaLinhaAviso]} accessibilityRole="alert">
                <MaterialDesignIcons name="signal-off" size={24} color={cores.acentoTexto} />
                <Text style={[estilos.alertaTextoApoio, estilos.flex, {color: cores.acentoTexto}]}>
                  Antes deste ponto houve uma lacuna sem localização. O trajeto entre os dois pontos não foi gravado.
                </Text>
              </View>
            ) : null}
            <Text style={estilos.textoApoio}>
              {formatarDuracaoCurta(duracaoDaViagemMs(viagem))} • {formatarDistanciaViagem(viagem.distanciaM)} • {descreverLacunas(viagem.lacunas)}
            </Text>
            <BotaoPrincipal titulo={repro.tocando ? 'Pausar' : 'Reproduzir'} onPress={repro.alternar} />
            <BotaoContornado titulo="Reiniciar" icone="restart" onPress={repro.reiniciar} />
            <View style={estilos.mapaDevBotoes}>
              {VELOCIDADES_DA_REPRODUCAO.map(v => (
                <Pressable
                  key={v}
                  accessibilityRole="button"
                  accessibilityState={{selected: repro.velocidade === v}}
                  accessibilityLabel={`Velocidade ${v} vezes`}
                  style={[estilos.mapaDevBotao, repro.velocidade === v && estilos.mapaDevBotaoAtivo]}
                  onPress={() => repro.definirVelocidade(v)}>
                  <Text style={estilos.localizacaoAcaoTexto}>{v}×</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}
