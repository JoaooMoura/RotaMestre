import React, {useEffect, useReducer} from 'react';
import {Pressable, Text, View} from 'react-native';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {cores, estilos} from './estilos';
import {descreverIdade, idadeMs, Posicao} from './localizacao';
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
  );
}
