/**
 * Point unique d'enregistrement GSAP — réservé à la landing page.
 *
 * ⚠️ N'importer GSAP QUE depuis ce module (`@/lib/gsap`), jamais depuis `gsap`
 * directement : garantit une registration unique des plugins et l'isolation
 * du chunk `vendor-gsap` (vite.config.ts) qui ne doit être chargé que par
 * la LandingPage (React.lazy). Le reste de l'app reste sur Framer Motion.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
// InertiaPlugin : requis par le fond `DotGrid` (src/components/reactbits/) du
// track entreprise, qui projette les points avec de l'inertie après une
// impulsion du curseur. Gratuit depuis GSAP 3.13.
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, InertiaPlugin, useGSAP);

// Debug dev uniquement : inspection des triggers depuis la console.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__ST = ScrollTrigger;
  (window as unknown as Record<string, unknown>).__gsap = gsap;
}

export { gsap, ScrollTrigger, SplitText, InertiaPlugin, useGSAP };
