import React, {useEffect, useReducer, useState} from 'react';
import {Keyboard, Pressable, Text, TextInput, TextInputProps, View} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {cores, estilos} from './estilos';
import {descreverIdade, idadeMs, Posicao} from './localizacao';
import {useCompartilhamento} from './viewmodels/CompartilhamentoViewModel';
import {EstadoDoRegistro} from './viewmodels/registroDeViagem';
import {useEstadoDoRegistro} from './viewmodels/ViagensViewModel';
import {useLocalizacao, usePosicaoAtual} from './viewmodels/LocalizacaoViewModel';
import {EstadoLocalizacao} from './viewmodels/rastreamentoLocalizacao';

type Tom = 'ok' | 'aviso' | 'erro' | 'neutro';
type TipoDeAcao = 'tentarNovamente' | 'configuracoesDoAplicativo' | 'configuracoesDeLocalizacao';

export type DescricaoDaLocalizacao = {
  icone: 'crosshairs-gps' | 'crosshairs-off' | 'crosshairs-question' | 'alert-circle-outline' | 'clock-alert-outline';
  titulo: string;
  apoio?: string;
  tom: Tom;
  acao?: {rotulo: string; tipo: TipoDeAcao};
};

/** Traduz o estado em ícone + texto (nunca só cor) e na ação possível. Nulo quando não há o que mostrar. */
export function descreverLocalizacao(
  estado: EstadoLocalizacao,
  posicao: Posicao | null,
  agora: number,
  somentePrimeiroPlano = false,
): DescricaoDaLocalizacao | null {
  switch (estado.tipo) {
    case 'inativa':
      return null;
    case 'solicitandoPermissao':
      return {icone: 'crosshairs-question', titulo: 'Pedindo permissão de localização...', tom: 'neutro'};
    case 'permissaoNegada':
      return {
        icone: 'crosshairs-off',
        titulo: 'Localização negada',
        apoio: 'Permita a localização para acompanhar sua rota.',
        tom: 'erro',
        acao: estado.permanente
          ? {rotulo: 'Abrir configurações', tipo: 'configuracoesDoAplicativo'}
          : {rotulo: 'Permitir', tipo: 'tentarNovamente'},
      };
    case 'permissaoAproximada':
      return {
        icone: 'crosshairs-off',
        titulo: 'Localização aproximada',
        apoio: 'Ative a localização precisa do aplicativo para acompanhar a rota.',
        tom: 'erro',
        acao: {rotulo: 'Abrir configurações', tipo: 'configuracoesDoAplicativo'},
      };
    case 'gpsIndisponivel':
      return {
        icone: 'alert-circle-outline',
        titulo: 'GPS indisponível',
        apoio: 'Ligue o GPS e confira o sinal. A última posição deixou de valer.',
        tom: 'erro',
        acao: {rotulo: 'Ligar GPS', tipo: 'configuracoesDeLocalizacao'},
      };
    case 'aguardandoPosicao':
      return estado.semSinal
        ? {
            icone: 'alert-circle-outline',
            titulo: 'Sem sinal de GPS',
            apoio: 'Há mais de 1 minuto sem posição. Ligue o GPS ou vá para um local aberto.',
            tom: 'aviso',
            acao: {rotulo: 'Ligar GPS', tipo: 'configuracoesDeLocalizacao'},
          }
        : {icone: 'crosshairs-question', titulo: 'Procurando sinal de GPS...', tom: 'neutro'};
    case 'ativa': {
      const aviso = somentePrimeiroPlano ? ' Funciona só com o app aberto.' : '';
      if (estado.desatualizada && posicao) {
        return {
          icone: 'clock-alert-outline',
          titulo: 'Posição desatualizada',
          apoio: `Última posição há ${descreverIdade(idadeMs(posicao, agora))}.${aviso}`,
          tom: 'aviso',
        };
      }
      const modo = estado.modo === 'parado' ? 'parado' : 'em movimento';
      const precisao = posicao?.precisaoM == null ? '' : `precisão ${Math.round(posicao.precisaoM)} m • `;
      return {
        icone: 'crosshairs-gps',
        titulo: estado.baixaPrecisao ? 'Localização ativa, precisão baixa' : 'Localização ativa',
        apoio: `${precisao}${modo}.${aviso}`,
        tom: estado.baixaPrecisao ? 'aviso' : 'ok',
      };
    }
  }
}

