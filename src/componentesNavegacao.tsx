import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, Text, View} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {alertaDeAproximacao, InfoDeVelocidade} from './alertas';
import {cores, estilos} from './estilos';
import {formatarDistancia, formatarDuracao} from './mapa';
import {criarPlano, GuiaDeNavegacao} from './navegacao';
import {calcularPrevisoes, formatarHorario, PrevisaoDeParada} from './previsao';
import {Trajeto} from './tipos';
import {EstadoDaVoz} from './viewmodels/guiaDeNavegacao';
import {EstadoDoRecalculo, NavegacaoViewModel, useGuiaDeNavegacao} from './viewmodels/NavegacaoViewModel';

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
  /** Anuncia mudanças de texto no leitor de tela (estado do recálculo). */
  viva?: boolean;
};

function Faixa({tom, icone, titulo, distancia, apoio, rotuloDeAcessibilidade, viva}: FaixaProps) {
  const cor = COR_DO_TEXTO[tom];
  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLiveRegion={viva ? 'polite' : undefined}
      accessibilityLabel={rotuloDeAcessibilidade}
      style={[estilos.navegacaoFaixa, ESTILO_DO_FUNDO[tom]]}>
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
  /** Estado do recálculo (US05.04); omitido, vale como ocioso. */
  recalculo?: EstadoDoRecalculo;
};

/** Texto de apoio da faixa "Você saiu da rota", conforme o recálculo. */
export function apoioDoDesvio(recalculo: EstadoDoRecalculo = {tipo: 'ocioso'}): string {
  switch (recalculo.tipo) {
    case 'calculando':
      return 'Recalculando o trajeto a partir da sua posição...';
    case 'falhou':
      return recalculo.semConexao ? recalculo.mensagem : `${recalculo.mensagem} Nova tentativa em instantes. Volte ao trajeto azul.`;
    case 'indisponivel':
      return 'Entre na conta para recalcular. Por enquanto, volte ao trajeto azul.';
    default:
      return 'Volte ao trajeto azul ou aguarde o novo trajeto.';
  }
}

