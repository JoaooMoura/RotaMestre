// Animações curtas de interface (só aparência): entrada de tela e toque em botão.
// Tudo roda no driver nativo (opacity/transform), sem recalcular layout a cada quadro.
import React, {useEffect, useRef} from 'react';
import {AccessibilityInfo, Animated, Easing, View} from 'react-native';
import {estilos} from './estilos';

const DURACAO_ENTRADA = 160;
const DESLOCAMENTO_ENTRADA = 8;
const ESCALA_PRESSIONADO = 0.97;

// "Remover animações" do Android: lido uma vez e atualizado por evento,
// para a animação começar no mesmo quadro da montagem (sem esperar uma chamada assíncrona).
let reduzirMovimento = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then(valor => {
    reduzirMovimento = valor;
  })
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', valor => {
  reduzirMovimento = valor;
});

type TransicaoEntradaProps = {
  children: React.ReactNode;
};

// Tela nova entra com fade curto e leve subida. Use com `key` para repetir a cada troca de tela.
export function TransicaoEntrada({children}: TransicaoEntradaProps) {
  const progresso = useRef(new Animated.Value(reduzirMovimento ? 1 : 0)).current;

  useEffect(() => {
    if (reduzirMovimento) {
      return;
    }
    Animated.timing(progresso, {
      toValue: 1,
      duration: DURACAO_ENTRADA,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progresso]);

  const translateY = progresso.interpolate({
    inputRange: [0, 1],
    outputRange: [DESLOCAMENTO_ENTRADA, 0],
  });

  const estiloAnimado = {opacity: progresso, transform: [{translateY}]};

  // Fundo fixo atrás da camada animada: durante o fade aparece branco, não o azul da área segura.
  return (
    <View style={estilos.fundoTransicao}>
      <Animated.View style={[estilos.flex, estiloAnimado]}>{children}</Animated.View>
    </View>
  );
}

// Botão "afunda" levemente ao toque e volta com mola.
export function useEscalaAoPressionar() {
  const escala = useRef(new Animated.Value(1)).current;

  function molaPara(destino: number) {
    Animated.spring(escala, {
      toValue: destino,
      speed: 40,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }

  return {
    estiloEscala: {transform: [{scale: escala}]},
    aoPressionar: () => molaPara(ESCALA_PRESSIONADO),
    aoSoltar: () => molaPara(1),
  };
}