const COR_DO_TOM: Record<Tom, string> = {
  ok: cores.sucesso,
  aviso: cores.acentoTexto,
  erro: cores.erro,
  neutro: cores.textoApoio,
};

export function IndicadorLocalizacao({descricao, aoAcionar}: {descricao: DescricaoDaLocalizacao; aoAcionar: (tipo: TipoDeAcao) => void}) {
  const cor = COR_DO_TOM[descricao.tom];
  return (
    <View style={estilos.localizacaoLinha}>
      <MaterialDesignIcons name={descricao.icone} size={24} color={cor} />
      <View style={estilos.flex}>
        {/* Só o título é região "ao vivo": muda quando a situação muda, não a cada leitura de GPS. */}
        <Text accessibilityLiveRegion="polite" style={[estilos.localizacaoTitulo, {color: cor}]}>
          {descricao.titulo}
        </Text>
        {descricao.apoio ? <Text style={estilos.textoApoio}>{descricao.apoio}</Text> : null}
      </View>
      {descricao.acao ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={descricao.acao.rotulo}
          style={estilos.localizacaoAcao}
          onPress={() => aoAcionar(descricao.acao!.tipo)}>
          <Text style={estilos.localizacaoAcaoTexto}>{descricao.acao.rotulo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Indicador ligado ao ViewModel; reavalia a idade a cada segundo só enquanto a posição está desatualizada. */
export function IndicadorLocalizacaoConectado() {
  const localizacao = useLocalizacao();
  const estadoDoRegistro = useEstadoDoRegistro();
  const posicao = usePosicaoAtual();
  const [, atualizar] = useReducer((valor: number) => valor + 1, 0);
  const desatualizada = localizacao.estado.tipo === 'ativa' && localizacao.estado.desatualizada;

  useEffect(() => {
    if (!desatualizada) {
      return undefined;
    }
    const temporizador = setInterval(atualizar, 1000);
    return () => clearInterval(temporizador);
  }, [desatualizada]);

  const descricao = descreverLocalizacao(localizacao.estado, posicao, Date.now(), localizacao.somentePrimeiroPlano);
  if (!descricao) {
    return null;
  }
  return (
    <>
      <IndicadorLocalizacao
        descricao={descricao}
        aoAcionar={tipo => {
          if (tipo === 'tentarNovamente') {
            localizacao.tentarNovamente();
          } else {
            localizacao.abrirConfiguracoes(tipo === 'configuracoesDoAplicativo' ? 'aplicativo' : 'localizacao');
          }
        }}
      />
      <AvisoDeCompartilhamentoConectado />
      <AvisoDeRegistro estado={estadoDoRegistro} />
    </>
  );
}

/** Avisa o motorista, em texto, que a posição está sendo compartilhada com o gestor (ou que não está chegando). */
export function AvisoDeCompartilhamento({estado}: {estado: 'inativo' | 'ativo' | 'falhou'}) {
  if (estado === 'inativo') {
    return null;
  }
  const falhou = estado === 'falhou';
  const texto = falhou
    ? 'Sem conexão: o gestor não está recebendo sua localização agora.'
    : 'Sua localização é compartilhada com o gestor enquanto a rota estiver em andamento.';
  return (
    <View style={estilos.localizacaoLinha} accessible accessibilityLabel={texto}>
      <MaterialDesignIcons
        name={falhou ? 'cloud-off-outline' : 'share-variant-outline'}
        size={24}
        color={falhou ? cores.acentoTexto : cores.textoApoio}
      />
      <Text style={[estilos.textoApoio, estilos.flex, falhou && {color: cores.acentoTexto}]}>{texto}</Text>
    </View>
  );
}

/** Diz, em texto, que o trajeto está sendo gravado no aparelho (ou que não está). */
export function AvisoDeRegistro({estado}: {estado: EstadoDoRegistro}) {
  if (estado === 'inativo') {
    return null;
  }
  const problema = estado !== 'gravando';
  const texto =
    estado === 'gravando'
      ? 'Seu trajeto está sendo gravado neste aparelho.'
      : estado === 'cheio'
        ? 'Limite de pontos da viagem atingido: o trajeto não está mais sendo gravado.'
        : 'Não foi possível gravar o trajeto neste aparelho. Confira o espaço livre.';
  return (
    <View style={estilos.localizacaoLinha} accessible accessibilityLabel={texto}>
      <MaterialDesignIcons
        name={problema ? 'alert-circle-outline' : 'map-marker-path'}
        size={24}
        color={problema ? cores.acentoTexto : cores.textoApoio}
      />
      <Text style={[estilos.textoApoio, estilos.flex, problema && {color: cores.acentoTexto}]}>{texto}</Text>
    </View>
  );
}

/**
 * Versão enxuta dos avisos de localização, compartilhamento e gravação para a navegação: uma linha com ícones.
 * Os detalhes ficam atrás de "Detalhes" (fechado por padrão), mas qualquer problema (permissão, GPS, sem conexão,
 * falha ao gravar) abre o bloco completo, porque ali estão as ações para resolver.
 */
export function ResumoDeAvisosConectado() {
  const localizacao = useLocalizacao();
  const compartilhamento = useCompartilhamento();
  const registro = useEstadoDoRegistro();
  const posicao = usePosicaoAtual();
  const [aberto, setAberto] = useState(false);
  const descricao = descreverLocalizacao(localizacao.estado, posicao, Date.now(), localizacao.somentePrimeiroPlano);
  const problema =
    (descricao !== null && (descricao.tom === 'erro' || descricao.tom === 'aviso')) ||
    compartilhamento === 'falhou' ||
    (registro !== 'inativo' && registro !== 'gravando');

  if (!descricao && compartilhamento === 'inativo' && registro === 'inativo') {
    return null;
  }
  if (problema || aberto) {
    return (
      <View>
        <IndicadorLocalizacaoConectado />
        {problema ? null : (
          <Pressable accessibilityRole="button" accessibilityLabel="Esconder detalhes" style={estilos.localizacaoAcao} onPress={() => setAberto(false)}>
            <Text style={estilos.localizacaoAcaoTexto}>Esconder detalhes</Text>
          </Pressable>
        )}
      </View>
    );
  }
  const partes = [
    descricao?.titulo,
    compartilhamento === 'ativo' ? 'compartilhando com o gestor' : null,
    registro === 'gravando' ? 'gravando o trajeto' : null,
  ].filter(Boolean);
  return (
    <View style={estilos.localizacaoLinha}>
      <View style={[estilos.localizacaoLinha, estilos.flex]} accessible accessibilityLabel={partes.join(', ')}>
        <MaterialDesignIcons name={descricao?.icone ?? 'crosshairs-question'} size={20} color={COR_DO_TOM[descricao?.tom ?? 'neutro']} />
        {compartilhamento === 'ativo' ? <MaterialDesignIcons name="share-variant-outline" size={20} color={cores.textoApoio} /> : null}
        {registro === 'gravando' ? <MaterialDesignIcons name="map-marker-path" size={20} color={cores.textoApoio} /> : null}
        <Text style={[estilos.localizacaoTitulo, estilos.flex, {color: cores.textoApoio}]} numberOfLines={1}>
          {descricao?.titulo ?? ''}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Detalhes" accessibilityState={{expanded: false}} style={estilos.localizacaoAcao} onPress={() => setAberto(true)}>
        <Text style={estilos.localizacaoAcaoTexto}>Detalhes</Text>
      </Pressable>
    </View>
  );
}

export function AvisoDeCompartilhamentoConectado() {
  return <AvisoDeCompartilhamento estado={useCompartilhamento()} />;
}

/** Aviso de que a digitação está bloqueada porque o veículo está em movimento. */
export function AvisoDeRestricao({restrito}: {restrito: boolean}) {
  if (!restrito) {
    return null;
  }
  return (
    <View style={[estilos.localizacaoLinha, estilos.restricaoAviso]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <MaterialDesignIcons name="car-brake-alert" size={24} color={cores.acentoTexto} />
      <Text style={[estilos.textoApoio, estilos.flex]}>
        Digitação bloqueada: veículo em movimento. Pare em local seguro para preencher.
      </Text>
    </View>
  );
}

/**
 * Campo de texto que não aceita digitação em movimento. Os botões e a orientação seguem acessíveis;
 * o que já estava digitado é mantido. Ao entrar em movimento, o teclado é fechado.
 */
export function CampoDeTexto({restrito, style, ...resto}: TextInputProps & {restrito: boolean}) {
  useEffect(() => {
    if (restrito) {
      Keyboard.dismiss();
    }
  }, [restrito]);
  return (
    <TextInput
      {...resto}
      editable={!restrito && resto.editable !== false}
      style={[style, restrito && estilos.campoRestrito]}
      accessibilityState={{disabled: restrito}}
      accessibilityHint={restrito ? 'Indisponível com o veículo em movimento' : resto.accessibilityHint}
    />
  );
}
