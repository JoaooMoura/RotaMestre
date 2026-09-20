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

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro('');

    try {
      const [rotaCarregada, motoristasCarregados] = await Promise.all([
        buscarRotaAtual(),
        buscarMotoristas(),
      ]);
      setRota(rotaCarregada);
      setMotoristas(motoristasCarregados);
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
        ) : erro || !rota ? (
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
          <TelaAutenticacao onEntrar={setPerfil} />
        ) : perfil === 'gestor' ? (
          <TelaGestorSprint
            rota={rota}
            motoristas={motoristas}
            onAtualizarRota={atualizarRota}
            onSair={() => setPerfil(null)}
          />
        ) : (
          <TelaMotorista
            rota={rota}
            onAtualizarRota={atualizarRota}
            onSair={() => setPerfil(null)}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default App;
