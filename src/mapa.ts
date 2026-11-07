import {Coordenada} from './tipos';

export type LimitesDoMapa = [oeste: number, sul: number, leste: number, norte: number];

export function limitesDasCoordenadas(coordenadas: Coordenada[]): LimitesDoMapa | null {
  if (coordenadas.length === 0) {
    return null;
  }
  const longitudes = coordenadas.map(([longitude]) => longitude);
  const latitudes = coordenadas.map(([, latitude]) => latitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

export function formatarDistancia(metros: number) {
  if (metros < 1000) {
    return `${Math.round(metros)} m`;
  }
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatarDuracao(segundos: number) {
  const minutos = Math.max(1, Math.round(segundos / 60));
  if (minutos < 60) {
    return `${minutos} min`;
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
