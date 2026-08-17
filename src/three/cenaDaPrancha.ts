import * as THREE from 'three';

export interface Palavra {
  emoji: string;
  /** Cor da classe gramatical, já resolvida a partir das variáveis do CSS. */
  cor: string;
}

export interface Elenco {
  /** Palavras que o card protagonista mostra, uma a cada volta. */
  giro: Palavra[];
  /** Palavras dos cards pequenos que flutuam ao redor, enchendo o painel. */
  coro: Palavra[];
  /** Mostrada quando o login dá certo — o "Sim" da própria prancha. */
  sim: Palavra;
  /** Mostrada quando o login falha — o "Não" da própria prancha. */
  nao: Palavra;
}

export interface Paleta {
  fundo: string;
  superficie: string;
}

/**
 * O que está acontecendo no formulário. A cena reage a isto: é o que separa
 * um fundo animado de uma tela que responde a quem está nela.
 */
export type Momento = 'repouso' | 'digitando' | 'senha' | 'erro' | 'sucesso';

export interface CenaDaPrancha {
  definirMomento: (momento: Momento) => void;
  encerrar: () => void;
}

/** Proporção do card da prancha (`aspect-[5/6]`). */
const LARGURA = 1;
const ALTURA = 1.2;

/**
 * Cena do painel de identidade da tela de login.
 *
 * Um card da prancha em tamanho grande gira devagar e troca de palavra a cada
 * meia-volta, com cards menores flutuando ao redor. Não é papel de parede: a
 * cena responde ao formulário — vira de costas quando a senha está sendo
 * digitada, mostra "Não" quando o login falha e "Sim" quando dá certo.
 *
 * Usar o próprio vocabulário da prancha como reação é de propósito: é a mesma
 * linguagem que a criança usa no app, e não um mascote emprestado de fora.
 *
 * Nunca faz parte do fluxo de entrar: se o WebGL falhar, quem chama trata o
 * erro e o painel continua de pé só com o gradiente de fundo.
 */
