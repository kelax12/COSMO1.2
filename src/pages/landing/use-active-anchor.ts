import { useEffect, useState } from 'react';

/** Position verticale d'une section, relative au viewport. */
export interface SectionBox {
  id: string;
  top: number;
  bottom: number;
}

/**
 * Section « en cours de lecture » : la DERNIÈRE dont le haut a franchi la ligne
 * de lecture et dont le bas ne l'a pas encore franchie.
 *
 * La dernière, pas la première : deux sections consécutives peuvent se
 * chevaucher d'un pixel, et c'est la suivante que le visiteur lit. Entre deux
 * sections (un marquee, un bloc sans ancre), aucune n'est active : le sommaire
 * ne doit pas désigner une section qu'on ne voit plus.
 *
 * Pure, pour être testée sans navigateur.
 */
export function pickActiveAnchor(boxes: SectionBox[], line: number): string | null {
  let active: string | null = null;
  for (const box of boxes) {
    if (box.top <= line && box.bottom > line) active = box.id;
  }
  return active;
}

/**
 * Suivi de section du sommaire de la landing.
 *
 * Mesure par `getBoundingClientRect` au scroll (une fois par frame), et non par
 * `IntersectionObserver` : le parcours entreprise épingle des sections par
 * ScrollTrigger, et une section épinglée reste « intersectée » pendant tout son
 * pin, ce qui rendait deux sections actives à la fois. Relire la position vraie
 * ne connaît pas ce cas.
 *
 * @param ids   identifiants des sections, sans `#`
 * @param line  ligne de lecture en px depuis le haut du viewport (sous le header)
 */
export function useActiveAnchor(ids: string[], line: number): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');

  useEffect(() => {
    const list = key ? key.split('|') : [];
    let frame = 0;

    const measure = () => {
      frame = 0;
      const boxes: SectionBox[] = [];
      for (const id of list) {
        const el = document.getElementById(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        boxes.push({ id, top: r.top, bottom: r.bottom });
      }
      setActive(pickActiveAnchor(boxes, line));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key, line]);

  return active;
}
