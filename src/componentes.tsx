import React, {useContext, useState} from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import MaskInput, {Mask} from 'react-native-mask-input';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';
import {useEscalaAoPressionar} from './animacoes';
import {cores, estilos} from './estilos';
import {iniciais} from './nomes';
import {Parada, Rota, StatusParada, StatusRota, Usuario} from './tipos';

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
  perigo?: boolean;
};

export function BotaoContornado({titulo, onPress, icone, perigo}: BotaoContornadoProps) {
  const cor = perigo ? cores.erro : cores.primaria;
  const {estiloEscala, aoPressionar, aoSoltar} = useEscalaAoPressionar();
  return (
    <Animated.View style={estiloEscala}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={titulo}
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
  comVoltar?: boolean;
};

export function LayoutFaixa({faixa, children, comVoltar}: LayoutFaixaProps) {
  return (
    <ScrollView
      style={estilos.loginRolagem}
      contentContainerStyle={estilos.loginRolagemConteudo}
      keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="light-content" />
      <View style={[estilos.loginFaixa, comVoltar && estilos.loginFaixaComVoltar]}>{faixa}</View>
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

export function NavegacaoInferior({itens, ativa, onPress}: NavegacaoInferiorProps) {
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

type CampoProps = TextInputProps & {
  rotulo: string;
  icone: NomeIcone;
  mascara?: Mask;
  acao?: React.ReactNode;
  estiloTexto?: TextInputProps['style'];
};

export function Campo({rotulo, icone, mascara, acao, estiloTexto, onFocus, onBlur, ...props}: CampoProps) {
  const [focado, setFocado] = useState(false);
  const propsEntrada: TextInputProps = {
    ...props,
    style: [estilos.loginCampoTexto, !acao && estilos.loginCampoTextoSemAcao, estiloTexto],
    placeholderTextColor: cores.contorno,
    accessibilityLabel: rotulo,
    onFocus: evento => {
      setFocado(true);
      onFocus?.(evento);
    },
    onBlur: evento => {
      setFocado(false);
      onBlur?.(evento);
    },
  };
  return (
    <>
      <Text style={estilos.loginRotulo}>{rotulo}</Text>
      <View style={[estilos.loginCampo, focado && estilos.loginCampoFocado]}>
        <MaterialDesignIcons
          name={icone}
          size={24}
          color={focado ? cores.primaria : cores.textoApoio}
        />
        {mascara ? (
          <MaskInput {...propsEntrada} mask={mascara} />
        ) : (
          <TextInput {...propsEntrada} />
        )}
        {acao}
      </View>
    </>
  );
}

type ProgressoEtapasProps = {
  etapa: number;
  total: number;
};

export function ProgressoEtapas({etapa, total}: ProgressoEtapasProps) {
  const etapas = Array.from({length: total}, (_, indice) => indice + 1);
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Etapa ${etapa} de ${total}`}
      accessibilityValue={{min: 1, max: total, now: etapa}}>
      <View style={estilos.loginProgresso}>
        {etapas.map(numero => (
          <View
            key={numero}
            style={[
              estilos.loginProgressoSegmento,
              numero <= etapa && estilos.loginProgressoSegmentoAtivo,
            ]}
          />
        ))}
      </View>
      <Text style={estilos.loginProgressoTexto}>
        Etapa {etapa} de {total}
      </Text>
    </View>
  );
}

type FaixaTituloProps = {
  titulo: string;
  apoio?: string;
  onVoltar?: () => void;
  children?: React.ReactNode;
};

export function FaixaTitulo({titulo, apoio, onVoltar, children}: FaixaTituloProps) {
  return (
    <>
      {onVoltar ? (
        <Pressable
          onPress={onVoltar}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({pressed}) => [estilos.loginVoltar, pressed && estilos.loginVoltarPressionado]}>
          <MaterialDesignIcons name="arrow-left" size={24} color="#FFFFFF" />
        </Pressable>
      ) : null}
      <Text style={estilos.loginMarca} accessibilityRole="header">
        {titulo}
      </Text>
      {apoio ? <Text style={estilos.loginSlogan}>{apoio}</Text> : null}
      {children}
    </>
  );
}

type CartaoRotaProps = {
  rota: Rota;
  onPress: () => void;
  responsavel?: string;
};

export function CartaoRota({rota, onPress, responsavel}: CartaoRotaProps) {
  const concluidas = rota.paradas.filter(item => item.status === 'Concluída').length;
  const percentual =
    rota.status === 'Concluída'
      ? 100
      : rota.paradas.length
        ? Math.round((concluidas / rota.paradas.length) * 100)
        : 0;
  const estiloLargura = {width: `${percentual}%` as const};
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Rota ${rota.nome}`}
      onPress={onPress}
      style={({pressed}) => [estilos.cartao, pressed && estilos.cartaoPressionado]}>
      <View style={estilos.linhaEntre}>
        <Text style={estilos.cartaoTitulo}>{rota.nome}</Text>
        <Badge status={rota.status} />
      </View>
      <View style={estilos.linhaIcone}>
        <MaterialDesignIcons name="clock-outline" size={16} color={cores.textoApoio} />
        <Text style={estilos.textoApoio}>
          {rota.id} · início às {rota.horario}
        </Text>
      </View>
      {responsavel ? (
        <View style={estilos.linhaIcone}>
          <MaterialDesignIcons name="account-outline" size={16} color={cores.textoApoio} />
          <Text style={estilos.textoApoio}>{responsavel}</Text>
        </View>
      ) : null}
      <View style={estilos.progressoLinha}>
        <Text style={estilos.progressoPercentual}>{percentual}%</Text>
        <Text style={estilos.textoApoio}>
          {concluidas} de {rota.paradas.length} paradas concluídas
        </Text>
      </View>
      <View style={estilos.progressoFundo}>
        <View style={[estilos.progresso, estiloLargura]} />
      </View>
      <View style={estilos.metricasLinha}>
        <View style={estilos.metricaItem}>
          <Text style={estilos.metricaValor}>{rota.paradas.length}</Text>
          <Text style={estilos.metricaRotulo}>Paradas</Text>
        </View>
        <View style={estilos.metricaDivisor} />
        <View style={estilos.metricaItem}>
          <Text style={estilos.metricaValor}>{concluidas}</Text>
          <Text style={estilos.metricaRotulo}>Concluídas</Text>
        </View>
        <View style={estilos.metricaDivisor} />
        <View style={estilos.metricaItem}>
          <Text style={estilos.metricaValor}>{rota.paradas.length - concluidas}</Text>
          <Text style={estilos.metricaRotulo}>Restantes</Text>
        </View>
      </View>
    </Pressable>
  );
}

const NOME_PAPEL: Record<Usuario['papel'], string> = {
  motorista: 'Motorista',
  gestor: 'Gestor',
};

type PerfilUsuarioProps = {
  usuario: Usuario;
  onSair: () => void;
};

export function PerfilUsuario({usuario, onSair}: PerfilUsuarioProps) {
  return (
    <LayoutFaixa
      faixa={
        <View style={estilos.perfilCabecalho}>
          <View
            style={estilos.perfilAvatar}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Text style={estilos.perfilIniciais}>{iniciais(usuario.nome)}</Text>
          </View>
          <View style={estilos.flex}>
            <Text style={estilos.perfilNome} accessibilityRole="header">
              {usuario.nome}
            </Text>
            <Text style={estilos.loginSlogan}>{NOME_PAPEL[usuario.papel]}</Text>
          </View>
        </View>
      }>
      <Text style={estilos.secaoRotulo}>Conta</Text>
      <View style={estilos.perfilLinha}>
        <MaterialDesignIcons name="email-outline" size={24} color={cores.textoApoio} />
        <View style={estilos.flex}>
          <Text style={estilos.metricaRotulo}>E-mail</Text>
          <Text style={estilos.perfilValor}>{usuario.email}</Text>
        </View>
      </View>
      <View style={estilos.perfilSeparador} />
      <View style={estilos.perfilLinha}>
        <MaterialDesignIcons name="badge-account-outline" size={24} color={cores.textoApoio} />
        <View style={estilos.flex}>
          <Text style={estilos.metricaRotulo}>Papel</Text>
          <Text style={estilos.perfilValor}>{NOME_PAPEL[usuario.papel]}</Text>
        </View>
      </View>

      <BotaoContornado titulo="Sair da conta" icone="logout" perigo onPress={onSair} />
      <View style={estilos.perfilRodape}>
        <MaterialDesignIcons name="information-outline" size={16} color={cores.textoApoio} />
        <Text style={estilos.perfilRodapeTexto}>Versão de demonstração · Sprint 1</Text>
      </View>
    </LayoutFaixa>
  );
}

export function AvatarPequeno({nome}: {nome: string}) {
  return (
    <View
      style={estilos.avatarPequeno}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Text style={estilos.avatarPequenoTexto}>{iniciais(nome)}</Text>
    </View>
  );
}

type LinhaParadaProps = {
  parada: Parada;
  indice: number;
  mostrarStatus?: boolean;
};

export function LinhaParada({parada, indice, mostrarStatus}: LinhaParadaProps) {
  return (
    <View style={estilos.linhaLista}>
      <View style={estilos.paradaNumero}>
        <Text style={estilos.paradaNumeroTexto}>{indice + 1}</Text>
      </View>
      <View style={estilos.flex}>
        <Text style={estilos.linhaListaTitulo}>{parada.destinatario}</Text>
        <Text style={estilos.textoApoio}>
          {parada.tipo} · {parada.janela}
        </Text>
        <Text style={estilos.textoApoio}>{parada.endereco}</Text>
      </View>
      {mostrarStatus ? <Badge status={parada.status} /> : null}
    </View>
  );
}