export function criarCenaDaPrancha(
  canvas: HTMLCanvasElement,
  elenco: Elenco,
  paleta: Paleta,
): CenaDaPrancha {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  // Retina renderiza 4× mais pixels por quadro; acima de 2 o ganho não aparece
  // e a bateria do tablet paga a conta.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const cena = new THREE.Scene();
  cena.fog = new THREE.FogExp2(new THREE.Color(paleta.fundo), 0.055);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const descartaveis: { dispose: () => void }[] = [];

  // Iluminação de três pontos, o que dá o acabamento "de estúdio": uma luz
  // principal que modela o volume, uma fria de preenchimento que impede sombra
  // preta chapada, e uma quente de contorno que descola o card do fundo.
  cena.add(new THREE.AmbientLight('#ffffff', 1.25));

  const principal = new THREE.DirectionalLight('#fff6e8', 2.4);
  principal.position.set(4, 5, 7);
  cena.add(principal);

  const preenchimento = new THREE.DirectionalLight('#a8c8ff', 1.15);
  preenchimento.position.set(-6, -1, 4);
  cena.add(preenchimento);

  const contorno = new THREE.DirectionalLight('#ffb3d1', 1.5);
  contorno.position.set(-3, 3, -6);
  cena.add(contorno);

  const corDaSuperficie = new THREE.Color(paleta.superficie);

  const geometriaDaBorda = extrudar(formaArredondada(LARGURA, ALTURA, 0.15), 0.16);
  const geometriaDoMiolo = extrudar(formaArredondada(LARGURA - 0.2, ALTURA - 0.2, 0.09), 0.07);
  const geometriaDoEmoji = new THREE.PlaneGeometry(LARGURA - 0.4, LARGURA - 0.4);
  descartaveis.push(geometriaDaBorda, geometriaDoMiolo, geometriaDoEmoji);

  /** Verniz por cima da cor: é o que tira o aspecto de plástico fosco. */
  const materialDeBorda = (cor: THREE.ColorRepresentation) => {
    const material = new THREE.MeshPhysicalMaterial({
      color: cor,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25,
      sheen: 0.35,
      sheenColor: new THREE.Color('#ffffff'),
    });
    descartaveis.push(material);
    return material;
  };

  const materialDeMiolo = (cor: THREE.Color) => {
    const material = new THREE.MeshPhysicalMaterial({
      color: corDaSuperficie.clone().lerp(cor, 0.16),
      roughness: 0.62,
      metalness: 0,
      clearcoat: 0.35,
    });
    descartaveis.push(material);
    return material;
  };

  /** Um card completo: borda colorida, miolo claro e o emoji por cima. */
  const montarCard = (palavra: Palavra, ladoDaTextura = 256) => {
    const cor = new THREE.Color(palavra.cor);
    const grupo = new THREE.Group();

    grupo.add(new THREE.Mesh(geometriaDaBorda, materialDeBorda(cor)));

    const miolo = new THREE.Mesh(geometriaDoMiolo, materialDeMiolo(cor));
    miolo.position.z = 0.07;
    grupo.add(miolo);

    const textura = texturaDeEmoji(palavra.emoji, ladoDaTextura);
    let materialDoEmoji: THREE.MeshBasicMaterial | undefined;
    if (textura) {
      materialDoEmoji = new THREE.MeshBasicMaterial({
        map: textura,
        transparent: true,
        // O emoji é uma decalcomania: iluminá-lo de novo só apagaria as cores
        // que ele já traz prontas.
        toneMapped: false,
      });
      const malha = new THREE.Mesh(geometriaDoEmoji, materialDoEmoji);
      malha.position.z = 0.17;
      grupo.add(malha);
      descartaveis.push(textura, materialDoEmoji);
    }

    return { grupo, materialDoEmoji };
  };

  // --- Card protagonista -------------------------------------------------

  const protagonista = montarCard(elenco.giro[0]);
  protagonista.grupo.scale.setScalar(0);
  cena.add(protagonista.grupo);

  const faces = elenco.giro.map((p) => texturaDeEmoji(p.emoji));
  const faceSim = texturaDeEmoji(elenco.sim.emoji);
  const faceNao = texturaDeEmoji(elenco.nao.emoji);
  for (const textura of [...faces, faceSim, faceNao]) {
    if (textura) descartaveis.push(textura);
  }

  const materiaisDaBorda = elenco.giro.map((p) => materialDeBorda(new THREE.Color(p.cor)));
  const materialSim = materialDeBorda(new THREE.Color(elenco.sim.cor));
  const materialNao = materialDeBorda(new THREE.Color(elenco.nao.cor));
  const bordaDoProtagonista = protagonista.grupo.children[0] as THREE.Mesh;

  // Começa na segunda palavra: o card já nasce mostrando a primeira, e virar
  // uma volta inteira para cair na mesma face seria um giro em falso.
  let indiceDaFace = 1 % faces.length;
  /** Quando presente, a próxima virada mostra esta face em vez da seguinte. */
  let faceForcada: { textura: THREE.CanvasTexture | null; material: THREE.Material } | null = null;
  let jaVirou = false;

  const trocarFace = () => {
    const escolha = faceForcada ?? {
      textura: faces[indiceDaFace],
      material: materiaisDaBorda[indiceDaFace],
    };
    if (protagonista.materialDoEmoji && escolha.textura) {
      protagonista.materialDoEmoji.map = escolha.textura;
      protagonista.materialDoEmoji.needsUpdate = true;
    }
    bordaDoProtagonista.material = escolha.material;

    if (!faceForcada) indiceDaFace = (indiceDaFace + 1) % faces.length;
    faceForcada = null;
  };

  // --- Cards do coro ------------------------------------------------------

  // Telas estreitas mostram só uma faixa do painel: menos cards ali significa
  // menos GPU no aparelho que tem menos folga.
  const tamanhoDoCoro = canvas.clientWidth < 640 ? 7 : 14;

  const coro = Array.from({ length: tamanhoDoCoro }, (_, i) => {
    const palavra = elenco.coro[i % elenco.coro.length];
    const { grupo } = montarCard(palavra, 128);
    grupo.scale.setScalar(0);
    cena.add(grupo);

    // Duas coroas: uma perto do protagonista e outra aberta até os cantos.
    // Só um anel deixava o miolo cheio e as beiradas do painel vazias.
    const externa = i % 2 === 1;

    return {
      grupo,
      escala: externa ? 0.2 + Math.random() * 0.16 : 0.3 + Math.random() * 0.18,
      // O passo é meia volta desencontrada entre as coroas, para os dois anéis
      // não alinharem os cards em raios iguais.
      angulo: (i / tamanhoDoCoro) * Math.PI * 4 + Math.random() * 0.45,
      raio: externa ? 0.78 + Math.random() * 0.42 : 0.4 + Math.random() * 0.24,
      z: externa ? -5 - Math.random() * 4 : -2 - Math.random() * 2.5,
      origem: new THREE.Vector3(),
      deriva: new THREE.Vector2(0.13 + Math.random() * 0.1, 0.17 + Math.random() * 0.12),
      amplitude: new THREE.Vector2(0.22 + Math.random() * 0.3, 0.3 + Math.random() * 0.35),
      balanco: 0.3 + Math.random() * 0.4,
      fase: Math.random() * Math.PI * 2,
      atraso: 0.3 + 0.05 * i,
    };
  });

  const poeira = criarPoeira(elenco.coro, 95);
  cena.add(poeira.pontos);
  descartaveis.push(poeira.geometria, poeira.material);
  if (poeira.textura) descartaveis.push(poeira.textura);

  // --- Enquadramento ------------------------------------------------------

  const meiaAlturaEm = (z: number) =>
    Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * (camera.position.z - z);

  /** Onde o protagonista se apoia: à direita, longe do texto do painel. */
  const ancora = new THREE.Vector3();

  const redistribuir = () => {
    const meiaAltura = meiaAlturaEm(0);
    const meiaLargura = meiaAltura * camera.aspect;
    // Em telas largas o card sai do meio e vai para a direita, onde não há
    // texto; em telas estreitas ele volta ao centro, porque ali o painel é uma
    // faixa e não existe "lado livre".
    const paraOLado = camera.aspect > 1.1 ? 0.42 : 0;
    ancora.set(meiaLargura * paraOLado, -meiaAltura * 0.06, 0);

    for (const item of coro) {
      const meia = meiaAlturaEm(item.z);
      item.origem.set(
        // O coro acompanha o protagonista para a direita, mas só pela metade:
        // com o mesmo deslocamento dele, a metade esquerda do painel ficava
        // vazia em vez de preenchida.
        (Math.cos(item.angulo) * item.raio + paraOLado * 0.45) * meia * camera.aspect,
        Math.sin(item.angulo) * meia * item.raio,
        item.z,
      );
    }
  };

  const ajustarTamanho = () => {
    const largura = canvas.clientWidth || 1;
    const altura = canvas.clientHeight || 1;
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
    redistribuir();
  };
  ajustarTamanho();

  const observador = new ResizeObserver(ajustarTamanho);
  observador.observe(canvas);

  // --- Reação ao formulário ----------------------------------------------

  let momento: Momento = 'repouso';
  /** Instante em que o momento atual começou, para as reações de uma vez só. */
  let inicioDoMomento = 0;

  const ponteiro = new THREE.Vector2();
  const aoMoverPonteiro = (evento: PointerEvent) => {
    const retangulo = canvas.getBoundingClientRect();
    if (!retangulo.width || !retangulo.height) return;
    ponteiro.set(
      ((evento.clientX - retangulo.left) / retangulo.width) * 2 - 1,
      ((evento.clientY - retangulo.top) / retangulo.height) * 2 - 1,
    );
  };
  // Só quem tem mouse move a cena: no tablet não existe `pointermove` sem o
  // dedo encostado, então a paralaxe simplesmente não acontece lá.
  window.addEventListener('pointermove', aoMoverPonteiro);

  const relogio = new THREE.Timer();
  // Sem isto, voltar para a aba depois de um tempo entrega um salto de vários
  // segundos de uma vez e a cena teleporta.
  relogio.connect(document);

  let angulo = 0;
  let inclinacao = 0;
  let alturaDoPulo = 0;

  // O card não roda sem parar: fica de frente, dá uma volta inteira e para de
  // novo. Girando sem pausa ele passava metade do tempo de perfil, quando não
  // se lê palavra nenhuma — e a graça é justamente ler a palavra.
  const PARADO = 2.6;
  const VOLTA = 0.85;
  let girando = false;
  let avancoDaVolta = 0;
  let duracaoDaVolta = VOLTA;
  let tempoParado = 0;

  renderer.setAnimationLoop(() => {
    relogio.update();
    const dt = Math.min(relogio.getDelta(), 0.05);
    const t = relogio.getElapsed();
    const desdeOMomento = t - inicioDoMomento;

    if (momento === 'senha') {
      // De costas enquanto a senha é digitada: o card não espia.
      angulo = aproximarAngulo(angulo, Math.PI, dt * 5);
      girando = false;
      tempoParado = 0;
      jaVirou = false;
    } else if (girando) {
      avancoDaVolta = Math.min(1, avancoDaVolta + dt / duracaoDaVolta);
      angulo = Math.PI * 2 * suavizarNasPontas(avancoDaVolta);

      // A face troca escondida atrás do próprio card, nunca na frente de quem olha.
      if (avancoDaVolta > 0.5 && !jaVirou) {
        trocarFace();
        jaVirou = true;
      }
      if (avancoDaVolta >= 1) {
        girando = false;
        angulo = 0;
        tempoParado = 0;
      }
    } else {
      // Parado de frente, com um balanço de quem está esperando.
      angulo = Math.sin(t * 0.7) * 0.13;
      tempoParado += dt;
      // Uma reação (o "Não" da recusa, o "Sim" do acerto) não espera a vez:
      // vira na hora.
      if (tempoParado > PARADO || faceForcada) {
        girando = true;
        avancoDaVolta = 0;
        jaVirou = false;
        // Resposta a quem está na tela vem depressa; a troca de palavra à toa
        // pode ser mais preguiçosa.
        duracaoDaVolta = faceForcada ? 0.55 : VOLTA;
      }
    }

    // Reações de uma vez só: o tremor da recusa e o pulo da comemoração.
    let tremor = 0;
    if (momento === 'erro' && desdeOMomento < 0.7) {
      const avanco = desdeOMomento / 0.7;
      tremor = Math.sin(avanco * Math.PI * 7) * 0.16 * (1 - avanco);
    }
    if (momento === 'sucesso' && desdeOMomento < 1) {
      const avanco = desdeOMomento / 1;
      alturaDoPulo = Math.sin(avanco * Math.PI) * 0.5 * (1 - avanco * 0.4);
    } else {
      alturaDoPulo += (0 - alturaDoPulo) * 0.08;
    }

    // Quando alguém escreve, o card se inclina na direção do formulário —
    // atenção, não distração.
    const inclinacaoAlvo = momento === 'digitando' ? 0.22 : 0;
    inclinacao += (inclinacaoAlvo - inclinacao) * 0.05;

    const respiro = Math.sin(t * 0.9) * 0.02;
    const entrada = passandoDoPonto(Math.min(1, Math.max(0, t / 1.1)));

    protagonista.grupo.position.set(
      ancora.x + tremor + Math.sin(t * 0.35) * 0.12,
      ancora.y + alturaDoPulo + Math.sin(t * 0.55) * 0.14,
      ancora.z,
    );
    protagonista.grupo.rotation.set(inclinacao * 0.4, angulo, -inclinacao + tremor * 0.5);
    protagonista.grupo.scale.setScalar((1.7 + respiro) * entrada);

    for (const item of coro) {
      const { grupo, origem, deriva, amplitude, fase } = item;
      grupo.position.set(
        origem.x + Math.sin(t * deriva.x + fase) * amplitude.x + tremor * 0.6,
        origem.y + Math.cos(t * deriva.y + fase) * amplitude.y + alturaDoPulo * 0.5,
        origem.z,
      );
      // O coro acompanha: também vira de costas enquanto a senha é digitada.
      const giroDoCoro =
        momento === 'senha' ? Math.PI : Math.sin(t * item.balanco * 0.5 + fase) * 0.5;
      grupo.rotation.y += (giroDoCoro - grupo.rotation.y) * 0.04;
      grupo.rotation.z = Math.cos(t * item.balanco * 0.35 + fase) * 0.14;

      const avanco = Math.min(1, Math.max(0, (t - item.atraso) / 0.9));
      grupo.scale.setScalar(item.escala * passandoDoPonto(avanco));
    }

    poeira.pontos.rotation.z = t * 0.01;

    camera.position.x += (ponteiro.x * 0.55 - camera.position.x) * 0.02;
    camera.position.y += (-ponteiro.y * 0.35 - camera.position.y) * 0.02;
    camera.lookAt(ancora.x * 0.45, 0, 0);

    renderer.render(cena, camera);
  });

  return {
    definirMomento(proximo) {
      if (proximo === momento) return;
      momento = proximo;
      inicioDoMomento = relogio.getElapsed();

      // Erro e sucesso falam pelo vocabulário da própria prancha: o card vira
      // e volta mostrando "Não" ou "Sim".
      if (proximo === 'erro') faceForcada = { textura: faceNao, material: materialNao };
      if (proximo === 'sucesso') faceForcada = { textura: faceSim, material: materialSim };
    },
    encerrar() {
      renderer.setAnimationLoop(null);
      observador.disconnect();
      relogio.disconnect();
      window.removeEventListener('pointermove', aoMoverPonteiro);
      for (const item of descartaveis) item.dispose();
      renderer.dispose();
    },
  };
}

