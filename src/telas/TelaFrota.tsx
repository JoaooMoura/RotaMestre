import React, {useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, Text, View} from 'react-native';
import {Camera, CameraRef, Map, Marker} from '@maplibre/maplibre-react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {Botao, Cabecalho} from '../componentes';
import {URL_ESTILO_MAPA} from '../configuracao';
import {cores, estilos} from '../estilos';
import {descreverAndamento, descreverIdadeDaPosicao, descreverPosicaoDoMotorista, situacaoDaPosicao} from '../frota';
import {limitesDasCoordenadas} from '../mapa';
import {Coordenada, MotoristaNaFrota} from '../tipos';
import {DependenciasDaFrota, useFrotaViewModel} from '../viewmodels/FrotaViewModel';

const PREENCHIMENTO = {top: 56, right: 56, bottom: 56, left: 56};
const CENTRO_PADRAO: Coordenada = [-45.88, -23.18];
const ATUALIZACAO_DA_IDADE_MS = 5000;

type Props = {
  onVoltar: () => void;
  dependencias?: DependenciasDaFrota;
};

/** Frota no mapa (US03.04): só para o gestor. Posição antiga nunca é mostrada como atual. */
export function TelaFrota({onVoltar, dependencias}: Props) {
  const {estado, atualizar} = useFrotaViewModel(dependencias);
  const [agora, setAgora] = useState(() => Date.now());
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const cameraRef = useRef<CameraRef>(null);
  const enquadrou = useRef(false);

  // Faz os dados "envelhecerem" na tela entre uma consulta e outra (e quando a consulta falha).
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), ATUALIZACAO_DA_IDADE_MS);
    return () => clearInterval(id);
  }, []);

  const motoristas = useMemo(() => (estado.tipo === 'pronto' ? estado.frota.motoristas : []), [estado]);
  const idadeExtraMs = estado.tipo === 'pronto' ? Math.max(0, agora - estado.atualizadoEm) : 0;
  const posicoes = useMemo(
    () =>
      motoristas.flatMap(m => (m.posicao ? [[m.posicao.longitude, m.posicao.latitude] as Coordenada] : [])),
    [motoristas],
  );

  // Enquadra todos os motoristas uma única vez (depois o gestor mexe no mapa como quiser).
  useEffect(() => {
    if (enquadrou.current || posicoes.length === 0) {
      return;
    }
    enquadrou.current = true;
    const limites = limitesDasCoordenadas(posicoes);
    if (posicoes.length === 1 || !limites) {
      cameraRef.current?.easeTo({center: posicoes[0], zoom: 14, duration: 600});
    } else {
      cameraRef.current?.fitBounds(limites, {padding: PREENCHIMENTO, duration: 600});
    }
  }, [posicoes]);

  function selecionar(m: MotoristaNaFrota) {
    setSelecionadoId(m.motoristaId);
    if (m.posicao) {
      cameraRef.current?.easeTo({center: [m.posicao.longitude, m.posicao.latitude], zoom: 15, duration: 600});
    }
  }

  const resumo =
    estado.tipo === 'pronto'
      ? `${motoristas.length} ${motoristas.length === 1 ? 'motorista em rota' : 'motoristas em rota'}`
      : undefined;

  return (
    <View style={estilos.tela}>
      <Cabecalho titulo="Frota no mapa" subtitulo={resumo} onVoltar={onVoltar} />
      {estado.tipo === 'carregando' ? (
        <View style={estilos.centro}>
          <ActivityIndicator size="large" />
          <Text style={estilos.subtitulo}>Buscando a frota...</Text>
        </View>
      ) : null}
      {estado.tipo === 'erro' ? (
        <View style={estilos.centro}>
          <Text style={[estilos.titulo, estilos.textoCentral]}>Não foi possível carregar a frota</Text>
          <Text style={[estilos.subtitulo, estilos.textoCentral]}>{estado.mensagem}</Text>
          <View style={estilos.larguraTotalTopo18}>
            <Botao titulo="Tentar novamente" onPress={atualizar} />
          </View>
        </View>
      ) : null}
      {estado.tipo === 'pronto' ? (
        <>
          {estado.falhaRecente ? (
            <View style={[estilos.alertaLinha, estilos.alertaLinhaAviso, estilos.frotaAviso]} accessibilityRole="alert">
              <MaterialDesignIcons name="cloud-off-outline" size={24} color={cores.acentoTexto} />
              <Text style={[estilos.alertaTextoApoio, estilos.flex, {color: cores.acentoTexto}]}>
                Sem atualização do servidor. Os dados abaixo são de {descreverIdadeDaPosicao(idadeExtraMs)} e podem estar
                desatualizados.
              </Text>
            </View>
          ) : null}
          <View style={estilos.frotaMapa}>
            <Map mapStyle={URL_ESTILO_MAPA} style={estilos.mapaTela}>
              <Camera ref={cameraRef} initialViewState={{center: CENTRO_PADRAO, zoom: 10}} />
              {motoristas.map(m =>
                m.posicao ? (
                  <Marker
                    key={m.motoristaId}
                    id={`motorista-${m.motoristaId}`}
                    lngLat={[m.posicao.longitude, m.posicao.latitude]}
                    onPress={() => selecionar(m)}>
                    <View
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`${m.nome}. ${descreverPosicaoDoMotorista(m, idadeExtraMs).texto}`}
                      style={[
                        estilos.mapaMarcador,
                        situacaoDaPosicao(m, idadeExtraMs) === 'desatualizada' && estilos.frotaMarcadorAntigo,
                        m.motoristaId === selecionadoId && estilos.mapaMarcadorSelecionado,
                      ]}>
                      {situacaoDaPosicao(m, idadeExtraMs) === 'desatualizada' ? (
                        <MaterialDesignIcons name="clock-alert-outline" size={24} color="#FFFFFF" />
                      ) : (
                        <Text style={estilos.mapaMarcadorTexto}>{m.nome.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                  </Marker>
                ) : null,
              )}
            </Map>
          </View>
          <ScrollView style={estilos.flex} contentContainerStyle={estilos.frotaLista}>
            {motoristas.length === 0 ? (
              <View style={estilos.frotaVazia}>
                <MaterialDesignIcons name="truck-outline" size={36} color={cores.textoApoio} />
                <Text style={estilos.linhaListaTitulo}>Nenhum motorista com rota em andamento</Text>
                <Text style={estilos.textoApoio}>Quando um motorista iniciar a rota, ele aparece aqui.</Text>
              </View>
            ) : null}
            {motoristas.map(m => {
              const posicao = descreverPosicaoDoMotorista(m, idadeExtraMs);
              return (
                <Pressable
                  key={m.motoristaId}
                  accessibilityRole="button"
                  accessibilityLabel={`${m.nome}, rota ${m.rota.nome}, ${descreverAndamento(m)}. ${posicao.texto}`}
                  accessibilityHint={m.posicao ? 'Centraliza o mapa neste motorista' : undefined}
                  style={[estilos.frotaCartao, m.motoristaId === selecionadoId && estilos.frotaCartaoSelecionado]}
                  onPress={() => selecionar(m)}>
                  <Text style={estilos.linhaListaTitulo}>{m.nome}</Text>
                  <Text style={estilos.textoApoio}>
                    {m.rota.nome} • {m.rota.status}
                  </Text>
                  <Text style={estilos.textoApoio}>{descreverAndamento(m)}</Text>
                  <View style={estilos.frotaSituacao}>
                    <MaterialDesignIcons
                      name={posicao.icone}
                      size={20}
                      color={posicao.aviso ? cores.acentoTexto : cores.sucesso}
                    />
                    <Text style={[estilos.textoApoio, estilos.flex, {color: posicao.aviso ? cores.acentoTexto : cores.sucesso}]}>
                      {posicao.texto}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}
