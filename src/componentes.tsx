import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {cores, estilos} from './estilos';
import {Parada, StatusParada, StatusRota} from './tipos';

type BotaoProps = {
  titulo: string;
  onPress: () => void;
  secundario?: boolean;
  perigo?: boolean;
  desabilitado?: boolean;
};

export function Botao({
  titulo,
  onPress,
  secundario,
  perigo,
  desabilitado,
}: BotaoProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={desabilitado}
      onPress={onPress}
      style={[
        secundario ? estilos.botaoSecundario : estilos.botao,
        perigo && estilos.botaoPerigo,
        desabilitado && estilos.botaoDesabilitado,
      ]}>
      <Text
        style={[
          secundario ? estilos.botaoSecundarioTexto : estilos.botaoTexto,
          perigo && estilos.botaoPerigoTexto,
        ]}>
        {titulo}
      </Text>
    </Pressable>
  );
}

type CabecalhoProps = {
  titulo: string;
  subtitulo?: string;
  onVoltar?: () => void;
};

export function Cabecalho({titulo, subtitulo, onVoltar}: CabecalhoProps) {
  return (
    <View style={estilos.cabecalho}>
      <View style={estilos.cabecalhoLinha}>
        <View style={estilos.flex}>
          <Text style={estilos.cabecalhoTitulo}>{titulo}</Text>
          {subtitulo ? (
            <Text style={estilos.cabecalhoSubtitulo}>{subtitulo}</Text>
          ) : null}
        </View>
        {onVoltar ? (
          <Pressable onPress={onVoltar}>
            <Text style={estilos.voltar}>Voltar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Badge({status}: {status: StatusRota | StatusParada}) {
  const mapa = {
    Programada: [cores.primariaClara, cores.primaria],
    'Em andamento': [cores.alertaFundo, cores.alerta],
    Pausada: [cores.roxoFundo, cores.roxo],
    Concluída: [cores.sucessoFundo, cores.sucesso],
    Pendente: ['#F1F5F9', '#475569'],
    'Não realizada': [cores.perigoFundo, cores.perigo],
  } as const;
  const [backgroundColor, color] = mapa[status];

  return (
    <View style={[estilos.badge, {backgroundColor}]}>
      <Text style={[estilos.badgeTexto, {color}]}>{status}</Text>
    </View>
  );
}

type CardParadaProps = {
  parada: Parada;
  indice: number;
  onPress?: () => void;
};

export function CardParada({parada, indice, onPress}: CardParadaProps) {
  const conteudo = (
    <View style={[estilos.card, estilos.linha]}>
      <View style={estilos.paradaNumero}>
        <Text style={estilos.paradaNumeroTexto}>{indice + 1}</Text>
      </View>
      <View style={estilos.flex}>
        <View style={estilos.linhaEntre}>
          <Text style={estilos.valor}>{parada.tipo}</Text>
          <Badge status={parada.status} />
        </View>
        <Text style={[estilos.valor, estilos.margemTopo8]}>
          {parada.destinatario}
        </Text>
        <Text style={estilos.texto}>{parada.endereco}</Text>
        <Text style={[estilos.texto, estilos.margemTopo4]}>{parada.janela}</Text>
      </View>
    </View>
  );

  return onPress ? <Pressable onPress={onPress}>{conteudo}</Pressable> : conteudo;
}

type AbasProps = {
  itens: string[];
  ativa: string;
  onPress: (item: string) => void;
};

export function Abas({itens, ativa, onPress}: AbasProps) {
  return (
    <View style={estilos.abas}>
      {itens.map(item => (
        <Pressable key={item} style={estilos.aba} onPress={() => onPress(item)}>
          <Text
            style={[
              estilos.abaTexto,
              ativa === item && estilos.abaTextoAtiva,
            ]}>
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
