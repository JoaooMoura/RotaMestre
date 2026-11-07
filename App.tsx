import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Alert, Text, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import {MaterialDesignIcons} from '@react-native-vector-icons/material-design-icons';
import {Botao, BotaoContornado, BotaoPrincipal, LayoutFaixa} from './src/componentes';
import {cores, estilos} from './src/estilos';
import {primeiroNome} from './src/nomes';
import {TelaAutenticacao} from './src/telas/TelaAutenticacao';
import {TelaGestorSprint} from './src/telas/TelaGestorSprint';
import {TelaMotorista} from './src/telas/TelaMotorista';
import {Rota, Usuario} from './src/tipos';
import {guardaSessaoDe, ResumoDoPacote} from './src/offline';
import {armazenamentoOfflineSeguro} from './src/servicos/armazenamentoOffline';
import {useOperacaoViewModel} from './src/viewmodels/OperacaoViewModel';
import {LocalizacaoProvider} from './src/viewmodels/LocalizacaoViewModel';
import {servicoTelaNativo} from './src/servicos/servicoTela';
import {servicoVozNativo} from './src/servicos/servicoVoz';
import {dependenciasLocalizacaoPadrao} from './src/viewmodels/dependenciasLocalizacao';
import {OfflineProvider, useOfflineViewModel} from './src/viewmodels/OfflineViewModel';
import {NavegacaoProvider} from './src/viewmodels/NavegacaoViewModel';
import {SessaoProvider, useSessao} from './src/viewmodels/SessaoViewModel';

function Carregando({mensagem}: {mensagem: string}) {
  return (
    <View style={estilos.centro}>
      <ActivityIndicator size="large" />
      <Text style={estilos.subtitulo}>{mensagem}</Text>
    </View>
  );
}

function ConteudoApp() {
  const {usuario: usuarioDaSessao, usuarioGuardado, restaurando, sair: sairDaSessao} = useSessao();
  // Sem sessão válida (ex.: expirou), o motorista pode abrir a rota já baixada neste aparelho (PV05).
  const [usuarioLocal, setUsuarioLocal] = useState<Usuario | null>(null);
  const [resumoBaixado, setResumoBaixado] = useState<ResumoDoPacote | null>(null);
  const usuario = usuarioDaSessao ?? usuarioLocal;
  const semSessao = usuarioDaSessao === null && usuarioLocal !== null;
  // Sem login: coletar assinatura só se o aparelho guarda a sessão DESTE motorista (Manter conectado); senão, só leitura.
  const podeColetarSemEntrar = guardaSessaoDe(usuarioGuardado, resumoBaixado?.usuarioId);
  const somenteLeitura = semSessao && !guardaSessaoDe(usuarioGuardado, usuarioLocal?.id);
  const offlineBase = useOfflineViewModel(usuario, undefined, {sessaoAtiva: usuarioDaSessao !== null});
  const servicoOffline = useMemo(
    () => ({
      lerPacote: armazenamentoOfflineSeguro.lerPacote,
      listarPendencias: armazenamentoOfflineSeguro.listarPendencias,
      registrarPendencia: offlineBase.registrarPendencia,
      atualizarRotaDoPacote: async (usuarioId: string, rota: Rota) => {
        const pacote = await armazenamentoOfflineSeguro.lerPacote(usuarioId);
        // Só acompanha a mesma rota; o pacote de outra rota continua valendo para o que foi baixado.
        if (pacote && pacote.rota.id === rota.id) {
          await armazenamentoOfflineSeguro.salvarPacote({...pacote, rota});
        }
      },
    }),
    [offlineBase.registrarPendencia],
  );
  const {estado, recarregar, atualizarRota, tentarReconectar} = useOperacaoViewModel(usuario, undefined, servicoOffline, {
    somenteLocal: semSessao,
    somenteLeitura,
  });
  const semConexao = estado.tipo === 'pronto' && estado.offline !== undefined;
  const offline = useMemo(
    () => ({...offlineBase, semConexao, semSessao, somenteLeitura}),
    [offlineBase, semConexao, semSessao, somenteLeitura],
  );

  useEffect(() => {
    if (usuarioDaSessao) {
      setUsuarioLocal(null);
    }
  }, [usuarioDaSessao]);

  // Voltou ao servidor? Primeiro sai o que foi coletado sem rede (laço do OfflineViewModel); com tudo
  // enviado, a tela troca a rota baixada pela do servidor. Quando uma assinatura tem desfecho (aceita
  // ou rejeitada), a rota é recarregada para refletir o que o servidor decidiu.
  const pendentesParaEnviar = offline.pendencias.some(p => p.status === 'pendente');
  const desfechos = offline.desfechos;
  const desfechosVistos = useRef(0);
  useEffect(() => {
    if (desfechos === desfechosVistos.current) {
      return;
    }
    desfechosVistos.current = desfechos;
    if (estado.tipo === 'pronto' && estado.offline) {
      tentarReconectar();
    } else if (usuarioDaSessao) {
      recarregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desfechos]);
  useEffect(() => {
    if (!usuarioDaSessao || pendentesParaEnviar || !(estado.tipo === 'pronto' && estado.offline)) {
      return undefined;
    }
    const id = setInterval(() => {
      tentarReconectar();
    }, 15000);
    return () => clearInterval(id);
  }, [usuarioDaSessao, pendentesParaEnviar, estado, tentarReconectar]);

  useEffect(() => {
    if (usuarioDaSessao || restaurando) {
      return;
    }
    armazenamentoOfflineSeguro.lerResumo().then(setResumoBaixado, () => setResumoBaixado(null));
  }, [usuarioDaSessao, restaurando, usuarioLocal]);

  const abrirRotaBaixada = useCallback(async () => {
    if (!resumoBaixado) {
      return;
    }
    const pacote = await armazenamentoOfflineSeguro.lerPacote(resumoBaixado.usuarioId).catch(() => null);
    if (pacote) {
      setUsuarioLocal(pacote.usuario);
    }
  }, [resumoBaixado]);

  const sair = useCallback(() => {
    if (usuarioDaSessao) {
      sairDaSessao();
    } else {
      setUsuarioLocal(null);
    }
  }, [usuarioDaSessao, sairDaSessao]);

  const rotaEmAndamento =
    usuario?.papel === 'motorista' && estado.tipo === 'pronto' && estado.rota.status === 'Em andamento';

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
      <NavegacaoProvider voz={servicoVozNativo} tela={servicoTelaNativo}>
        <OfflineProvider valor={offline}>{conteudo()}</OfflineProvider>
      </NavegacaoProvider>
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
