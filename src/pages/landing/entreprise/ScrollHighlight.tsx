import React, { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

interface ScrollHighlightProps {
  /** Texte pouvant contenir des segments `<hl>...</hl>` à surligner. */
  text: string;
}

/**
 * Surlignage progressif au scroll (track entreprise uniquement).
 *
 * Chaque segment `<hl>` reçoit un vrai trait de surligneur violet qui se
 * dessine de gauche à droite en 0,5 s quand il entre dans le viewport — pas
 * un simple changement de couleur. `background-size` anime la largeur du
 * dégradé posé derrière le texte ; `<mark>` garde le sens sémantique.
 *
 * Rendu en `<span>` : s'insère dans le `<p>` du parent, qui porte déjà les
 * classes de texte (héritées).
 */
const ScrollHighlight: React.FC<ScrollHighlightProps> = ({ text }) => {
  const rootRef = useRef<HTMLSpanElement>(null);
  const parts = text.split(/(<hl>.*?<\/hl>)/g);

  useGSAP(
    () => {
      const marks = gsap.utils.toArray<HTMLElement>('.scroll-highlight', rootRef.current);
      if (marks.length === 0) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        marks.forEach((mark) => {
          gsap.fromTo(
            mark,
            { backgroundSize: '0% 100%' },
            {
              backgroundSize: '100% 100%',
              duration: 0.5,
              ease: 'power2.out',
              scrollTrigger: { trigger: mark, start: 'top 85%', once: true },
            },
          );
        });
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(marks, { backgroundSize: '100% 100%' });
      });
    },
    { scope: rootRef, dependencies: [text] },
  );

  return (
    <span ref={rootRef}>
      {parts.map((part, index) => {
        const match = part.match(/^<hl>(.*)<\/hl>$/);
        if (!match) return <React.Fragment key={index}>{part}</React.Fragment>;
        return (
          <mark
            key={index}
            className="scroll-highlight rounded-[0.2em] bg-no-repeat px-0.5 text-white"
            style={{
              backgroundColor: 'transparent',
              backgroundImage: 'linear-gradient(120deg, rgba(168,85,247,0.55), rgba(168,85,247,0.55))',
              backgroundPosition: '0 88%',
              backgroundSize: '0% 100%',
            }}
          >
            {match[1]}
          </mark>
        );
      })}
    </span>
  );
};

export default ScrollHighlight;
