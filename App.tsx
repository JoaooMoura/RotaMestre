import React from 'react';
import {ActivityIndicator, Alert, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {Botao} from './src/componentes';
import {estilos} from './src/estilos';
import {TelaAutenticacao} from './src/telas/TelaAutenticacao';
import {TelaGestorSprint} from './src/telas/TelaGestorSprint';
import {TelaMotorista} from './src/telas/TelaMotorista';
import {Rota} from './src/tipos';
import {useOperacaoViewModel} from './src/viewmodels/OperacaoViewModel';
import {SessaoProvider, useSessao} from './src/viewmodels/SessaoViewModel';

function ConteudoApp() {
  const {usuario, sair} = useSessao();
  const {estado, recarregar, atualizarRota} = useOperacaoViewModel(usuario);

  // O ViewModel decide o resultado; a View só decide como mostrar a falha.
  async function salvar(rota: Rota) {
    const resultado = await atualizarRota(rota);
    if (!resultado.ok && resultado.mensagem) {
      Alert.alert('Falha ao salvar', resultado.mensagem);
    }
    return resultado.ok;
  }

  if (!usuario) {
    return <TelaAutenticacao />;
  }

  switch (estado.tipo) {
    case 'carregando':
      return (
        <View style={estilos.centro}>
          <ActivityIndicator size="large" />
          <Text style={estilos.subtitulo}>Carregando dados da operação...</Text>
        </View>
      );

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

    case 'semRota':
      return (
        <View style={estilos.centro}>
          <Text style={[estilos.titulo, estilos.textoCentral]}>Nenhuma rota atribuída</Text>
          <Text style={[estilos.subtitulo, estilos.textoCentral]}>
            Quando o gestor atribuir uma rota, ela aparecerá aqui.
          </Text>
          <View style={estilos.larguraTotalTopo18}>
            <Botao titulo="Atualizar" onPress={recarregar} />
            <Botao titulo="Sair" secundario onPress={sair} />
          </View>
        </View>
      );

    case 'pronto':
      return usuario.papel === 'gestor' ? (
        <TelaGestorSprint
          rota={estado.rota}
          motoristas={estado.motoristas}
          onAtualizarRota={salvar}
          onSair={sair}
        />
      ) : (
        <TelaMotorista rota={estado.rota} onAtualizarRota={salvar} onSair={sair} />
      );
  }
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
