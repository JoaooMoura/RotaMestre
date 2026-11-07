import React from 'react';
import {Pressable, Text, View} from 'react-native';
import {estilos} from '../estilos';
import {PontoGeografico} from '../geo';
import {CenarioSimulado} from '../servicos/servicoLocalizacaoSimulado';
import {useDiagnosticoLocalizacao, useLocalizacao} from '../viewmodels/LocalizacaoViewModel';
import {intervaloMedioMs} from '../viewmodels/rastreamentoLocalizacao';

const CENARIOS: {cenario: CenarioSimulado; rotulo: string}[] = [
  {cenario: 'movimento', rotulo: 'Andar'},
  {cenario: 'parado', rotulo: 'Parar'},
  {cenario: 'desvio', rotulo: 'Desviar'},
  {cenario: 'semSinal', rotulo: 'Sem sinal'},
];

const formatarIntervalo = (ms: number | null) => (ms === null ? '-' : `${ms} ms`);

/** Só em desenvolvimento: GPS simulado e números do ensaio, para testar com o aparelho parado. */
export function PainelSimuladorGps({rota}: {rota: PontoGeografico[]}) {
  const localizacao = useLocalizacao();

  // Em produção nada é montado nem assina o diagnóstico (que muda a cada leitura).
  if (!__DEV__ || !localizacao.simuladorDisponivel) {
    return null;
  }
  return <PainelAberto rota={rota} />;
}

function PainelAberto({rota}: {rota: PontoGeografico[]}) {
  const localizacao = useLocalizacao();
  const diagnostico = useDiagnosticoLocalizacao();

  function alternarSimulador() {
    if (!localizacao.fonteSimulada) {
      localizacao.definirRotaSimulada(rota);
    }
    localizacao.usarSimulador(!localizacao.fonteSimulada);
  }

  return (
    <View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{checked: localizacao.fonteSimulada}}
        accessibilityLabel="GPS simulado"
        style={estilos.mapaDevBotao}
        onPress={alternarSimulador}>
        <Text style={estilos.localizacaoAcaoTexto}>GPS simulado: {localizacao.fonteSimulada ? 'ligado' : 'desligado'}</Text>
      </Pressable>
      {localizacao.fonteSimulada ? (
        <>
          <View style={estilos.mapaDevBotoes}>
            {CENARIOS.map(({cenario, rotulo}) => (
              <Pressable
                key={cenario}
                accessibilityRole="button"
                accessibilityState={{selected: localizacao.cenarioSimulado === cenario}}
                style={[estilos.mapaDevBotao, localizacao.cenarioSimulado === cenario && estilos.mapaDevBotaoAtivo]}
                onPress={() => localizacao.definirCenarioSimulado(cenario)}>
                <Text style={estilos.localizacaoAcaoTexto}>{rotulo}</Text>
              </Pressable>
            ))}
            {[40, 120, 300].map(velocidade => (
              <Pressable
                key={velocidade}
                accessibilityRole="button"
                accessibilityLabel={`Simular ${velocidade} quilômetros por hora`}
                style={estilos.mapaDevBotao}
                onPress={() => localizacao.definirVelocidadeSimulada(velocidade)}>
                <Text style={estilos.localizacaoAcaoTexto}>{velocidade} km/h</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      <Text style={estilos.textoApoio}>
        Leituras: {diagnostico.leituras} • trocas de modo: {diagnostico.trocasDeModo}
      </Text>
      <Text style={estilos.textoApoio}>
        Intervalo médio: movimento {formatarIntervalo(intervaloMedioMs(diagnostico, 'emMovimento'))} • parado{' '}
        {formatarIntervalo(intervaloMedioMs(diagnostico, 'parado'))}
      </Text>
    </View>
  );
}
