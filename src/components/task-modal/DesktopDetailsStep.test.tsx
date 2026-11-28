// @vitest-environment jsdom
//
// Étape « Détails » du TaskModal desktop : ce que chaque onglet montre et ce
// que chaque geste écrit (dépliage du formulaire minimal, durée ±5, favori,
// description, listes cochées, création d'une liste au clavier et au bouton).
// Écrit AVANT le découpage de la fonction (ARCHITECTURE § 3) : il fige le
// comportement que le découpage ne doit pas changer.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react';
import DesktopDetailsStep, { type DesktopDetailsStepProps, type DetailsTab } from './DesktopDetailsStep';

vi.mock('@/i18n/useT', () => ({ useT: () => ({ t: (k: string) => k }) }));
vi.mock('./CategoryField', () => ({ default: () => <div data-testid="category-field" /> }));
vi.mock('./SubtaskChecklist', () => ({
  default: (p: { taskId?: string }) => <div data-testid={p.taskId ? 'subtasks-persisted' : 'subtasks-draft'} />,
}));
vi.mock('./TaskStateFields', () => ({ default: () => <div data-testid="state-persisted" /> }));
vi.mock('./TaskDependenciesSection', () => ({ default: () => <div data-testid="deps-persisted" /> }));
vi.mock('./CreateTaskPendingFields', () => ({
  CreateStateFields: () => <div data-testid="state-draft" />,
  CreateDependenciesField: () => <div data-testid="deps-draft" />,
}));
vi.mock('@/components/DescriptionField', () => ({
  default: (p: { id: string; value: string }) => <textarea data-testid="description" id={p.id} defaultValue={p.value} />,
}));
vi.mock('@/components/ui/date-picker', () => ({ DatePicker: () => <div data-testid="date-picker" /> }));

afterEach(cleanup);

type Form = DesktopDetailsStepProps['formData'];
const baseForm: Form = {
  name: '', description: '', priority: 0, category: '', deadline: '', estimatedTime: 0,
  completed: false, bookmarked: false, isFromOKR: false, krId: '', recurrence: 'none', subtasks: [],
};
const COLORS = [{ value: 'blue', color: '#3B82F6' }, { value: 'red', color: '#EF4444' }];
const LISTS = [
  { id: 'l1', name: 'Courses', color: 'red', taskIds: [] },
  { id: 'l2', name: 'Intelligente', color: 'blue', taskIds: [], type: 'smart' },
];

function setup(over: Partial<DesktopDetailsStepProps> & { tab?: DetailsTab; form?: Partial<Form> } = {}) {
  const spies = {
    handleInputChange: vi.fn(),
    setHasChanges: vi.fn(),
    setErrors: vi.fn(),
    setSelectedListIds: vi.fn(),
    mutate: vi.fn(),
    setShowDescription: vi.fn(),
  };
  const { form: formOver, ...props } = over;
  const formRef: { current: Form } = { current: { ...baseForm, ...formOver } };
  function Harness() {
    const [formData, setFormData] = useState<Form>(formRef.current);
    formRef.current = formData;
    return (
      <DesktopDetailsStep
        formData={formData}
        setFormData={setFormData}
        handleInputChange={spies.handleInputChange}
        errors={{}}
        setErrors={spies.setErrors}
        okrFields={{}}
        setHasChanges={spies.setHasChanges}
        dRegister={() => () => undefined}
        dClear={() => undefined}
        dInvalid={() => false}
        categories={[]}
        createCategoryMutation={{ mutate: vi.fn(), isPending: false } as unknown as DesktopDetailsStepProps['createCategoryMutation']}
        listColorOptions={COLORS}
        lists={LISTS}
        selectedListIds={[]}
        setSelectedListIds={spies.setSelectedListIds}
        createListMutation={{ mutate: spies.mutate, isPending: false } as unknown as DesktopDetailsStepProps['createListMutation']}
        isCreating
        showDescription={false}
        setShowDescription={spies.setShowDescription}
        {...props}
      />
    );
  }
  render(<Harness />);
  return { spies, form: () => formRef.current };
}

