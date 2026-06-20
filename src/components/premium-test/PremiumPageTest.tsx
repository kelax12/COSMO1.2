// Premium — refonte « test » riche en composants shadcn (desktop).
// Card · Badge · Table · Progress · Dialog · Avatar · Separator · Tooltip ·
// Button. Réutilise TOUTE la logique billing (isPremium, addTokens, Stripe
// checkout, AdModal) — aucune logique métier nouvelle. PremiumPage inchangée.
import { useEffect, useState } from 'react';
import { Crown, Zap, Play, Check, Minus, BarChart3, Sparkles, Loader2, ShieldCheck, Headphones } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/modules/auth/AuthContext';
import { useBilling } from '@/modules/billing/billing.context';
import { isDailyAdLimitError } from '@/modules/billing/ad-limit';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import AdModal from '@/components/AdModal';

const FEATURES = [
  { icon: Sparkles, title: 'Habitudes sans publicité', desc: 'Accède à tes habitudes sans la pub quotidienne.' },
  { icon: BarChart3, title: 'Statistiques avancées', desc: 'Analyses détaillées, heatmaps et tendances.' },
  { icon: ShieldCheck, title: 'Sans publicité', desc: 'Une expérience entièrement débarrassée des pubs.' },
  { icon: Headphones, title: 'Support prioritaire', desc: 'Tes demandes traitées en priorité.' },
];

const STEPS = [
  { icon: Play, title: 'Accumule', desc: 'Regarde des pubs ou abonne-toi pour gagner des jours Premium.' },
  { icon: Zap, title: 'Activation', desc: '1 jour Premium est consommé chaque jour pour garder le statut.' },
  { icon: Crown, title: 'Liberté', desc: 'Profite de toutes les fonctionnalités tant qu’il te reste des jours.' },
];

const COMPARISON: { label: string; free: boolean; pro: boolean }[] = [
  { label: 'Tâches illimitées', free: true, pro: true },
  { label: 'Habitudes illimitées', free: true, pro: true },
  { label: 'Agenda & événements', free: true, pro: true },
  { label: 'OKR & Key Results', free: true, pro: true },
  { label: 'Statistiques de base', free: true, pro: true },
  { label: 'Sync multi-appareils', free: true, pro: true },
  { label: 'Collaboration & partage de tâches', free: true, pro: true },
  { label: 'Habitudes sans pub quotidienne', free: false, pro: true },
  { label: 'Statistiques avancées', free: false, pro: true },
  { label: 'Sans publicité', free: false, pro: true },
  { label: 'Support prioritaire', free: false, pro: true },
];