/** Retângulo de cantos arredondados, o mesmo desenho do card na prancha. */
function formaArredondada(largura: number, altura: number, raio: number): THREE.Shape {
  const forma = new THREE.Shape();
  const x = -largura / 2;
  const y = -altura / 2;

  forma.moveTo(x + raio, y);
  forma.lineTo(x + largura - raio, y);
  forma.quadraticCurveTo(x + largura, y, x + largura, y + raio);
  forma.lineTo(x + largura, y + altura - raio);
  forma.quadraticCurveTo(x + largura, y + altura, x + largura - raio, y + altura);
  forma.lineTo(x + raio, y + altura);
  forma.quadraticCurveTo(x, y + altura, x, y + altura - raio);
  forma.lineTo(x, y + raio);
  forma.quadraticCurveTo(x, y, x + raio, y);

  return forma;
}

function extrudar(forma: THREE.Shape, profundidade: number): THREE.ExtrudeGeometry {
  const geometria = new THREE.ExtrudeGeometry(forma, {
    depth: profundidade,
    curveSegments: 10,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 3,
  });
  // O extrude nasce com a face de trás no z=0; centralizar deixa o card girar
  // em torno de si mesmo, e não em torno da própria quina.
  geometria.center();
  return geometria;
}

/**
 * Desenha o emoji num canvas e devolve como textura. `null` quando o navegador
 * não entrega contexto 2D — aí o card fica só com borda e miolo, que continua
 * sendo um card.
 */
