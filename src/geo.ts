export type PontoGeografico = {latitude: number; longitude: number};

const RAIO_TERRA_M = 6371008.8;
const METROS_POR_GRAU = (Math.PI * RAIO_TERRA_M) / 180;
const paraRadianos = (graus: number) => (graus * Math.PI) / 180;
const paraGraus = (radianos: number) => (radianos * 180) / Math.PI;

export function distanciaMetros(a: PontoGeografico, b: PontoGeografico) {
  const dLat = paraRadianos(b.latitude - a.latitude);
  const dLon = paraRadianos(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(paraRadianos(a.latitude)) * Math.cos(paraRadianos(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function rumoGraus(origem: PontoGeografico, destino: PontoGeografico) {
  const lat1 = paraRadianos(origem.latitude);
  const lat2 = paraRadianos(destino.latitude);
  const dLon = paraRadianos(destino.longitude - origem.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (paraGraus(Math.atan2(y, x)) + 360) % 360;
}

export function deslocar(origem: PontoGeografico, rumo: number, metros: number): PontoGeografico {
  const lat1 = paraRadianos(origem.latitude);
  const lon1 = paraRadianos(origem.longitude);
  const rumoRad = paraRadianos(rumo);
  const distanciaAngular = metros / RAIO_TERRA_M;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanciaAngular) + Math.cos(lat1) * Math.sin(distanciaAngular) * Math.cos(rumoRad),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(rumoRad) * Math.sin(distanciaAngular) * Math.cos(lat1),
      Math.cos(distanciaAngular) - Math.sin(lat1) * Math.sin(lat2),
    );
  return {latitude: paraGraus(lat2), longitude: ((paraGraus(lon2) + 540) % 360) - 180};
}

export type ProjecaoNoSegmento = {
  ponto: PontoGeografico;
  /** Posição relativa no segmento, de 0 (início) a 1 (fim). */
  t: number;
  distanciaM: number;
};

/** Projeta `p` no segmento a→b (plano local; adequado para segmentos de rua). */
export function projetarNoSegmento(p: PontoGeografico, a: PontoGeografico, b: PontoGeografico): ProjecaoNoSegmento {
  const cosLat = Math.cos(paraRadianos(a.latitude));
  const paraXY = (q: PontoGeografico) => ({
    x: (q.longitude - a.longitude) * cosLat * METROS_POR_GRAU,
    y: (q.latitude - a.latitude) * METROS_POR_GRAU,
  });
  const pb = paraXY(b);
  const pp = paraXY(p);
  const comprimentoAoQuadrado = pb.x * pb.x + pb.y * pb.y;
  const t = comprimentoAoQuadrado === 0 ? 0 : Math.max(0, Math.min(1, (pp.x * pb.x + pp.y * pb.y) / comprimentoAoQuadrado));
  const ponto = {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
  return {ponto, t, distanciaM: distanciaMetros(p, ponto)};
}
