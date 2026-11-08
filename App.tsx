import React from 'react';
import {ActivityIndicator, Alert, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {Botao, BotaoContornado, BotaoPrincipal, LayoutFaixa} from './src/componentes';
import {cores, estilos} from './src/estilos';
import {primeiroNome} from './src/nomes';
import {TelaAutenticacao} from './src/telas/TelaAutenticacao';
import {TelaGestorSprint} from './src/telas/TelaGestorSprint';
import {TelaMotorista} from './src/telas/TelaMotorista';
import {LocalizacaoProvider} from './src/viewmodels/LocalizacaoViewModel';
import {servicoTelaNativo} from './src/servicos/servicoTela';
import {servicoAlertaNativo} from './src/servicos/servicoAlerta';
import {servicoVozNativo} from './src/servicos/servicoVoz';
import {dependenciasLocalizacaoPadrao} from './src/viewmodels/dependenciasLocalizacao';
import {Rota} from './src/tipos';
import {useAppViewModel} from './src/viewmodels/AppViewModel';
import {OfflineProvider} from './src/viewmodels/OfflineViewModel';
import {CompartilhamentoProvider} from './src/viewmodels/CompartilhamentoViewModel';
import {RegistroDeViagemProvider} from './src/viewmodels/ViagensViewModel';
import {AtualizacaoProvider, dependenciasDaAtualizacaoPadrao} from './src/viewmodels/AtualizacaoViewModel';
import {agendadorNativo} from './src/servicos/agendadorDeAtualizacao';
import {NavegacaoProvider} from './src/viewmodels/NavegacaoViewModel';
import {SessaoProvider, useSessao} from './src/viewmodels/SessaoViewModel';

const dependenciasDeAtualizacao = {...dependenciasDaAtualizacaoPadrao, agendador: agendadorNativo};

function Carregando({mensagem}: {mensagem: string}) {
  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" />
      <Text style={estilos.subtitulo}>{mensagem}</Text>
    </View>
  );
}

function ConteudoApp() {
  const sessao = useSessao();
  const {
    restaurando,
    usuario,
    estado,
    offline,
    resumoBaixado,
    podeColetarSemEntrar,
    rotaEmAndamento,
    compartilharPosicao,
    viagemParaGravar,
    atualizarEmSegundoPlano,
    recarregar,
    atualizarRota,
    abrirRotaBaixada,
    sair,
  } = useAppViewModel(sessao);

  async function salvar(rota: Rota) {
    const resultado = await atualizarRota(rota);
    if (!resultado.ok && resultado.mensagem) {
      Alert.alert('Falha ao salvar', resultado.mensagem);
    }
    return resultado.ok;
  }

  const conteudo = () => {
  if (restaurando) {
    return <Carregando mensagem="Abrindo sua sessão..." />;
  }

  if (!usuario) {
    return <TelaAutenticacao rotaBaixada={resumoBaixado} podeColetarSemEntrar={podeColetarSemEntrar} aoAbrirRotaBaixada={abrirRotaBaixada} />;
  }

  switch (estado.tipo) {
    case 'carregando':
      return <Carregando mensagem="Carregando dados da operação..." />;

    case 'erro':
      return (
        <View style={estilos.centro}>
          <Text style={[estilos.titulo, estilos.textoCentral]}>Servidor indisponível</Text>
          <Text style={[estilos.subtitulo, estilos.textoCentral]}>{estado.mensagem}</Text>
          <View style={estilos.larguraTotalTopo18}>
            <Botao titulo="Tentar novamente" onPress={recarregar} />
            <Botao titulo="Sair" secundario onPress={sair} />
          </View>
        </View>
      );

    case 'semRota': {
      const motorista = usuario.papel === 'motorista';
      return (
        <LayoutFaixa
          faixa={
            <>
              <Text style={estilos.loginMarca} accessibilityRole="header">
                Olá, {primeiroNome(usuario.nome)}
              </Text>
              <Text style={estilos.loginSlogan}>
                {motorista ? 'Área do motorista' : 'Área do gestor'}
              </Text>
            </>
          }>
          <View style={estilos.iconeCirculo}>
            <MaterialDesignIcons
              name="map-marker-off-outline"
              size={36}
              color={cores.primariaPressionada}
            />
          </View>
          <Text style={estilos.loginTitulo}>
            {motorista ? 'Nenhuma rota atribuída' : 'Nenhuma rota cadastrada'}
          </Text>
          <Text style={estilos.loginApoio}>
            {motorista
              ? 'Aguarde o gestor atribuir uma rota a você. Quando isso acontecer, toque em Atualizar para vê-la aqui.'
              : 'Ainda não há rotas cadastradas. Quando houver, toque em Atualizar para vê-las aqui.'}
          </Text>
          <BotaoPrincipal titulo="Atualizar" onPress={recarregar} />
          <BotaoContornado titulo="Sair" icone="logout" perigo onPress={sair} />
        </LayoutFaixa>
      );
    }

    case 'pronto':
      return usuario.papel === 'gestor' ? (
        <TelaGestorSprint
          usuario={usuario}
          rota={estado.rota}
          motoristas={estado.motoristas}
          onAtualizarRota={salvar}
          onSair={sair}
        />
      ) : (
        <TelaMotorista
          usuario={usuario}
          rota={estado.rota}
          onAtualizarRota={salvar}
          onSair={sair}
        />
      );
  }
  };

  return (
    <LocalizacaoProvider ativo={rotaEmAndamento} dependencias={dependenciasLocalizacaoPadrao}>
      <CompartilhamentoProvider ativo={compartilharPosicao}>
        <RegistroDeViagemProvider viagem={viagemParaGravar}>
          <NavegacaoProvider voz={servicoVozNativo} tela={servicoTelaNativo} alerta={servicoAlertaNativo}>
            <OfflineProvider valor={offline}>
              <AtualizacaoProvider ativo={atualizarEmSegundoPlano} dependencias={dependenciasDeAtualizacao}>
                {conteudo()}
              </AtualizacaoProvider>
            </OfflineProvider>
          </NavegacaoProvider>
        </RegistroDeViagemProvider>
      </CompartilhamentoProvider>
    </LocalizacaoProvider>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={estilos.areaSegura} edges={['top']}>
        <SessaoProvider>
          <ConteudoApp />
        </SessaoProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;
