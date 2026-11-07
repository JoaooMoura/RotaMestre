// Prepara os dados de mapa e de rotas do ambiente local (Sprint 2, US05.01).
// Requer Docker em execução e Node >= 22. Uso:
//   node dev/mapas/preparar-mapas.js [--recorte oeste,sul,leste,norte] [--forcar]
// Etapas já concluídas são puladas; --forcar refaz tudo a partir do recorte.
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {DatabaseSync} = require('node:sqlite');

// Recorte retangular PROVISÓRIO ao redor de São José dos Campos (inclui Jacareí, Caçapava e Taubaté).
// Não é o recorte oficial do Vale do Paraíba (PV01).
const RECORTE_PADRAO = '-46.15,-23.40,-45.35,-22.85';
const URL_PBF = 'https://download.geofabrik.de/south-america/brazil/sudeste-latest.osm.pbf';

// O MapLibre nativo lê a atribuição como HTML e ignora texto puro sem link.
const ATRIBUICAO =
  '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>';

const IMAGEM_OSMIUM = 'iboates/osmium';
const IMAGEM_OSRM = 'ghcr.io/project-osrm/osrm-backend';
const IMAGEM_TILEMAKER = 'ghcr.io/systemed/tilemaker:master';
const IMAGEM_TILESERVER = 'maptiler/tileserver-gl';

const raiz = path.join(__dirname, 'dados');
const pastas = {
  brutos: path.join(raiz, 'brutos'),
  regiao: path.join(raiz, 'regiao'),
  osrm: path.join(raiz, 'osrm'),
  tilemaker: path.join(raiz, 'tilemaker'),
  tileserver: path.join(raiz, 'tileserver'),
};

function argumento(nome) {
  const indice = process.argv.indexOf(nome);
  return indice >= 0 ? process.argv[indice + 1] : undefined;
}

const forcar = process.argv.includes('--forcar');
const recorte = (argumento('--recorte') || RECORTE_PADRAO).split(',').map(Number);
if (recorte.length !== 4 || recorte.some(Number.isNaN)) {
  console.error('Recorte inválido. Use: --recorte oeste,sul,leste,norte');
  process.exit(1);
}

function executar(comando, argumentos, opcoes = {}) {
  const resultado = spawnSync(comando, argumentos, {stdio: 'inherit', ...opcoes});
  if (resultado.status !== 0) {
    throw new Error(`Falhou: ${comando} ${argumentos.slice(0, 4).join(' ')} ...`);
  }
  return resultado;
}

function docker(volume, imagem, argumentos, entrypoint) {
  const base = ['run', '--rm', '-v', `${volume.replace(/\\/g, '/')}:/data`];
  if (entrypoint) {
    base.push('--entrypoint', entrypoint);
  }
  executar('docker', [...base, imagem, ...argumentos]);
}

