import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

export interface Celebracao {
  encerrar: () => void;
}

/**
 * Cena de "ficha salva" — troféu e balões, um instante só.
 *
 * É reconhecimento pelo registro em si (o voluntário preencheu a ficha), não
 * uma nota da criança: a ficha não tem escore nem evolução (ver
 * `dados/frequencia.ts`), e esta cena não pode virar um placar por trás.
 *
 * Modelos prontos (`public/models/`) em vez de geometria própria — ao
 * contrário do painel de login, aqui não há vocabulário da prancha que sirva
 * de reação, então um mascote emprestado faz sentido pontualmente.
 */
export async function criarCelebracao(canvas: HTMLCanvasElement): Promise<Celebracao> {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.4, 9);
  camera.lookAt(0, 0.4, 0);

  cena.add(new THREE.AmbientLight('#ffffff', 1.4));
  const principal = new THREE.DirectionalLight('#fff6e8', 2.2);
  principal.position.set(4, 6, 7);
  cena.add(principal);
  const preenchimento = new THREE.DirectionalLight('#a8c8ff', 1);
  preenchimento.position.set(-6, 1, 4);
  cena.add(preenchimento);

  const carregador = new GLTFLoader();
  const carregar = (url: string) => carregador.loadAsync(url).then((gltf) => gltf.scene);

  const [trofeu, baloes] = await Promise.all([
    carregar('/models/trofeu.glb'),
    carregar('/models/baloes.glb'),
  ]);

  // Cada modelo baixado vem numa escala e num centro próprios (metros,
  // centímetros, origem no canto…). Normalizar pela altura real, em vez de um
  // fator de escala chutado, é o que evita o balão gigante ou o troféu
  // minúsculo dependendo de qual arquivo a pessoa baixou.
  normalizarTamanho(trofeu, 3.2);
  trofeu.position.set(0, 3.5, 0);
  cena.add(trofeu);

  normalizarTamanho(baloes, 2.4);
  baloes.position.set(0, -5, -1.5);
  cena.add(baloes);

  const ajustarTamanho = () => {
    const largura = canvas.clientWidth || 1;
    const altura = canvas.clientHeight || 1;
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    camera.updateProjectionMatrix();
  };
  ajustarTamanho();
  const observador = new ResizeObserver(ajustarTamanho);
  observador.observe(canvas);

  let rodando = true;
  renderer.setAnimationLoop(() => {
    if (rodando) renderer.render(cena, camera);
  });

  // Balões sobem primeiro e ficam balançando; o troféu cai por cima logo
  // depois, com um salto de mola ao pousar — a ordem importa para o olho ler
  // "a festa chegou, e o prêmio é o final".
  const tempo = gsap.timeline();
  tempo
    .to(baloes.position, { y: 0.6, duration: 1.4, ease: 'power2.out' }, 0)
    .to(baloes.rotation, { y: 0.25, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 }, 0.4)
    .to(trofeu.position, { y: 0, duration: 0.9, ease: 'bounce.out' }, 0.5)
    .to(trofeu.rotation, { y: Math.PI * 2, duration: 1.6, ease: 'power1.out' }, 0.8);

  return {
    encerrar() {
      rodando = false;
      renderer.setAnimationLoop(null);
      observador.disconnect();
      tempo.kill();
      cena.traverse((objeto) => {
        if (objeto instanceof THREE.Mesh) {
          objeto.geometry.dispose();
          const materiais = Array.isArray(objeto.material) ? objeto.material : [objeto.material];
          materiais.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
    },
  };
}

/** Centraliza a origem no meio do modelo e escala para a altura pedida. */
function normalizarTamanho(objeto: THREE.Object3D, alturaAlvo: number): void {
  const caixa = new THREE.Box3().setFromObject(objeto);
  objeto.position.sub(caixa.getCenter(new THREE.Vector3()));

  const altura = caixa.getSize(new THREE.Vector3()).y || 1;
  objeto.scale.setScalar(alturaAlvo / altura);
}
