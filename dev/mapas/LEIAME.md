# Mapa e rotas locais (Sprint 2, US05.01)

Sobe no seu PC o **OSRM** (cálculo do trajeto) e o **TileServer GL** (mapa), com dados do OpenStreetMap de um recorte ao redor de São José dos Campos. O celular fica no cabo USB e acessa tudo por `adb reverse`.

```
Celular ──adb reverse 3000──▶ backend Node ──▶ OSRM (127.0.0.1:5000, só no PC)
Celular ──adb reverse 8080──▶ TileServer GL (estilo, fontes e tiles vetoriais)
```

> **Provisório.** O recorte é um retângulo (`-46.15,-23.40,-45.35,-22.85`: São José dos Campos, Jacareí, Caçapava e Taubaté). Não é o recorte oficial do Vale do Paraíba (PV01). Os serviços de produção serão decididos na Sprint 3 (veja `docs/pendencias-sprint2.md`).

## Requisitos
- Docker Desktop aberto (o ícone da baleia precisa estar "Engine running").
- Node 22 ou mais (já exigido pelo projeto) e `curl` (já vem no Windows 10/11).
- ~3 GB livres em disco para os dados (o download do Sudeste tem ~860 MB).

## 1. Preparar os dados (uma vez)
Na raiz do projeto:

```powershell
node dev/mapas/preparar-mapas.js
```

Etapas: baixa o Sudeste do Geofabrik, recorta o retângulo, prepara o OSRM (`extract`, `partition`, `customize`), gera os tiles com o Tilemaker (esquema OpenMapTiles) e monta o estilo do TileServer GL. Etapas já feitas são puladas. Para outro recorte: `--recorte oeste,sul,leste,norte`; para refazer: `--forcar`. Tudo vai para `dev/mapas/dados/` (ignorado pelo git).

Os tempos e tamanhos reais ficam registrados no fim deste arquivo (alimentam a HU01.03).

## 2. Subir os serviços
```powershell
docker compose -f dev/mapas/docker-compose.yml up -d
```

Teste no PC:
- Rota: <http://127.0.0.1:5000/route/v1/driving/-45.886,-23.179;-45.5558,-23.0265?overview=false> (deve devolver `"code":"Ok"`).
- Mapa: <http://127.0.0.1:8080/styles/rotamestre/> (pré-visualização do estilo).

## 3. Rodar o app no celular (cabo USB)
```powershell
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8080 tcp:8080
```

Backend (em `backend/`, com `ROTAMESTRE_SEED_DEMO=1` no `.env` para a rota RT-001 ter coordenadas): `npm start`. Metro: `npm start` na raiz. App: veja o `CLAUDE.md` (build com `--no-packager`).

No app, entre como motorista (`motorista@rotamestre.com`, senha `123`) → **Minha rota** → **Ver no mapa**.

## Parar e limpar
```powershell
docker compose -f dev/mapas/docker-compose.yml down
Remove-Item -Recurse -Force dev/mapas/dados   # apaga os dados gerados
```

## O que esperar na tela
- Linha azul do trajeto, paradas numeradas (verde quando concluídas) e um painel com paradas, distância e tempo **sem trânsito**.
- Rota sem coordenadas: mensagem "Trajeto indisponível" com os nomes das paradas.
- Parada a mais de 300 m de uma via mapeada: o servidor recusa e diz qual (o OSRM sempre "gruda" no caminho mais próximo, então a distância é conferida).
- Servidor de mapa ou OSRM fora: mensagem de erro com "Tentar novamente".
- A atribuição "© OpenStreetMap contributors" aparece no botão de informações do mapa e vem dos metadados dos tiles.

## Medições (preencher)
| Item | Valor |
| :--- | :--- |
| Download do Sudeste | |
| Recorte (tamanho do `.osm.pbf`) | |
| OSRM: tempo e pico de RAM da preparação | |
| OSRM: tamanho dos arquivos e RAM em execução | |
| Tiles: tempo e tamanho do `.mbtiles` | |
