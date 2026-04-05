import React, { useState, useEffect } from 'react';
import { Plus, TrendingUp, Trash2, X, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { DatePicker } from './ui/date-picker';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

type KeyResult = {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  completed: boolean;
  estimatedTime: number;
  history?: {date: string;increment: number;}[];
};

type Objective = {
  id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  keyResults: KeyResult[];
  completed: boolean;
  estimatedTime: number;
};

type Category = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

type KeyResultForm = {
  title: string;
  targetValue: string;
  currentValue: string;
  estimatedTime: string;
};

type OKRModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  editingObjective?: Objective | null;
  onSubmit: (data: Omit<Objective, 'id'>, isEditing: boolean) => void;
};

const OKRModal: React.FC<OKRModalProps> = ({
  isOpen,
  onClose,
  categories,
  editingObjective,
  onSubmit
}) => {
  const [newObjective, setNewObjective] = useState({
    title: '',
    description: '',
    category: 'personal',
    endDate: ''
  });

  const [keyResults, setKeyResults] = useState<KeyResultForm[]>([
  { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
  { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
  { title: '', targetValue: '', currentValue: '', estimatedTime: '' }]
  );

  useEffect(() => {
    if (editingObjective) {
      setNewObjective({
        title: editingObjective.title,
        description: editingObjective.description,
        category: editingObjective.category,
        endDate: editingObjective.endDate
      });
      setKeyResults(
        editingObjective.keyResults.map((kr) => ({
          title: kr.title,
          targetValue: kr.targetValue.toString(),
          currentValue: kr.currentValue.toString(),
          estimatedTime: kr.estimatedTime.toString()
        }))
      );
    } else {
      resetForm();
    }
  }, [editingObjective, isOpen]);

  const calculateDuration = (start: string, end: string) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate.getTime() - startDate.getTime();
    if (diffTime < 0) return { text: "La date d'échéance doit être après la date de début", isError: true };

    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: "Moins d'un jour", isError: false };
    if (diffDays < 7) return { text: `${diffDays} jour${diffDays > 1 ? 's' : ''}`, isError: false };

    if (diffDays < 32) {
      const weeks = Math.floor(diffDays / 7);
      const remainingDays = diffDays % 7;
      let text = `${weeks} semaine${weeks > 1 ? 's' : ''}`;
      if (remainingDays > 0) text += ` et ${remainingDays} jour${remainingDays > 1 ? 's' : ''}`;
      return { text, isError: false };
    }

    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;
    let text = `${months} mois`;
    if (remainingDays > 0) text += ` et ${remainingDays} jour${remainingDays > 1 ? 's' : ''}`;
    return { text, isError: false };
  };

  const addKeyResult = () => {
    if (keyResults.length < 10) {
      setKeyResults([...keyResults, { title: '', targetValue: '', currentValue: '', estimatedTime: '' }]);
    }
  };

  const removeKeyResult = (index: number) => {
    if (keyResults.length > 1) {
      setKeyResults(keyResults.filter((_, i) => i !== index));
    }
  };

  const updateKeyResultField = (index: number, field: string, value: string) => {
    const updated = keyResults.map((kr, i) => i === index ? { ...kr, [field]: value } : kr);
    setKeyResults(updated);
  };

  const resetForm = () => {
    setNewObjective({
      title: '',
      description: '',
      category: 'personal',
      endDate: ''
    });
    setKeyResults([
    { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
    { title: '', targetValue: '', currentValue: '', estimatedTime: '' },
    { title: '', targetValue: '', currentValue: '', estimatedTime: '' }]
    );
  };

  const handleSubmitObjective = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newObjective.title.trim()) {
      alert("Veuillez saisir un titre pour l'objectif");
      return;
    }

    const validKeyResults = keyResults.filter(
      (kr) => kr.title.trim() && kr.targetValue && Number(kr.targetValue) > 0
    );

    if (validKeyResults.length === 0) {
      alert('Veuillez définir au moins un résultat clé valide');
      return;
    }

    const objData: Omit<Objective, 'id'> = {
      title: newObjective.title,
      description: newObjective.description,
      category: newObjective.category,
      startDate: editingObjective ? editingObjective.startDate : new Date().toISOString().split('T')[0],
      endDate: newObjective.endDate,
      completed: false,
      estimatedTime: validKeyResults.reduce((sum, kr) => sum + Number(kr.estimatedTime) * Number(kr.targetValue), 0),
      keyResults: validKeyResults.map((kr, index) => ({
        id: editingObjective ? editingObjective.keyResults[index]?.id || `${Date.now()}-${index}` : `${Date.now()}-${index}`,
        title: kr.title,
        currentValue: Number(kr.currentValue) || 0,
        targetValue: Number(kr.targetValue),
        unit: '',
        completed: Number(kr.currentValue) >= Number(kr.targetValue),
        estimatedTime: Number(kr.estimatedTime) || 30,
        history: editingObjective ? editingObjective.keyResults[index]?.history || [] : []
      }))
    };

    onSubmit(objData, !!editingObjective);
    resetForm();
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const startDate = editingObjective ? editingObjective.startDate : new Date().toISOString().split('T')[0];
  const duration = calculateDuration(startDate, newObjective.endDate);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        fullScreenMobile={true}
        className="p-0 border-0 sm:bg-transparent sm:shadow-none sm:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl 3xl:max-w-[1600px] w-full h-full md:h-auto md:min-h-[50vh] 3xl:min-h-[85vh] md:max-h-[90vh] overflow-y-auto"
      >
        <DialogTitle className="sr-only">
          {editingObjective ? "Modifier l'objectif" : 'Nouvel Objectif'}
        </DialogTitle>
        <div className="md:rounded-xl md:shadow-2xl w-full h-full transition-colors bg-white dark:bg-slate-800">
          <div className="flex justify-between items-center p-6 border-b dark:border-slate-700">
            <h2 className="text-xl font-bold">{editingObjective ? "Modifier l'objectif" : 'Nouvel Objectif'}</h2>
            <button onClick={handleClose}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmitObjective} className="p-6 space-y-8 overflow-y-auto h-[calc(100%-80px)] md:h-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200 block !whitespace-pre-line !whitespace-pre-line">Nom de l'objectif

                  </label>
                        <input
                    type="text"
                    value={newObjective.title}
                    onChange={(e) => setNewObjective({ ...newObjective, title: e.target.value })}
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 focus:border-blue-600 focus:border-2 outline-none transition-all"
                    placeholder="Ex: Sport"
                    required />

                        </div>
                        <div>
                          <label className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200 block">
                            Description
                          </label>
                          <textarea
                    value={newObjective.description}
                    onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-blue-500 focus:border-blue-600 focus:border-2 outline-none transition-all resize-none"
                    placeholder="Ex: améliorer ma santé"
                    rows={4} />

                  </div>
                </div>

              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200 block">
                    Catégorie
                  </label>
                  <select
                    value={newObjective.category}
                    onChange={(e) => setNewObjective({ ...newObjective, category: e.target.value })}
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all appearance-none">

                    {categories.map((c) =>
                    <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    )}
                  </select>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-200 block">
                      Date d'échéance
                    </label>
                    <DatePicker
                      value={newObjective.endDate}
                      onChange={(date) => setNewObjective({ ...newObjective, endDate: date })}
                      placeholder="Sélectionner une date" />

                  </div>
                </div>
                {duration &&
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-sm transition-all ${
                  duration.isError ?
                  'bg-red-50 border-red-100 text-red-600 dark:bg-red-900/20 dark:border-red-800/30 dark:text-red-400' :
                  'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800/30 dark:text-indigo-400'}`
                  }>

                    <Clock size={16} className={duration.isError ? 'text-red-500' : 'text-indigo-500'} />
                    <span>
                      {duration.isError ? '' : "Temps prévu pour l'objectif : "}
                      <strong className="font-bold">{duration.text}</strong>
                    </span>
                  </motion.div>
                }
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700 pt-8">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 relative inline-block">
                    Résultats Clés
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Définissez comment vous mesurerez votre succès
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addKeyResult}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">

                  <Plus size={18} />Ajouter un KR (Sous-objectif)

                </button>
              </div>

              <div className="space-y-3">
                {keyResults.map((kr, idx) =>
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group relative p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-wrap md:flex-nowrap gap-4 items-end transition-all hover:border-blue-300 dark:hover:border-blue-700 overflow-hidden">

                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/30 group-hover:bg-blue-500 transition-colors" />

                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                        Intitulé du résultat clé *
                      </label>
                            <input
                      type="text"
                      value={kr.title}
                      onChange={(e) => updateKeyResultField(idx, 'title', e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="Ex: Faire 30 séances haut du corps" />

                      </div>
                    <div className="w-full md:w-32">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                        Objectif
                      </label>
                      <div className="relative">
                        <input
                        type="number"
                        value={kr.targetValue}
                        onChange={(e) => updateKeyResultField(idx, 'targetValue', e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-8"
                        placeholder="100" />

                        <TrendingUp size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    <div className="w-full md:w-40">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 !whitespace-pre-line">TEMPS PAR RÉPÉTITION (MIN)

                    </label>
                      <div className="relative">
                        <input
                        type="number"
                        value={kr.estimatedTime}
                        onChange={(e) => updateKeyResultField(idx, 'estimatedTime', e.target.value)}
                        className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all pr-8"
                        placeholder="60" />

                        <Clock size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                    </div>
                    {keyResults.length > 1 &&
                  <button
                    type="button"
                    onClick={() => removeKeyResult(idx)}
                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all self-center"
                    title="Supprimer ce résultat">

                        <Trash2 size={20} className="text-red-500" />
                      </button>
                  }
                  </motion.div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 rounded-lg font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">

                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center justify-center gap-2 px-8 py-2.5 rounded-lg font-bold text-white shadow-lg shadow-blue-500/25 transform transition-all hover:scale-105 active:scale-95 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600">

                {editingObjective ? 'Mettre à jour' : "Créer l'objectif"}
              </button>
            </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
  );

};

export default OKRModal;
