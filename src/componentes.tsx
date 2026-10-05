import React, {useContext} from 'react';
import {Animated, Pressable, ScrollView, StatusBar, Text, View} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
import {useEscalaAoPressionar} from './animacoes';
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
  const {estiloEscala, aoPressionar, aoSoltar} = useEscalaAoPressionar();
  return (
    <Animated.View style={estiloEscala}>
      <Pressable
        accessibilityRole="button"
        disabled={desabilitado}
        onPress={onPress}
        onPressIn={aoPressionar}
        onPressOut={aoSoltar}
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
    </Animated.View>
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

// Linguagem visual Material Design 3 (a mesma da autenticação): faixa azul,
// folha branca, botões em pílula com estado pressionado e barra de navegação.

export type NomeIcone = React.ComponentProps<typeof MaterialDesignIcons>['name'];

type BotaoMd3Props = {
  titulo: string;
  onPress: () => void;
  desabilitado?: boolean;
};

export function BotaoPrincipal({titulo, onPress, desabilitado}: BotaoMd3Props) {
  const {estiloEscala, aoPressionar, aoSoltar} = useEscalaAoPressionar();
  return (
    <Animated.View style={estiloEscala}>
      <Pressable
        accessibilityRole="button"
        disabled={desabilitado}
        onPress={onPress}
        onPressIn={aoPressionar}
        onPressOut={aoSoltar}
        style={({pressed}) => [
          estilos.loginBotao,
          pressed && estilos.loginBotaoPressionado,
          desabilitado && estilos.botaoDesabilitado,
        ]}>
        <Text style={estilos.loginBotaoTexto}>{titulo}</Text>
      </Pressable>
    </Animated.View>
  );
}

type BotaoContornadoProps = BotaoMd3Props & {
  icone?: NomeIcone;
  // Ação destrutiva sem alarde: borda neutra, texto e ícone em vermelho.
  perigo?: boolean;
};

export function BotaoContornado({titulo, onPress, icone, perigo}: BotaoContornadoProps) {
  const cor = perigo ? cores.erro : cores.primaria;
  const {estiloEscala, aoPressionar, aoSoltar} = useEscalaAoPressionar();
  return (
    <Animated.View style={estiloEscala}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={aoPressionar}
        onPressOut={aoSoltar}
        style={({pressed}) => [
          estilos.loginBotaoContornado,
          perigo && estilos.botaoContornadoPerigo,
          pressed &&
            (perigo
              ? estilos.botaoContornadoPerigoPressionado
              : estilos.loginBotaoContornadoPressionado),
        ]}>
        <View style={estilos.botaoConteudo}>
          {icone ? <MaterialDesignIcons name={icone} size={20} color={cor} /> : null}
          <Text
            style={[
              estilos.loginBotaoContornadoTexto,
              perigo && estilos.botaoContornadoPerigoTexto,
            ]}>
            {titulo}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function BotaoTexto({titulo, onPress}: BotaoMd3Props) {
  return (
    <Pressable style={estilos.loginLink} onPress={onPress} accessibilityRole="button">
      <Text style={estilos.loginLinkTexto}>{titulo}</Text>
    </Pressable>
  );
}

type LayoutFaixaProps = {
  faixa: React.ReactNode;
  children: React.ReactNode;
};

// Faixa azul no topo e folha branca rolável por baixo, como no login.
export function LayoutFaixa({faixa, children}: LayoutFaixaProps) {
  return (
    <ScrollView
      style={estilos.loginRolagem}
      contentContainerStyle={estilos.loginRolagemConteudo}
      keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" />
      <View style={estilos.loginFaixa}>{faixa}</View>
      <View style={estilos.loginFolha}>{children}</View>
    </ScrollView>
  );
}

export type ItemNavegacao = {
  nome: string;
  icone: NomeIcone;
  iconeAtivo: NomeIcone;
};

type NavegacaoInferiorProps = {
  itens: ItemNavegacao[];
  ativa: string;
  onPress: (nome: string) => void;
};

// Navigation Bar do MD3: pílula atrás do ícone preenchido na aba ativa, rótulo sempre visível.
export function NavegacaoInferior({itens, ativa, onPress}: NavegacaoInferiorProps) {
  // Lido do contexto (e não do hook) para funcionar também fora do SafeAreaProvider, como nos testes.
  const margemInferior = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const espacoSistema = {paddingBottom: 16 + margemInferior};
  return (
    <View style={[estilos.navegacao, espacoSistema]} accessibilityRole="tablist">
      {itens.map(item => {
        const selecionada = item.nome === ativa;
        return (
          <Pressable
            key={item.nome}
            style={({pressed}) => [
              estilos.navegacaoItem,
              pressed && estilos.navegacaoItemPressionado,
            ]}
            onPress={() => onPress(item.nome)}
            accessibilityRole="tab"
            accessibilityState={{selected: selecionada}}
            accessibilityLabel={item.nome}>
            <View
              style={[
                estilos.navegacaoIndicador,
                selecionada && estilos.navegacaoIndicadorAtivo,
              ]}>
              <MaterialDesignIcons
                name={selecionada ? item.iconeAtivo : item.icone}
                size={24}
                color={selecionada ? cores.primariaPressionada : cores.textoApoio}
              />
            </View>
            <Text
              style={[
                estilos.navegacaoRotulo,
                selecionada && estilos.navegacaoRotuloAtivo,
              ]}
              numberOfLines={1}>
              {item.nome}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
