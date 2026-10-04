import React, {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {Botao} from './src/componentes';
import {estilos} from './src/estilos';
import {
  buscarMotoristas,
  buscarRotaAtual,
  salvarRota,
} from './src/servicos/api';
import {TelaAutenticacao} from './src/telas/TelaAutenticacao';
import {TelaGestorSprint} from './src/telas/TelaGestorSprint';
import {TelaMotorista} from './src/telas/TelaMotorista';
import {Motorista, Perfil, Rota} from './src/tipos';

function App() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [rota, setRota] = useState<Rota | null>(null);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [emailAtual, setEmailAtual] = useState('');

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro('');

    try {
      setMotoristas(await buscarMotoristas());
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : 'Não foi possível carregar os dados.',
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Identifica o motorista pelo e-mail do login (sem verificação de senha até o B2).
  async function entrar(perfilEscolhido: Perfil, email: string) {
    try {
      // Recarrega a lista para incluir motoristas cadastrados depois da abertura do app.
      const lista = await buscarMotoristas();
      setMotoristas(lista);

      let motoristaId: string | undefined;
      if (perfilEscolhido === 'motorista') {
        const motorista = lista.find(
          item => item.email.toLowerCase() === email.toLowerCase(),
        );
        if (!motorista) {
          Alert.alert('Motorista não encontrado', 'Nenhum motorista cadastrado com este e-mail.');
          return;
        }
        motoristaId = motorista.id;
      }

      setRota(await buscarRotaAtual(motoristaId));
      setEmailAtual(email);
      setPerfil(perfilEscolhido);
    } catch (falha) {
      Alert.alert(
        'Falha ao entrar',
        falha instanceof Error ? falha.message : 'Não foi possível carregar a rota.',
      );
    }
  }

  function sair() {
    setPerfil(null);
    setRota(null);
  }

  async function atualizarRota(novaRota: Rota) {
    try {
      const rotaSalva = await salvarRota(novaRota);
      setRota(rotaSalva);
      return true;
    } catch (falha) {
      Alert.alert(
        'Falha ao salvar',
        falha instanceof Error
          ? falha.message
          : 'Não foi possível salvar a rota.',
      );
      return false;
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={estilos.areaSegura} edges={['top']}>
        {carregando ? (
          <View style={estilos.centro}>
            <ActivityIndicator size="large" />
            <Text style={estilos.subtitulo}>Carregando dados da operação...</Text>
          </View>
        ) : erro ? (
          <View style={estilos.centro}>
            <Text style={[estilos.titulo, estilos.textoCentral]}>
              Servidor indisponível
            </Text>
            <Text style={[estilos.subtitulo, estilos.textoCentral]}>{erro}</Text>
            <View style={estilos.larguraTotalTopo18}>
              <Botao titulo="Tentar novamente" onPress={carregarDados} />
            </View>
          </View>
        ) : perfil === null ? (
          <TelaAutenticacao onEntrar={entrar} />
        ) : !rota ? (
          <View style={estilos.centro}>
            <Text style={[estilos.titulo, estilos.textoCentral]}>Nenhuma rota atribuída</Text>
            <Text style={[estilos.subtitulo, estilos.textoCentral]}>
              Quando o gestor atribuir uma rota, ela aparecerá aqui.
            </Text>
            <View style={estilos.larguraTotalTopo18}>
              <Botao titulo="Atualizar" onPress={() => entrar(perfil, emailAtual)} />
              <Botao titulo="Sair" secundario onPress={sair} />
            </View>
          </View>
        ) : perfil === 'gestor' ? (
          <TelaGestorSprint
            rota={rota}
            motoristas={motoristas}
            onAtualizarRota={atualizarRota}
            onSair={sair}
          />
        ) : (
          <TelaMotorista
            rota={rota}
            onAtualizarRota={atualizarRota}
            onSair={sair}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;