export default function PremiumPageTest() {
  const { user } = useAuth();
  const { isPremium, addTokens, subscription, refreshBillingStatus } = useBilling();
  const [showAdModal, setShowAdModal] = useState(false);
  const [showChoice, setShowChoice] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('checkout');
    if (status === 'success') {
      toast.success('Abonnement activé ! Bienvenue chez Cosmo Premium.');
      refreshBillingStatus();
      const t = setTimeout(() => refreshBillingStatus(), 3000);
      window.history.replaceState({}, '', '/premium');
      return () => clearTimeout(t);
    }
    if (status === 'cancelled') {
      toast.info('Paiement annulé.');
      window.history.replaceState({}, '', '/premium');
    }
  }, [refreshBillingStatus]);

  if (!user) return null;
  const premium = isPremium();
  const tokens = subscription?.premiumTokens ?? 0;
  const streak = subscription?.winStreak ?? 0;

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Veuillez vous reconnecter.'); return; }
      const { data, error } = await supabase.functions.invoke('stripe-create-checkout', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.error === 'already_subscribed') {
        toast.info('Vous avez déjà un abonnement actif.');
        await refreshBillingStatus();
        return;
      }
      if (data?.url) window.location.href = data.url;
      else throw new Error('No checkout URL returned');
    } catch {
      toast.error("Erreur lors de la création du paiement. Réessayez.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleAdComplete = async () => {
    try {
      await addTokens(1);
      toast.success('+1 jour Premium crédité !');
    } catch (err) {
      if (isDailyAdLimitError(err)) toast.error('Limite quotidienne de pubs atteinte (20/jour). Revenez demain ou passez Premium.');
      else toast.error('Erreur lors du crédit du jour');
    }
    setShowAdModal(false);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      {/* En-tête */}
      <div className="mb-6 flex items-center gap-3">
        <Crown className="size-8 text-amber-500" aria-hidden="true" />
        <div>
          <div className="text-muted-foreground mb-0.5 inline-flex items-center gap-1.5 text-xs font-medium">
            <Sparkles className="size-3.5" aria-hidden="true" /> Mode test
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Cosmo Premium</h1>
        </div>
      </div>

      {/* Carte statut */}
      <Card className="mb-6 overflow-hidden">
        <CardContent className="flex flex-col items-start justify-between gap-6 py-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-2">
              {premium ? (
                <Badge className="bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950">
                  <Sparkles className="size-3" aria-hidden="true" /> Premium actif
                </Badge>
              ) : (
                <Badge variant="outline">Version gratuite</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"><Zap className="size-3.5 text-amber-500" aria-hidden="true" /> Jours Premium</div>
                <div className="mt-1 text-3xl font-bold tabular-nums">{tokens}</div>
                <Progress value={Math.min((tokens / 30) * 100, 100)} className="mt-2 h-1.5 w-32" />
              </div>
              <div>
                <div className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">🔥 Win streak</div>
                <div className="mt-1 text-3xl font-bold tabular-nums">{streak}<span className="text-muted-foreground text-base font-normal"> j</span></div>
              </div>
            </div>
          </div>
          {!premium && (
            <Button type="button" size="lg" onClick={() => setShowChoice(true)}>
              <Crown aria-hidden="true" /> Passer Premium
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Deux voies d'acquisition */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card className="border-emerald-500/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Play className="size-4 text-emerald-500" aria-hidden="true" /> Regarder une pub</CardTitle>
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">Gratuit</Badge>
            </div>
            <CardDescription>Une courte vidéo = 1 jour Premium crédité.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-baseline gap-1">
              <span className="text-emerald-500 text-3xl font-bold">+1</span>
              <span className="text-muted-foreground text-sm">jour Premium</span>
            </div>
            <Button type="button" className="w-full bg-emerald-600 text-white hover:bg-emerald-600/90" onClick={() => setShowAdModal(true)}>
              <Play aria-hidden="true" /> Regarder (+1 jour)
            </Button>
          </CardContent>
        </Card>

        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Crown className="size-4 text-amber-500" aria-hidden="true" /> Abonnement mensuel</CardTitle>
              <Badge>Populaire</Badge>
            </div>
            <CardDescription>30 jours de statut Premium complet, sans pub.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold">3,50 €</span>
              <span className="text-muted-foreground text-sm">/ mois</span>
            </div>
            <Button type="button" className="w-full" disabled={checkoutLoading} onClick={handleCheckout}>
              {checkoutLoading && <Loader2 className="animate-spin" aria-hidden="true" />}
              S'abonner maintenant
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Fonctionnalités Premium */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Fonctionnalités Premium</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="border-border flex items-start gap-3 rounded-lg border p-4">
                <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', premium ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/10 text-primary')}>
                  <Icon className="size-4.5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">{f.title}</span>
                    {premium && <Check className="size-3.5 text-emerald-500" aria-hidden="true" />}
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-sm">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Comment ça marche */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Comment ça marche ?</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="border-border relative rounded-xl border p-5 text-center">
                <Avatar className="mx-auto mb-3 size-12">
                  <AvatarFallback className="bg-primary/10 text-primary"><Icon className="size-5" aria-hidden="true" /></AvatarFallback>
                </Avatar>
                <Badge variant="outline" className="absolute right-3 top-3">{i + 1}</Badge>
                <h4 className="font-semibold">{s.title}</h4>
                <p className="text-muted-foreground mt-1 text-sm">{s.desc}</p>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Comparatif (Table shadcn) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Gratuit ou Premium ?</CardTitle>
          <CardDescription>Tout l'essentiel reste gratuit, partage de tâches inclus. Premium retire la pub et débloque les analyses avancées.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonctionnalité</TableHead>
                <TableHead className="w-28 text-center">Gratuit</TableHead>
                <TableHead className="w-28 text-center">
                  <span className="text-amber-500 inline-flex items-center gap-1"><Crown className="size-3.5" aria-hidden="true" /> Premium</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COMPARISON.map((row) => (
                <TableRow key={row.label} className={cn(!row.free && 'bg-amber-500/[0.04]')}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-center">
                    {row.free ? <Check className="mx-auto size-4 text-emerald-500" aria-hidden="true" /> : <Minus className="text-muted-foreground mx-auto size-4" aria-hidden="true" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.pro ? <Check className="mx-auto size-4 text-emerald-500" aria-hidden="true" /> : <Minus className="text-muted-foreground mx-auto size-4" aria-hidden="true" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!premium && (
            <>
              <Separator className="my-5" />
              <div className="flex justify-center">
                <Button type="button" size="lg" onClick={() => setShowChoice(true)}>
                  <Crown aria-hidden="true" /> Passer Premium
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog de choix */}
      <Dialog open={showChoice} onOpenChange={setShowChoice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comment passer Premium ?</DialogTitle>
            <DialogDescription>Deux façons d'obtenir des jours Premium.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <button
              type="button"
              onClick={() => { setShowChoice(false); setShowAdModal(true); }}
              className="border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center gap-4 rounded-xl border p-4 text-left transition-colors"
            >
              <div className="bg-emerald-500/20 flex size-11 items-center justify-center rounded-xl">
                <Play className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">Regarder une pub</p>
                <p className="text-muted-foreground text-sm">Gratuit · +1 jour Premium</p>
              </div>
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={checkoutLoading}
                  onClick={() => { setShowChoice(false); void handleCheckout(); }}
                  className="border-primary/30 bg-primary/10 hover:bg-primary/18 flex items-center gap-4 rounded-xl border p-4 text-left transition-colors disabled:opacity-70"
                >
                  <div className="bg-primary/15 flex size-11 items-center justify-center rounded-xl">
                    {checkoutLoading ? <Loader2 className="text-primary size-5 animate-spin" aria-hidden="true" /> : <Crown className="text-primary size-5" aria-hidden="true" />}
                  </div>
                  <div>
                    <p className="font-semibold">S'abonner</p>
                    <p className="text-muted-foreground text-sm">3,50 € / mois · 30 jours Premium</p>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent>Paiement sécurisé via Stripe</TooltipContent>
            </Tooltip>
          </div>
        </DialogContent>
      </Dialog>

      <AdModal isOpen={showAdModal} onClose={() => setShowAdModal(false)} onAdComplete={handleAdComplete} />
    </div>
  );
}