function lerDaImagem(imagem, caminho) {
  const resultado = spawnSync('docker', ['run', '--rm', '--entrypoint', 'cat', imagem, caminho], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (resultado.status !== 0) {
    throw new Error(`Não foi possível ler ${caminho} da imagem ${imagem}: ${resultado.stderr}`);
  }
  return resultado.stdout;
}

function etapa(titulo) {
  console.log(`\n=== ${titulo} ===`);
}

function baixarRegiao() {
  const destino = path.join(pastas.brutos, 'sudeste-latest.osm.pbf');
  etapa('1/5 Download do Sudeste (Geofabrik, ~860 MB; retoma se interrompido)');
  if (fs.existsSync(destino) && !fs.existsSync(`${destino}.parcial`)) {
    console.log('Já existe, pulando.');
    return destino;
  }
  executar('curl', ['-L', '--fail', '-C', '-', '-o', `${destino}.parcial`, URL_PBF]);
  fs.renameSync(`${destino}.parcial`, destino);
  return destino;
}

function recortarRegiao() {
  const saida = path.join(pastas.regiao, 'regiao.osm.pbf');
  etapa(`2/5 Recorte retangular (${recorte.join(', ')})`);
  if (fs.existsSync(saida) && !forcar) {
    console.log('Já existe, pulando.');
    return;
  }
  docker(raiz, IMAGEM_OSMIUM, [
    'extract',
    '--bbox',
    recorte.join(','),
    '--strategy',
    'complete_ways',
    '--overwrite',
    '-o',
    '/data/regiao/regiao.osm.pbf',
    '/data/brutos/sudeste-latest.osm.pbf',
  ]);
  fs.writeFileSync(path.join(pastas.regiao, 'recorte.txt'), `${recorte.join(',')}\n`);
}

function prepararOsrm() {
  etapa('3/5 OSRM (extract, partition, customize)');
  if (fs.existsSync(path.join(pastas.osrm, 'regiao.osrm.mldgr')) && !forcar) {
    console.log('Já existe, pulando.');
    return;
  }
  fs.copyFileSync(path.join(pastas.regiao, 'regiao.osm.pbf'), path.join(pastas.osrm, 'regiao.osm.pbf'));
  docker(pastas.osrm, IMAGEM_OSRM, ['osrm-extract', '-p', '/opt/car.lua', '/data/regiao.osm.pbf']);
  docker(pastas.osrm, IMAGEM_OSRM, ['osrm-partition', '/data/regiao.osrm']);
  docker(pastas.osrm, IMAGEM_OSRM, ['osrm-customize', '/data/regiao.osrm']);
  fs.rmSync(path.join(pastas.osrm, 'regiao.osm.pbf'));
}

function prepararConfigTilemaker() {
  const config = JSON.parse(lerDaImagem(IMAGEM_TILEMAKER, '/usr/src/app/resources/config-openmaptiles.json'));
  // Camadas que dependem de shapefiles externos (oceano, geleiras, áreas urbanas) não existem
  // numa região do interior e custariam ~1 GB de download.
  for (const [nome, camada] of Object.entries(config.layers)) {
    if (camada.source) {
      delete config.layers[nome];
    }
  }
  config.settings.name = 'RotaMestre regiao';
  fs.writeFileSync(path.join(pastas.tilemaker, 'config-regiao.json'), JSON.stringify(config, null, 2));
  fs.writeFileSync(
    path.join(pastas.tilemaker, 'process-openmaptiles.lua'),
    lerDaImagem(IMAGEM_TILEMAKER, '/usr/src/app/resources/process-openmaptiles.lua'),
  );
}

function gerarTiles() {
  etapa('4/5 Tiles vetoriais (Tilemaker, esquema OpenMapTiles)');
  const mbtiles = path.join(pastas.tileserver, 'regiao.mbtiles');
  if (fs.existsSync(mbtiles) && !forcar) {
    console.log('Já existe, pulando (só atualiza os metadados).');
    ajustarMetadados(mbtiles);
    return;
  }
  prepararConfigTilemaker();
  fs.rmSync(mbtiles, {force: true});
  fs.copyFileSync(path.join(pastas.regiao, 'regiao.osm.pbf'), path.join(pastas.tilemaker, 'regiao.osm.pbf'));
  docker(
    pastas.tilemaker,
    IMAGEM_TILEMAKER,
    [
      '--input', '/data/regiao.osm.pbf',
      '--output', '/data/regiao.mbtiles',
      '--config', '/data/config-regiao.json',
      '--process', '/data/process-openmaptiles.lua',
    ],
    '/usr/src/app/tilemaker',
  );
  fs.renameSync(path.join(pastas.tilemaker, 'regiao.mbtiles'), mbtiles);
  fs.rmSync(path.join(pastas.tilemaker, 'regiao.osm.pbf'));

  ajustarMetadados(mbtiles);
}

// O Tilemaker grava bounds e center zerados; o MapLibre só pede tiles dentro de bounds.
function ajustarMetadados(mbtiles) {
  const [oeste, sul, leste, norte] = recorte;
  const metadados = {
    attribution: ATRIBUICAO,
    bounds: `${oeste},${sul},${leste},${norte}`,
    center: `${(oeste + leste) / 2},${(sul + norte) / 2},11`,
  };
  const banco = new DatabaseSync(mbtiles);
  const gravar = banco.prepare('INSERT OR REPLACE INTO metadata (name, value) VALUES (?, ?)');
  Object.entries(metadados).forEach(([nome, valor]) => gravar.run(nome, valor));
  banco.close();
}

function configurarTileServer() {
  etapa('5/5 Estilo e configuração do TileServer GL');
  const estilo = JSON.parse(
    lerDaImagem(IMAGEM_TILESERVER, '/usr/src/app/node_modules/tileserver-gl-styles/styles/basic-preview/style.json'),
  );
  estilo.name = 'RotaMestre';
  estilo.id = 'rotamestre';
  estilo.sources.openmaptiles.url = 'mbtiles://{regiao}';
  estilo.sources.openmaptiles.attribution = ATRIBUICAO;

  const pastaEstilo = path.join(pastas.tileserver, 'styles', 'rotamestre');
  fs.mkdirSync(pastaEstilo, {recursive: true});
  fs.writeFileSync(path.join(pastaEstilo, 'style.json'), JSON.stringify(estilo, null, 2));

  const config = {
    options: {
      paths: {
        root: '/data',
        styles: 'styles',
        mbtiles: '.',
        fonts: '/usr/src/app/node_modules/tileserver-gl-styles/fonts',
      },
    },
    styles: {rotamestre: {style: 'rotamestre/style.json'}},
    data: {regiao: {mbtiles: 'regiao.mbtiles'}},
  };
  fs.writeFileSync(path.join(pastas.tileserver, 'config.json'), JSON.stringify(config, null, 2));
}

Object.values(pastas).forEach(pasta => fs.mkdirSync(pasta, {recursive: true}));
baixarRegiao();
recortarRegiao();
prepararOsrm();
gerarTiles();
configurarTileServer();

console.log('\nPronto. Suba os serviços com: docker compose -f dev/mapas/docker-compose.yml up -d');