/** Instrução da manobra no topo da tela: ícone, distância e texto grandes, sempre com texto além da cor. */
export function FaixaDaManobra({guia, chegou, semLocalizacao, recalculo}: FaixaDaManobraProps) {
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
    const apoio = apoioDoDesvio(recalculo);
    return (
      <Faixa
        tom="erro"
        icone={recalculo?.tipo === 'calculando' ? 'map-marker-path' : 'alert-circle-outline'}
        titulo="Você saiu da rota"
        apoio={apoio}
        viva
        rotuloDeAcessibilidade={`Você saiu da rota. ${apoio}`}
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

/**
 * Velocidade e limite validado. Excesso: faixa vermelha com ícone e texto. Sem limite validado: avisa que
 * ele está indisponível (nenhum valor estimado é mostrado como limite).
 */
export function FaixaDeVelocidade({velocidade}: {velocidade: InfoDeVelocidade}) {
  const {kmh, limiteKmh, excesso} = velocidade;
  const atual = kmh === null ? null : Math.round(kmh);
  if (limiteKmh === null) {
    return (
      <View
        accessible
        accessibilityLabel="Limite de velocidade indisponível neste trecho"
        style={estilos.alertaLinha}>
        <MaterialDesignIcons name="speedometer-slow" size={24} color={cores.textoApoio} />
        <Text style={[estilos.alertaTextoApoio, estilos.flex]}>Limite de velocidade indisponível neste trecho</Text>
      </View>
    );
  }
  if (excesso) {
    const texto = `Acima do limite: ${atual ?? '--'} km/h (limite ${limiteKmh})`;
    return (
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        // O rótulo não leva a velocidade (muda a cada segundo): com ela, o leitor de tela repetiria o aviso a cada leitura.
        accessibilityLabel={`Atenção, velocidade acima do limite de ${limiteKmh} quilômetros por hora.`}
        style={[estilos.alertaLinha, estilos.alertaLinhaErro]}>
        <MaterialDesignIcons name="speedometer" size={24} color={cores.erro} />
        <Text style={[estilos.alertaTexto, estilos.flex, {color: cores.erro}]}>{texto}</Text>
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={`Limite de velocidade ${limiteKmh} quilômetros por hora${atual === null ? '' : `, você está a ${atual}`}`}
      style={estilos.alertaLinha}>
      <MaterialDesignIcons name="speedometer-medium" size={24} color={cores.textoApoio} />
      <Text style={[estilos.alertaTexto, estilos.flex]}>
        {atual === null ? '' : `${atual} km/h • `}Limite {limiteKmh} km/h
      </Text>
    </View>
  );
}

/** Aviso visual de aproximação da parada (300 m e menos). */
export function FaixaDeAproximacao({guia}: {guia: GuiaDeNavegacao | null}) {
  const alerta = alertaDeAproximacao(guia);
  if (!alerta) {
    return null;
  }
  const texto = `${alerta.titulo} • ${formatarDistancia(alerta.distanciaM)}`;
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={texto}
      style={[estilos.alertaLinha, estilos.alertaLinhaAviso]}>
      <MaterialDesignIcons name="map-marker-radius" size={24} color={cores.acentoTexto} />
      <Text style={[estilos.alertaTexto, estilos.flex, {color: cores.acentoTexto}]}>{texto}</Text>
    </View>
  );
}

type AlertasProps = {guia: GuiaDeNavegacao | null; semLocalizacao: boolean; recalculo?: EstadoDoRecalculo};

/** Alertas de navegação (US05.05) abaixo da instrução da manobra. */
export function AlertasDaNavegacao({guia, semLocalizacao, recalculo}: AlertasProps) {
  if (semLocalizacao || !guia || guia.chegou) {
    return null;
  }
  return (
    <>
      {recalculo?.tipo === 'recalculado' ? (
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLabel="Trajeto recalculado a partir da sua posição"
          style={[estilos.alertaLinha, estilos.alertaLinhaSucesso]}>
          <MaterialDesignIcons name="check-circle-outline" size={24} color={cores.sucesso} />
          <Text style={[estilos.alertaTexto, estilos.flex, {color: cores.sucesso}]}>Trajeto recalculado a partir da sua posição</Text>
        </View>
      ) : null}
      <FaixaDeAproximacao guia={guia} />
      {guia.foraDaRota ? null : <FaixaDeVelocidade velocidade={guia.velocidade} />}
    </>
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
  return (
    <FaixaDaManobra
      guia={guia}
      chegou={navegacao.estado.tipo === 'chegou'}
      semLocalizacao={navegacao.semLocalizacao}
      recalculo={navegacao.recalculo}
    />
  );
}

export function AlertasDaNavegacaoConectados({navegacao}: {navegacao: NavegacaoViewModel}) {
  const guia = useGuiaDeNavegacao(navegacao);
  return <AlertasDaNavegacao guia={guia} semLocalizacao={navegacao.semLocalizacao} recalculo={navegacao.recalculo} />;
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

type PrevisaoProps = {
  previsoes: PrevisaoDeParada[];
  /** `true` quando a navegação ainda não começou: a previsão supõe sair agora. */
  suposicaoDePartida: boolean;
};

/** Horário previsto de chegada a cada parada restante, sempre identificado como estimativa. */
export function PrevisaoDeChegada({previsoes, suposicaoDePartida}: PrevisaoProps) {
  const [aberta, setAberta] = useState(false);
  if (previsoes.length === 0) {
    return <Text style={estilos.textoApoio}>Todas as paradas foram concluídas.</Text>;
  }
  const proxima = previsoes[0];
  const final = previsoes[previsoes.length - 1];
  const texto = (p: PrevisaoDeParada) => (p.chegadaEm === null ? 'sem estimativa' : formatarHorario(p.chegadaEm));
  const resumo = `Próxima parada ${proxima.numero}: ${texto(proxima)}${previsoes.length > 1 ? ` • Final: ${texto(final)}` : ''}`;
  return (
    <View>
      <Text style={estilos.mapaPainelTitulo} accessibilityLabel={`Previsão de chegada. ${resumo}`}>
        {resumo}
      </Text>
      <Text style={estilos.textoApoio}>
        Previsão estimada{suposicaoDePartida ? ', saindo agora' : ''}. Não considera o trânsito em tempo real.
      </Text>
      {previsoes.length > 1 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded: aberta}}
          accessibilityLabel={aberta ? 'Esconder previsões por parada' : 'Ver previsões por parada'}
          style={estilos.localizacaoAcao}
          onPress={() => setAberta(valor => !valor)}>
          <Text style={estilos.localizacaoAcaoTexto}>{aberta ? 'Esconder previsões' : 'Ver previsões por parada'}</Text>
        </Pressable>
      ) : null}
      {aberta ? (
        <ScrollView style={estilos.previsaoLista} nestedScrollEnabled>
          {previsoes.map(p => (
            <View
              key={p.paradaId}
              accessible
              style={estilos.previsaoLinha}
              accessibilityLabel={`Parada ${p.numero}, ${p.destinatario}, previsão ${texto(p)}${
                p.chegadaEm === null ? '' : `, a ${formatarDistancia(p.distanciaM)}`
              }`}>
              <Text style={estilos.previsaoHorario}>{texto(p)}</Text>
              <Text style={[estilos.textoApoio, estilos.flex]} numberOfLines={1}>
                {p.numero}. {p.destinatario}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const ATUALIZACAO_DA_PREVISAO_MS = 30_000;
const DEGRAU_DO_PROGRESSO_M = 25;

/**
 * Previsão ligada ao trajeto e ao progresso da navegação. Só este componente reage ao guia; o
 * cálculo é refeito a cada 25 m andados, a cada 30 s ou quando o trajeto muda (recálculo).
 */
export function PrevisaoDeChegadaConectada({trajeto, navegacao}: {trajeto: Trajeto; navegacao: NavegacaoViewModel}) {
  const guia = useGuiaDeNavegacao(navegacao);
  const [relogio, setRelogio] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setRelogio(Date.now()), ATUALIZACAO_DA_PREVISAO_MS);
    return () => clearInterval(id);
  }, []);
  const plano = useMemo(() => criarPlano(trajeto), [trajeto]);
  const degrau = Math.floor((guia?.progressoM ?? 0) / DEGRAU_DO_PROGRESSO_M);
  const previsoes = useMemo(
    () => calcularPrevisoes(plano, trajeto.paradas, degrau * DEGRAU_DO_PROGRESSO_M, Date.now()),
    // `relogio` só dispara a reavaliação periódica; o instante usado é o de agora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plano, trajeto.paradas, degrau, relogio],
  );
  return <PrevisaoDeChegada previsoes={previsoes} suposicaoDePartida={guia === null} />;
}