function texturaDeEmoji(emoji: string, lado = 256): THREE.CanvasTexture | null {
  // O protagonista pede 256 — ocupa boa parte da tela e em 128 o emoji
  // aparecia serrilhado. Os cards do coro são pequenos e se contentam com 128,
  // o que importa quando são mais de dez deles na memória de vídeo.
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;

  const contexto = canvas.getContext('2d');
  if (!contexto) return null;

  contexto.font = `${lado * 0.74}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  contexto.textAlign = 'center';
  contexto.textBaseline = 'middle';
  contexto.fillText(emoji, lado / 2, lado * 0.54);

  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 4;
  return textura;
}

/** Poeira colorida ao fundo: enche o vazio entre os cards sem pedir atenção. */
function criarPoeira(palavras: Palavra[], quantidade: number) {
  const posicoes = new Float32Array(quantidade * 3);
  const cores = new Float32Array(quantidade * 3);
  const cor = new THREE.Color();

  for (let i = 0; i < quantidade; i += 1) {
    posicoes[i * 3] = (Math.random() - 0.5) * 20;
    posicoes[i * 3 + 1] = (Math.random() - 0.5) * 14;
    posicoes[i * 3 + 2] = -3 - Math.random() * 10;

    cor.set(palavras[i % palavras.length].cor);
    cores[i * 3] = cor.r;
    cores[i * 3 + 1] = cor.g;
    cores[i * 3 + 2] = cor.b;
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(posicoes, 3));
  geometria.setAttribute('color', new THREE.BufferAttribute(cores, 3));

  const textura = texturaDePonto();
  const material = new THREE.PointsMaterial({
    size: 0.42,
    map: textura ?? undefined,
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    // Sem escrever no buffer de profundidade os pontos não recortam uns aos
    // outros em quadrados — o que denunciaria o sprite.
    depthWrite: false,
    sizeAttenuation: true,
  });

  return { pontos: new THREE.Points(geometria, material), geometria, material, textura };
}

function texturaDePonto(): THREE.CanvasTexture | null {
  const lado = 64;
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;

  const contexto = canvas.getContext('2d');
  if (!contexto) return null;

  const gradiente = contexto.createRadialGradient(
    lado / 2,
    lado / 2,
    0,
    lado / 2,
    lado / 2,
    lado / 2,
  );
  gradiente.addColorStop(0, 'rgba(255,255,255,1)');
  gradiente.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  gradiente.addColorStop(1, 'rgba(255,255,255,0)');

  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, lado, lado);

  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** Mantém o ângulo em (-π, π] para o giro sempre pegar o caminho mais curto. */
function normalizarAngulo(angulo: number): number {
  return Math.atan2(Math.sin(angulo), Math.cos(angulo));
}

function aproximarAngulo(atual: number, alvo: number, passo: number): number {
  const diferenca = normalizarAngulo(alvo - atual);
  return normalizarAngulo(atual + diferenca * Math.min(1, passo));
}

/** Acelera e desacelera nas pontas — o `easeInOutCubic`. */
function suavizarNasPontas(avanco: number): number {
  return avanco < 0.5
    ? 4 * avanco * avanco * avanco
    : 1 - Math.pow(-2 * avanco + 2, 3) / 2;
}

/** Mola que passa do ponto e volta — o `easeOutBack` clássico. */
function passandoDoPonto(avanco: number): number {
  const c = 1.7;
  const p = avanco - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
}
