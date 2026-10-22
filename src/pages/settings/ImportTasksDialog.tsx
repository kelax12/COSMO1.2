// ═══════════════════════════════════════════════════════════════════
// Fenêtre d'import : Todoist, TickTick, Notion ou tout CSV (point 44 de la
// liste du 2026-10-08, promis à l'écran par « bientôt disponible » depuis
// des semaines).
//
// Étapes : fichiers → colonnes (CSV quelconque seulement) → aperçu → import
// → fin, avec « Annuler l'import ». Rien n'est écrit avant « Importer ».
// Feuille du bas sur mobile, dialogue sur desktop (`BottomSheet`, donc focus
// piégé et rendu par `useModalA11y`). Pendant
// l'import, la fenêtre refuse de se fermer, Échap compris : une fermeture en
// plein vol laisserait un import à moitié fait sans bouton pour l'annuler.
// ═══════════════════════════════════════════════════════════════════
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileUp, Loader2 } from 'lucide-react';
import { BottomSheet } from '@/components/mobile';
import { useT } from '@/i18n/useT';
import ImportColumnMapping from './ImportColumnMapping';
import { useTaskImport } from './use-task-import';

const btnPrimary = 'min-h-11 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40';
const btnGhost = 'min-h-11 px-4 rounded-xl text-sm font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]';
const muted = 'text-xs text-[rgb(var(--color-text-muted))]';

const ImportTasksDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t, tp } = useT('settings');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const imp = useTaskImport();
  const busy = imp.step === 'running' || imp.undo.state === 'running';

  const close = () => { if (busy) return; imp.reset(); onClose(); };
  const genericFiles = imp.files.filter((f) => f.source === 'generic');
  const mappingReady = genericFiles.every((f) => f.mapping.title !== undefined);

  return (
    <BottomSheet open={open} onClose={close} ariaLabel={t('import.title')} className="sm:max-w-lg">
      <div className="px-5 pt-3 pb-5 overflow-y-auto space-y-4">
        <h2 className="text-base font-semibold text-[rgb(var(--color-text-primary))]">{t('import.title')}</h2>

        {imp.step === 'files' && (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); void imp.addFiles(e.dataTransfer.files); }}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center ${dragging ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/5' : 'border-[rgb(var(--color-border))]'}`}
            >
              <FileUp size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
              <button type="button" onClick={() => inputRef.current?.click()} className={btnPrimary}>{t('import.pick')}</button>
              <span className={muted}>{t('import.drop')}</span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => { if (e.target.files) void imp.addFiles(e.target.files); e.target.value = ''; }}
              />
            </div>
            <ul className={`${muted} space-y-1`}>
              <li>{t('import.howToTodoist')}</li>
              <li>{t('import.howToTickTick')}</li>
              <li>{t('import.howToNotion')}</li>
            </ul>
          </>
        )}

        {imp.errors.length > 0 && (
          <ul role="alert" className="text-xs text-red-500 space-y-1">
            {imp.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}

        {imp.step === 'mapping' && (
          <>
            {genericFiles.map((f) => (
              <ImportColumnMapping key={f.name} fileName={f.name} rows={f.rows} mapping={f.mapping} onChange={(m) => imp.setMapping(f.name, m)} />
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={imp.reset} className={btnGhost}>{t('import.back')}</button>
              <button type="button" disabled={!mappingReady} onClick={() => imp.setStep('preview')} className={btnPrimary}>{t('import.next')}</button>
            </div>
          </>
        )}

        {imp.step === 'preview' && (
          <>
            <ul className={`${muted} space-y-0.5`}>
              {imp.parsed.map((p) => (
                <li key={p.fileName}>{tp('import.fileLine', p.tasks.length, { name: p.fileName, format: t(`import.format.${p.source}`) })}</li>
              ))}
            </ul>
            {imp.plan.tasks.length === 0 ? (
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('import.empty')}</p>
            ) : (
              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{tp('import.summary', imp.plan.tasks.length)}</p>
            )}
            {imp.plan.categoriesToCreate.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))]">{t('import.newCategories', { count: imp.plan.categoriesToCreate.length })}</p>
                <ul className={`${muted} max-h-32 overflow-y-auto mt-1 space-y-0.5`}>
                  {imp.plan.categoriesToCreate.map((path) => <li key={path.join('/')}>{path.join(' › ')}</li>)}
                </ul>
              </div>
            ) : imp.plan.tasks.length > 0 && <p className={muted}>{t('import.noNewCategories')}</p>}
            {imp.plan.skipped.length > 0 && (
              <details>
                <summary className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] cursor-pointer">{t('import.skippedTitle', { count: imp.plan.skipped.length })}</summary>
                <ul className={`${muted} max-h-32 overflow-y-auto mt-1 space-y-0.5`}>
                  {imp.plan.skipped.map((s) => (
                    <li key={`${s.fileName}-${s.line}`}>{t('import.skippedLine', { file: s.fileName, line: s.line, reason: t(`import.skipped.${s.reason}`) })}</li>
                  ))}
                </ul>
              </details>
            )}
            {imp.completedAvailable > 0 && (
              <label className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-secondary))] min-h-11">
                <input type="checkbox" checked={imp.includeCompleted} onChange={(e) => imp.setIncludeCompleted(e.target.checked)} className="w-4 h-4" />
                {t('import.includeCompleted', { count: imp.completedAvailable })}
              </label>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={imp.reset} className={btnGhost}>{t('import.back')}</button>
              <button type="button" disabled={imp.plan.tasks.length === 0} onClick={() => void imp.start()} className={btnPrimary}>
                {tp('import.start', imp.plan.tasks.length)}
              </button>
            </div>
          </>
        )}

        {imp.step === 'running' && (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm text-[rgb(var(--color-text-primary))]">{t('import.running', { done: imp.progress.done, total: imp.progress.total })}</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={imp.progress.total}
              aria-valuenow={imp.progress.done}
              className="h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden"
            >
              <div className="h-full bg-[rgb(var(--color-accent-solid))] transition-all" style={{ width: `${imp.progress.total ? Math.round((imp.progress.done / imp.progress.total) * 100) : 0}%` }} />
            </div>
            <p className={muted}>{t('import.runningHint')}</p>
          </div>
        )}

        {imp.step === 'done' && imp.result && (
          <div className="space-y-3" aria-live="polite">
            {imp.undo.state === 'done' ? (
              <p className="text-sm text-[rgb(var(--color-text-primary))]">
                {t('import.undone')}{imp.undo.failed > 0 && ` ${t('import.undoPartial', { count: imp.undo.failed })}`}
              </p>
            ) : (
              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{tp('import.done', imp.result.createdTaskIds.length)}</p>
            )}
            {imp.result.failures.length > 0 && imp.undo.state !== 'done' && (
              <div>
                <p className="text-xs font-semibold text-red-500">{t('import.failuresTitle', { count: imp.result.failures.length })}</p>
                <ul className={`${muted} max-h-32 overflow-y-auto mt-1 space-y-0.5`}>
                  {imp.result.failures.map((f) => <li key={`${f.line}-${f.name}`}>{t('import.failureLine', { line: f.line, name: f.name, message: f.message })}</li>)}
                </ul>
              </div>
            )}
            {imp.result.failedCategories.length > 0 && imp.undo.state !== 'done' && <p className={muted}>{t('import.categoriesFailed')}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              {imp.undo.state !== 'done' && (
                <button type="button" disabled={busy} onClick={() => void imp.undoAll()} className={`${btnGhost} inline-flex items-center gap-2`}>
                  {imp.undo.state === 'running' && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  {imp.undo.state === 'running' ? t('import.undoing') : t('import.undo')}
                </button>
              )}
              <button type="button" disabled={busy} onClick={() => { close(); navigate('/tasks'); }} className={btnPrimary}>{t('import.seeTasks')}</button>
            </div>
          </div>
        )}

        {imp.step !== 'running' && imp.step !== 'done' && (
          <div className="flex justify-end">
            <button type="button" onClick={close} className={btnGhost}>{t('import.close')}</button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};

export default ImportTasksDialog;
