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
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, useGSAP);

export { gsap, ScrollTrigger, SplitText, useGSAP };
