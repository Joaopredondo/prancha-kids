# Prancha Kids

Prancha de comunicação (CAA) para crianças, com vocabulário do dia a dia e da igreja.
Toque na figura → ouve a palavra. Funciona no navegador do celular, instala na tela
inicial e roda offline.

## Rodar

```bash
npm install
npm run dev -- --host      # abra no celular pelo IP mostrado no terminal
npm run build && npm run preview
```

> **Erro `ENOSPC: System limit for number of file watchers reached`** no `npm run dev`:
> é limite do sistema, não do projeto. Corrija com
> `sudo sysctl fs.inotify.max_user_watches=524288` (para persistir, adicione
> `fs.inotify.max_user_watches=524288` em `/etc/sysctl.d/99-inotify.conf`).

## Como o conteúdo funciona

Tudo vem de `src/data/cards.ts` — 37 cards, cada um com:

| campo | para que serve |
|---|---|
| `id` | nome dos arquivos: `public/img/{id}.webp` e `public/audio/{id}.mp3` |
| `label` | texto exibido no card |
| `fala` | texto falado, quando diferente do label (ex.: "Estou com medo") |
| `emoji` | figura provisória, usada enquanto não existe imagem própria |
| `categoria` | aba onde o card aparece |
| `classe` | classe gramatical → cor da borda (código Fitzgerald) |

**A ordem do array é a posição na prancha e não deve mudar** — a criança memoriza
onde cada figura fica. Cards novos entram no fim da sua categoria.

Cores (código Fitzgerald, padrão em CAA):
verde = ações · laranja = coisas · azul = como estou · rosa = social ·
amarelo = pessoas · vermelho = parar/não.

## Agora e depois

Quadro de transição portado do Lume (`src/dados/rotina.ts`, `src/dados/figurinhas.ts`,
`src/components/AgoraEDepois.tsx`). A prancha diz o que a criança quer; este quadro
diz o que vem agora e o que vem depois — a troca de atividade é onde a crise
costuma acontecer.

Mesma lógica do Lume: as 13 figurinhas, a rotina padrão do culto, "não passa do
último passo", soltar em DEPOIS além do fim estende a fila, e o modo criança
esconde a bandeja (sair dele exige segurar 3 segundos).

Diferenças, todas de interface:

- **Empilha no celular**, duas colunas a partir de `sm`. No Lume o quadro é
  `absolute inset-0` com largura calculada e no celular metade ficava fora da tela.
- **Sem arrastar**: só tocar a figurinha e tocar o espaço. Era o caminho
  acessível que o Lume já tinha, e é o único que não quebra no toque.
- Emoji e cor por classe gramatical no lugar das silhuetas sobre fundo preto.
  Quando a figurinha equivale a um card (`cardId`), usa a mesma foto que a
  criança já conhece da prancha.

A rotina fica salva em `localStorage` — é a mesma toda semana. O passo atual
também é salvo, mas zera quando a data muda.

## Ficha do culto

Portada do projeto Lume (`src/dados/ficha.ts`, `src/components/Ficha.tsx`), com os
mesmos campos e a mesma ordem da folha impressa do ministério. Diferenças: o nome
da criança é digitado na ficha (aqui não há perfil) e não existe o bloco
"Preenchido pelo app" (o Prancha não registra sessão).

- Abre segurando o botão **Ficha do culto por 3 segundos** — regra herdada do
  Lume, para a criança não cair nela sem querer.
- Uma ficha por criança por dia; reabrir continua de onde parou.
- Salvar não valida nada: ficha pela metade vale mais que ficha em branco.
- Escolha única **desmarca** ao tocar de novo, como no papel.
- **Contém dado de saúde de menor** (nome, idade, laudo). Fica só no aparelho, em
  `localStorage`, sem servidor. Quem empresta o tablet leva o histórico junto —
  não há login separando um voluntário do outro. Apague as fichas antes de
  repassar o aparelho.
- "Imprimir / PDF" usa a impressão do navegador; o CSS de impressão esconde
  cabeçalho, menu e rodapé e força fundo claro.

## Áudio

O app toca `public/audio/{id}.mp3` quando o arquivo existe e cai para a voz do
navegador (`speechSynthesis`) quando não existe — nunca fica mudo.

Como a voz do navegador varia muito entre aparelhos (Android costuma ter voz pt-BR
ruim ou nenhuma), o ideal é gerar os 37 arquivos uma vez:

1. **Gravado por uma pessoa** (melhor resultado com criança): grave cada palavra
   nomeando o arquivo com o id do card e rode
   `./scripts/normalizar-audio.sh ~/pasta-das-gravacoes`.
2. **TTS de qualidade**: gere os MP3 com Google Cloud TTS, Azure Neural ou
   ElevenLabs em pt-BR e coloque em `public/audio/` com o nome do id.

## Imagens

Coloque `public/img/{id}.webp` (512×512 sugerido). Sem imagem, o card mostra o
emoji — o app já é usável assim, mas **emoji é só provisório**: é abstrato demais
para vários conceitos ("acabou" 🏁, "esperar" ⏳, "quero mais" ➕) e o desenho muda
entre Android, iPhone e desktop, o que atrapalha o reconhecimento.

Ordem de produção recomendada:

1. **Foto real** (celular, fundo neutro) das pessoas e objetos do cotidiano da
   criança — é o que ela reconhece mais rápido:
   `ir-com-a-mamae`, `ir-com-o-papai`, `eu`, `voce`, `agua`, `banheiro`, `comer`,
   `parquinho`, `atividade`, `louvor`.
2. **Pictograma ARASAAC** (`arasaac.org`, CC BY-NC-SA, exige atribuição) para
   verbos e abstratos: `quero`, `quero-mais`, `acabou`, `esperar`, `ajuda`,
   `parar`, `pegar`, `subir`.
3. Sentimentos (`feliz`, `triste`, `bravo`, `nervoso`, `medo`) podem ficar por
   último: expressão facial já é naturalmente reconhecível.

Antes de escolher, pergunte à fonoaudióloga/professora qual sistema simbólico a
criança já usa (ARASAAC, PCS/Boardmaker, PECS). Usar o mesmo símbolo em casa,
escola e igreja vale mais que a qualidade isolada do símbolo.

## Assets parciais

Foto e áudio são resolvidos **card a card**: dá para subir 5 fotos hoje e o resto
no mês que vem. Um card pode ter foto sem gravação, gravação sem foto, ou nenhum
dos dois.

O plugin `manifesto-de-assets` (em `vite.config.ts`) lê `public/img` e
`public/audio` durante o build e entrega a lista ao app como `virtual:assets` —
por isso não existe requisição 404 para arquivo que ainda não foi feito. Em
`npm run dev`, largar um arquivo novo na pasta recarrega a página sozinho.
**Depois de adicionar assets, rode `npm run build` de novo** para eles entrarem no
cache offline.

## Deploy

Hospedado na **Vercel**, ligado ao repositório: todo push na `main` publica em
produção, e push em qualquer outra branch gera uma URL de pré-visualização.
Build `npm run build`, saída `dist` — detectados sozinhos pela Vercel.

Para trabalhar sem publicar direto (recomendado para tudo que mexa em ficha,
perfil ou rotina salva, porque um erro ali apaga registro de criança):

```bash
git switch -c minha-mudanca
git push -u origin minha-mudanca   # abre um Preview Deployment
git switch main && git merge minha-mudanca && git push
```

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · Howler.js · Motion ·
vite-plugin-pwa (Workbox) · Nunito (fonte local, sem CDN).
