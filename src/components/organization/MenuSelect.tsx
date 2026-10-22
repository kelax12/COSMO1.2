import { Children, Fragment, isValidElement, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** Ce que les appelants lisent d'un évènement de `<select>` : la valeur, rien d'autre. */
export interface MenuSelectChange {
  target: { value: string };
  currentTarget: { value: string };
}

interface MenuSelectProps {
  value?: string | number | readonly string[] | null;
  onChange?: (e: MenuSelectChange) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  required?: boolean;
  title?: string;
  style?: CSSProperties;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

interface ParsedOption { kind: 'option'; value: string; label: ReactNode; disabled: boolean }
interface ParsedGroup { kind: 'group'; label: ReactNode; options: ParsedOption[] }
type Parsed = ParsedOption | ParsedGroup;

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean; hidden?: boolean; label?: ReactNode };

function parseOptions(children: ReactNode): Parsed[] {
  const out: Parsed[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<OptionProps>;
    if (el.type === Fragment) { out.push(...parseOptions(el.props.children)); return; }
    if (el.type === 'optgroup') {
      const options = parseOptions(el.props.children).filter((o): o is ParsedOption => o.kind === 'option');
      out.push({ kind: 'group', label: el.props.label, options });
      return;
    }
    if (el.type === 'option' && !el.props.hidden) {
      const label = el.props.children;
      out.push({
        kind: 'option',
        value: String(el.props.value ?? (typeof label === 'string' ? label : '')),
        label,
        disabled: !!el.props.disabled,
      });
    }
  });
  return out;
}

/**
 * Remplaçant du `<select>` natif pour le mode entreprise : même contrat
 * (`value`, `onChange(e) → e.target.value`, `<option>`/`<optgroup>` en enfants),
 * mais la liste s'ouvre dans le menu COSMO (celui d'« Attribuer à quelqu'un »,
 * ou des statuts) au lieu de la liste système.
 */
const MenuSelect = ({
  value, onChange, children, className, disabled, id, title, style, 'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy,
}: MenuSelectProps) => {
  const parsed = parseOptions(children);
  const flat = parsed.flatMap((p) => (p.kind === 'group' ? p.options : [p]));
  const current = value == null ? '' : String(value);
  const selected = flat.find((o) => o.value === current) ?? flat[0];
  const pick = (v: string) => onChange?.({ target: { value: v }, currentTarget: { value: v } });

  const item = (o: ParsedOption) => (
    <DropdownMenuItem
      key={o.value}
      disabled={o.disabled}
      onSelect={() => pick(o.value)}
      className={`rounded-lg px-2.5 py-2 text-sm cursor-pointer ${o.value === selected?.value ? 'font-semibold' : ''}`}
    >
      <span className="flex-1 truncate">{o.label}</span>
      {o.value === selected?.value && <Check className="size-4 text-[rgb(var(--color-accent))]" aria-hidden="true" />}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          title={title}
          style={style}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-describedby={ariaDescribedBy}
          className={`inline-flex items-center justify-between gap-2 text-left disabled:opacity-60 disabled:cursor-not-allowed ${className ?? ''}`}
        >
          <span className="truncate">{selected?.label}</span>
          <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      {/* z-[10000] : les modales entreprise maison (ProjectEditDialog…) sont en
          z-[9999] ; au z-50 par défaut, le menu s'ouvrait DERRIÈRE elles. */}
      <DropdownMenuContent
        align="start"
        className="z-[10000] min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-72 rounded-xl p-1.5 shadow-lg"
      >
        {parsed.map((p, i) =>
          p.kind === 'group' ? (
            <Fragment key={`g${i}`}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="px-2.5 text-xs text-[rgb(var(--color-text-muted))]">{p.label}</DropdownMenuLabel>
              {p.options.map(item)}
            </Fragment>
          ) : item(p),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MenuSelect;
