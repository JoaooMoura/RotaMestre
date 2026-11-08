// Extrai os limites de velocidade EXPLÍCITOS do OpenStreetMap (tag maxspeed) do recorte local (US05.05).
// Requer Docker (imagem iboates/osmium, a mesma do preparar-mapas.js) e que preparar-mapas.js já tenha rodado. Uso:
//   node dev/mapas/extrair-limites.js
// Saída: dev/mapas/dados/limites/limites.json  ({versao, fonte, vias: [{k: km/h, p: [[lon, lat], ...]}]}).
// Só entram vias com limite numérico claro ("60" ou "60 km/h"). Valores como "signals", "BR:urban", "none"
// e unidades em mph ficam de fora: onde não há limite validado, o app informa que ele é indisponível.
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, 'dados');
const pastaRegiao = path.join(raiz, 'regiao');
const pastaSaida = path.join(raiz, 'limites');
const IMAGEM_OSMIUM = 'iboates/osmium';

function limiteNumerico(valor) {
  const encontrado = /^\s*(\d{1,3})\s*(km\/h)?\s*$/.exec(String(valor));
  if (!encontrado) {
    return null;
  }
  const kmh = Number(encontrado[1]);
  return kmh >= 5 && kmh <= 130 ? kmh : null;
}

function converter(linhas) {
  const vias = [];
  for (const linha of linhas) {
    if (!linha.trim()) {
      continue;
    }
    const f = JSON.parse(linha.replace(/^\u001e/, ''));
    if (f.geometry?.type !== 'LineString' || !f.properties?.highway) {
      continue;
    }
    const k = limiteNumerico(f.properties.maxspeed);
    if (k !== null) {
      vias.push({k, p: f.geometry.coordinates.map(([lon, lat]) => [Number(lon.toFixed(6)), Number(lat.toFixed(6))])});
    }
  }
  return vias;
}

if (require.main === module) {
  if (!fs.existsSync(path.join(pastaRegiao, 'regiao.osm.pbf'))) {
    console.error('Falta dev/mapas/dados/regiao/regiao.osm.pbf. Rode antes: node dev/mapas/preparar-mapas.js');
    process.exit(1);
  }
  fs.mkdirSync(pastaSaida, {recursive: true});
  const script = [
    'osmium tags-filter /data/regiao/regiao.osm.pbf w/highway w/maxspeed -o /tmp/f.pbf -O',
    'osmium tags-filter /tmp/f.pbf w/maxspeed -o /tmp/m.pbf -O',
    'osmium export /tmp/m.pbf -f geojsonseq -o /tmp/m.json -O',
    'cat /tmp/m.json',
  ].join(' && ');
  const resultado = spawnSync(
    'docker',
    ['run', '--rm', '-v', `${raiz.replace(/\\/g, '/')}:/data:ro`, '--entrypoint', 'sh', IMAGEM_OSMIUM, '-c', script],
    {encoding: 'utf8', maxBuffer: 256 * 1024 * 1024},
  );
  if (resultado.status !== 0) {
    console.error(resultado.stderr);
    process.exit(1);
  }
  const vias = converter(resultado.stdout.split('\n'));
  const saida = {
    versao: 1,
    fonte: 'OpenStreetMap (tag maxspeed explícita) © OpenStreetMap contributors',
    geradoEm: new Date().toISOString(),
    vias,
  };
  fs.writeFileSync(path.join(pastaSaida, 'limites.json'), JSON.stringify(saida));
  console.log(`${vias.length} vias com limite numérico gravadas em dev/mapas/dados/limites/limites.json`);
}

module.exports = {limiteNumerico, converter};
