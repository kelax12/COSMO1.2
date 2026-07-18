// Types du registre use-cases (use-cases.mjs est en JS pur pour rester
// importable par prerender.mjs sous Node).
export interface UseCase {
  slug: string;
  audience: string;
  title: string;
  metaTitle: string;
  description: string;
  lead: string;
  html: string;
}

export declare const USE_CASES: UseCase[];
export declare const getUseCase: (slug: string) => UseCase | undefined;
