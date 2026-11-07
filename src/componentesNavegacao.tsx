import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {cores, estilos} from './estilos';
import {formatarDistancia, formatarDuracao} from './mapa';
import {GuiaDeNavegacao} from './navegacao';
import {EstadoDaVoz} from './viewmodels/guiaDeNavegacao';
import {NavegacaoViewModel, useGuiaDeNavegacao} from './viewmodels/NavegacaoViewModel';

type Tom = 'normal' | 'erro' | 'aviso' | 'sucesso';

const COR_DO_TEXTO: Record<Tom, string> = {
  normal: '#FFFFFF',
  erro: cores.erro,
  aviso: cores.acentoTexto,
  sucesso: cores.sucesso,
};

const ESTILO_DO_FUNDO = {
  normal: estilos.navegacaoFaixaNormal,
  erro: estilos.navegacaoFaixaErro,
  aviso: estilos.navegacaoFaixaAviso,
  sucesso: estilos.navegacaoFaixaSucesso,
};

type FaixaProps = {
  tom: Tom;
  icone: React.ComponentProps<typeof MaterialDesignIcons>['name'];
  titulo: string;
  distancia?: string;
  apoio?: string;
  rotuloDeAcessibilidade: string;
};

function Faixa({tom, icone, titulo, distancia, apoio, rotuloDeAcessibilidade}: FaixaProps) {
  const cor = COR_DO_TEXTO[tom];
  return (
    <View accessible accessibilityRole="summary" accessibilityLabel={rotuloDeAcessibilidade} style={[estilos.navegacaoFaixa, ESTILO_DO_FUNDO[tom]]}>
      <MaterialDesignIcons name={icone} size={48} color={cor} />
      <View style={estilos.flex}>
        {distancia ? <Text style={[estilos.navegacaoDistancia, {color: cor}]}>{distancia}</Text> : null}
        <Text style={[estilos.navegacaoInstrucao, {color: cor}]}>{titulo}</Text>
        {apoio ? <Text style={[estilos.navegacaoApoio, {color: cor}]}>{apoio}</Text> : null}
      </View>
    </View>
  );
}

type FaixaDaManobraProps = {
  guia: GuiaDeNavegacao | null;
  chegou: boolean;
  semLocalizacao: boolean;
};

/** Instrução da manobra no topo da tela: ícone, distância e texto grandes, sempre com texto além da cor. */
export function FaixaDaManobra({guia, chegou, semLocalizacao}: FaixaDaManobraProps) {
  if (semLocalizacao) {
    return (
      <Faixa
        tom="aviso"
        icone="crosshairs-off"
        titulo="Sinal de GPS perdido"
        apoio="A orientação está pausada até o sinal voltar."
        rotuloDeAcessibilidade="Sinal de GPS perdido. A orientação está pausada até o sinal voltar."
      />
    );
  }
  if (!guia) {
    return (
      <Faixa
        tom="normal"
        icone="crosshairs-question"
        titulo="Calculando sua posição na rota..."
        rotuloDeAcessibilidade="Calculando sua posição na rota"
      />
    );
  }
  if (chegou && guia.manobra) {
    return <Faixa tom="sucesso" icone="flag-checkered" titulo={guia.manobra.texto} rotuloDeAcessibilidade={guia.manobra.texto} />;
  }
  if (guia.foraDaRota) {
    return (
      <Faixa
        tom="erro"
        icone="alert-circle-outline"
        titulo="Você saiu da rota"
        apoio="O recálculo ainda não está disponível. Volte ao trajeto azul."
        rotuloDeAcessibilidade="Você saiu da rota. O recálculo ainda não está disponível. Volte ao trajeto azul."
      />
    );
  }
  if (!guia.manobra) {
    return <Faixa tom="normal" icone="arrow-up" titulo="Siga a rota" rotuloDeAcessibilidade="Siga a rota" />;
  }
  const distancia = formatarDistancia(guia.distanciaAteManobraM);
  return (
    <Faixa
      tom="normal"
      icone={guia.manobra.icone}
      distancia={distancia}
      titulo={guia.manobra.texto}
      apoio={guia.seguinte ? `Depois: ${guia.seguinte.texto}` : undefined}
      rotuloDeAcessibilidade={`Em ${distancia}: ${guia.manobra.texto}`}
    />
  );
}

