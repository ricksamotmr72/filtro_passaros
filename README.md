# BirdMorph Brasil

Filtro de câmera que transforma o rosto da criança em uma ave brasileira (Pica-Pau, Tucano ou Beija-Flor), usando fotos reais das aves que se comportam como uma máscara: acompanham o giro, a inclinação e a distância da cabeça, piscam junto com a criança e abrem o bico quando ela abre a boca.

## Como usar

1. Abra `index.html` no Google Chrome ou no Microsoft Edge (pode ser direto do disco, com dois cliques).
2. Clique em **Ativar Câmera Agora** e permita o acesso à câmera.
3. Peça para a criança olhar de frente para a câmera por 1 ou 2 segundos: é quando o filtro aprende o formato do rosto dela.
4. Escolha a ave no painel lateral. **Capturar Foto** salva uma imagem.

É preciso ter internet: o reconhecimento facial (MediaPipe) e o visual (Tailwind, ícones, fonte) vêm de CDNs.

## Estrutura

```
index.html                 Página (só a marcação)
css/styles.css             Estilos próprios (o resto é Tailwind)
js/
  config.js                Aves: olhos, bico, ajustes; pontos do rosto usados
  utils.js                 Matemática, cores, matrizes 3x3
  state.js                 Estado compartilhado e canvases
  assets.js                Carrega as fotos, recorta o bico, monta as malhas
  tracking.js              Rastreamento: modelo 3D do rosto e pose da cabeça
  render.js                Desenho da máscara, pálpebras, bico, penas, partículas
  app.js                   Câmera, laço de cada quadro, controles da tela
assets/
  images/                  Fotos originais das aves (PNG, fundo transparente)
  data/aves-data.js        Fotos embutidas, geradas a partir de assets/images
tools/gerar-aves-data.ps1  Regenera assets/data/aves-data.js
```

Os scripts são clássicos (sem módulos ES) e são carregados em ordem de dependência no fim do `index.html`. Assim o projeto funciona abrindo o arquivo direto do disco, sem servidor.

## Como a máscara funciona

1. O MediaPipe Face Mesh entrega 478 pontos 3D do rosto a cada quadro.
2. **Modelo do rosto** (`tracking.js`): nos primeiros quadros, o filtro guarda a posição 3D de cerca de 110 pontos do rosto (em unidades da distância entre os cantos dos olhos). Depois refina devagar, só quando o rosto está relaxado.
3. **Pose rígida**: a cada quadro, o modelo é alinhado aos pontos atuais por um ajuste rígido 3D (Kabsch com escala), usando só os pontos que não se mexem com expressões (testa, têmporas, cantos dos olhos, ponte do nariz, maçãs). O resultado é uma rotação, uma escala e uma posição, então girar a cabeça nunca deforma a ave.
4. **Superfície da máscara**: a foto da ave é dividida em uma malha e apoiada sobre o relevo do rosto da criança. Fora do rosto (topete, pescoço), a superfície continua como uma cúpula ajustada ao rosto. Os triângulos que ficam de costas para a câmera não são desenhados.
5. **Bico**: é uma peça 3D separada que se projeta para a frente. As mandíbulas giram em torno dos cantos da boca, e a abertura segue os lábios com uma leve inércia.
6. **Pálpebras**: fecham na cor de cada ave quando a criança pisca.

## Trocar ou ajustar uma ave

- **Foto nova**: substitua o PNG em `assets/images/`, mantendo o nome, o formato quadrado e o fundo transparente. Depois rode, na pasta do projeto:

  ```
  powershell -ExecutionPolicy Bypass -File tools\gerar-aves-data.ps1
  ```

  e meça de novo, em `js/config.js`, os olhos (`eyes`) e o contorno do bico (`beak.poly`), em pixels da foto original.
- **Tamanho no rosto**: `fit` em `js/config.js` (ou os controles "Tamanho" e "Altura" na tela).
- **Abertura do bico**: `beak.gapeMul` (quanto cada ave abre) e `beak.depth` (quanto a ponta se projeta para a frente).
