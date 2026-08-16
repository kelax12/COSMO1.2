import { ScrollTrigger } from '@/lib/gsap';

/**
 * Met en pause un lot de tweens infinis tant que leur zone est hors écran.
 *
 * Les boucles décoratives de la landing (halos floutés, orbes, traceurs) sont
 * des tweens `repeat: -1` : sans ce garde-fou, elles continuent de faire
 * travailler le GPU sur des pixels que personne ne regarde. Un halo en
 * `blur(60px)` qui tourne en fond de page coûte cher pour rien.
 *
 * Le `ScrollTrigger` créé est nettoyé par le contexte `useGSAP` appelant.
 */
export const pauseWhenOffscreen = (trigger: Element, loops: gsap.core.Tween[]) => {
  const st = ScrollTrigger.create({
    trigger,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => loops.forEach((tween) => (self.isActive ? tween.play() : tween.pause())),
  });
  if (!st.isActive) loops.forEach((tween) => tween.pause());
};