/** Problemas de voz identificados: sem voz em português, sem mecanismo de voz ou falha ao falar. */
export function AvisoDeVoz({voz, aoInstalarVoz}: {voz: EstadoDaVoz; aoInstalarVoz: () => void}) {
  let mensagem: string | null = null;
  if (voz.disponibilidade === 'semPortugues') {
    mensagem = 'Sem voz em português neste aparelho. A orientação segue só na tela.';
  } else if (voz.disponibilidade === 'indisponivel') {
    mensagem = 'Voz indisponível neste aparelho. A orientação segue só na tela.';
  } else if (voz.falhou && voz.ligada) {
    mensagem = 'Não foi possível falar a última instrução. Acompanhe pela tela.';
  }
  if (!mensagem) {
    return null;
  }
  return (
    <View style={estilos.localizacaoLinha} accessibilityRole="alert">
      <MaterialDesignIcons name="alert-circle-outline" size={24} color={cores.acentoTexto} />
      <Text style={[estilos.textoApoio, estilos.flex]}>{mensagem}</Text>
      {voz.disponibilidade === 'semPortugues' ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Instalar voz" style={estilos.localizacaoAcao} onPress={aoInstalarVoz}>
          <Text style={estilos.localizacaoAcaoTexto}>Instalar voz</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type PainelProps = {
  guia: GuiaDeNavegacao | null;
  voz: EstadoDaVoz;
  aoAlternarVoz: () => void;
  aoEncerrar: () => void;
  aoInstalarVoz: () => void;
};

export function PainelDeNavegacao({guia, voz, aoAlternarVoz, aoEncerrar, aoInstalarVoz}: PainelProps) {
  const vozDisponivel = voz.disponibilidade === 'disponivel' || voz.disponibilidade === 'verificando';
  return (
    <View>
      {guia ? (
        <>
          <Text style={estilos.mapaPainelTitulo}>
            Restam {formatarDistancia(guia.restanteM)}
            {guia.restanteM >= 50 ? ` • ${formatarDuracao(guia.restanteS)}` : ''}
          </Text>
          <Text style={estilos.textoApoio}>Estimativa pela distância das vias, sem trânsito.</Text>
        </>
      ) : null}
      <AvisoDeVoz voz={voz} aoInstalarVoz={aoInstalarVoz} />
      {__DEV__ && voz.ultimaFala ? <Text style={estilos.textoApoio}>Última fala: {voz.ultimaFala}</Text> : null}
      <View style={estilos.mapaDevBotoes}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{checked: voz.ligada, disabled: !vozDisponivel}}
          accessibilityLabel="Voz da navegação"
          disabled={!vozDisponivel}
          style={[estilos.mapaDevBotao, voz.ligada && vozDisponivel && estilos.mapaDevBotaoAtivo]}
          onPress={aoAlternarVoz}>
          <Text style={estilos.localizacaoAcaoTexto}>Voz: {voz.ligada ? 'ligada' : 'desligada'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Encerrar navegação" style={estilos.mapaDevBotao} onPress={aoEncerrar}>
          <Text style={estilos.localizacaoAcaoTexto}>Encerrar navegação</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Faixa ligada ao ViewModel: é ela (e não a tela do mapa) que renderiza a cada leitura. */
export function FaixaDaManobraConectada({navegacao}: {navegacao: NavegacaoViewModel}) {
  const guia = useGuiaDeNavegacao(navegacao);
  return <FaixaDaManobra guia={guia} chegou={navegacao.estado.tipo === 'chegou'} semLocalizacao={navegacao.semLocalizacao} />;
}

export function PainelDeNavegacaoConectado({navegacao}: {navegacao: NavegacaoViewModel}) {
  const guia = useGuiaDeNavegacao(navegacao);
  return (
    <PainelDeNavegacao
      guia={guia}
      voz={navegacao.voz}
      aoAlternarVoz={navegacao.alternarVoz}
      aoEncerrar={navegacao.encerrar}
      aoInstalarVoz={navegacao.instalarVozes}
    />
  );
}