describe('DesktopDetailsStep · onglet Détails', () => {
  it('création : seul le nom, puis « plus d options » déplie les champs', () => {
    setup();
    expect(screen.queryByLabelText('fields.prioritySelect')).toBeNull();
    fireEvent.click(screen.getByText('fields.moreOptions'));
    expect(screen.getByLabelText('fields.prioritySelect')).toBeTruthy();
    expect(screen.getByTestId('date-picker')).toBeTruthy();
    expect(screen.queryByText('fields.moreOptions')).toBeNull();
  });

  it('édition : tout est déplié d emblée', () => {
    setup({ isCreating: false });
    expect(screen.getByLabelText('fields.prioritySelect')).toBeTruthy();
    expect(screen.queryByText('fields.moreOptions')).toBeNull();
  });

  it('le nom écrit par handleInputChange', () => {
    const { spies } = setup();
    fireEvent.change(screen.getByLabelText('form.nameRequired'), { target: { value: 'Acheter du pain' } });
    expect(spies.handleInputChange).toHaveBeenCalledWith('name', 'Acheter du pain');
  });

  it('durée : +5 puis -5, jamais sous zéro', () => {
    const { form } = setup({ isCreating: false });
    fireEvent.click(screen.getByLabelText('fields.increase5'));
    fireEvent.click(screen.getByLabelText('fields.increase5'));
    expect(form().estimatedTime).toBe(10);
    fireEvent.click(screen.getByLabelText('fields.decrease5'));
    fireEvent.click(screen.getByLabelText('fields.decrease5'));
    fireEvent.click(screen.getByLabelText('fields.decrease5'));
    expect(form().estimatedTime).toBe(0);
  });

  it('récurrence visible seulement avec une échéance', () => {
    setup({ isCreating: false });
    expect(screen.queryByLabelText('fields.recurrence')).toBeNull();
    cleanup();
    const { spies } = setup({ isCreating: false, form: { deadline: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('fields.recurrence'), { target: { value: 'weekly' } });
    expect(spies.handleInputChange).toHaveBeenCalledWith('recurrence', 'weekly');
  });

  it('favori et description', () => {
    const { spies } = setup({ isCreating: false });
    fireEvent.click(screen.getByLabelText('form.bookmarkAdd'));
    expect(spies.handleInputChange).toHaveBeenCalledWith('bookmarked', true);
    fireEvent.click(screen.getByText('form.addDescription'));
    expect(spies.setShowDescription).toHaveBeenCalledWith(true);
    cleanup();
    setup({ isCreating: false, showDescription: true });
    expect(screen.getByTestId('description')).toBeTruthy();
  });
});

describe('DesktopDetailsStep · onglet Avancé (listes)', () => {
  it('les listes intelligentes ne sont pas proposées ; cocher écrit la sélection', () => {
    const { spies } = setup({ tab: 'advanced' });
    expect(screen.queryByText('Intelligente')).toBeNull();
    fireEvent.click(screen.getByText('Courses'));
    expect(spies.setSelectedListIds).toHaveBeenCalledWith(['l1']);
    expect(spies.setHasChanges).toHaveBeenCalledWith(true);
  });

  it('décocher retire la liste', () => {
    const { spies } = setup({ tab: 'advanced', selectedListIds: ['l1'] });
    fireEvent.click(screen.getByText('Courses'));
    expect(spies.setSelectedListIds).toHaveBeenCalledWith([]);
  });

  it('créer une liste à Entrée : nom rogné, couleur, puis sélection et remise à zéro', () => {
    const { spies } = setup({ tab: 'advanced' });
    fireEvent.click(screen.getByText('fields.createList'));
    fireEvent.click(screen.getByTitle('actions.changeColor'));
    const input = screen.getByPlaceholderText('desktop.listNamePlaceholder');
    fireEvent.change(input, { target: { value: '  Maison  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(spies.mutate).toHaveBeenCalledWith({ name: 'Maison', color: 'red' }, expect.any(Object));
    const updater = vi.fn();
    spies.setSelectedListIds.mockImplementation(updater);
    act(() => spies.mutate.mock.calls[0][1].onSuccess({ id: 'new' }));
    expect(updater.mock.calls[0][0](['l1'])).toEqual(['l1', 'new']);
    expect(spies.setHasChanges).toHaveBeenCalledWith(true);
    expect(screen.queryByPlaceholderText('desktop.listNamePlaceholder')).toBeNull();
  });

  it('créer au bouton ; nom vide refusé ; Échap annule', () => {
    const { spies } = setup({ tab: 'advanced' });
    fireEvent.click(screen.getByText('fields.createList'));
    const input = screen.getByPlaceholderText('desktop.listNamePlaceholder');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(spies.mutate).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'Projet' } });
    fireEvent.click(screen.getByText('common.create'));
    expect(spies.mutate).toHaveBeenCalledWith({ name: 'Projet', color: 'blue' }, expect.any(Object));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('desktop.listNamePlaceholder')).toBeNull();
    fireEvent.click(screen.getByText('fields.createList'));
    expect((screen.getByPlaceholderText('desktop.listNamePlaceholder') as HTMLInputElement).value).toBe('');
  });

  it('statut : brouillon en création, persisté en édition', () => {
    setup({ tab: 'advanced' });
    expect(screen.getByTestId('state-draft')).toBeTruthy();
    cleanup();
    setup({ tab: 'advanced', isCreating: false, task: { id: 't1', subtasks: [] } as unknown as DesktopDetailsStepProps['task'] });
    expect(screen.getByTestId('state-persisted')).toBeTruthy();
  });
});

describe('DesktopDetailsStep · autres onglets', () => {
  const task = { id: 't1', subtasks: [] } as unknown as DesktopDetailsStepProps['task'];

  it('sous-tâches et dépendances : brouillon en création, persistées en édition', () => {
    setup({ tab: 'subtasks' });
    expect(screen.getByTestId('subtasks-draft')).toBeTruthy();
    cleanup();
    setup({ tab: 'subtasks', isCreating: false, task });
    expect(screen.getByTestId('subtasks-persisted')).toBeTruthy();
    cleanup();
    setup({ tab: 'dependencies' });
    expect(screen.getByTestId('deps-draft')).toBeTruthy();
    cleanup();
    setup({ tab: 'dependencies', isCreating: false, task });
    expect(screen.getByTestId('deps-persisted')).toBeTruthy();
  });

  it('partager : rien (rendu par le parent)', () => {
    setup({ tab: 'share' });
    expect(document.body.textContent).toBe('');
  });
});
