import { useEffect, useState, type FormEvent } from 'react';
import { CATEGORIES, createLabel, ISLRTC_DICTIONARY_URL, updateLabel, type LabelInput } from '../../services/vocabularyService';
import type { SignLabel } from '../../types';
import { Button, Field, inputClass, Modal } from './ui';

const EMPTY: LabelInput = { english: '', hindi: '', category: 'other', referenceUrl: '', notes: '' };

/** Create or edit a sign label. */
export function LabelFormModal({ open, label, onClose, onSaved }: { open: boolean; label?: SignLabel | null; onClose: () => void; onSaved: (label: SignLabel) => void }) {
  const [form, setForm] = useState<LabelInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(label ? { english: label.english, hindi: label.hindi, category: label.category, referenceUrl: label.referenceUrl ?? '', notes: label.notes ?? '' } : EMPTY);
  }, [open, label]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = label ? await updateLabel(label.id, form) : await createLabel(form);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={label ? `Edit "${label.english}"` : 'New sign label'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => submit()} loading={saving}>{label ? 'Save changes' : 'Create label'}</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="English word">
            <input className={inputClass} value={form.english} onChange={(e) => setForm({ ...form, english: e.target.value })} placeholder="e.g. Thank you" autoFocus required />
          </Field>
          <Field label="Hindi translation">
            <input className={inputClass} value={form.hindi} onChange={(e) => setForm({ ...form, hindi: e.target.value })} placeholder="e.g. धन्यवाद" lang="hi" />
          </Field>
        </div>
        <Field label="Category" hint={form.category === 'background' ? 'Background = resting / non-sign hand movement. Helps the model say "no sign" instead of guessing; never spoken.' : undefined}>
          <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as LabelInput['category'] })}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Reference link (optional)" hint={<>Link the official source you learned the sign from, e.g. the <a className="text-cyan-400 underline" href={ISLRTC_DICTIONARY_URL} target="_blank" rel="noreferrer">ISLRTC dictionary</a>.</>}>
          <input className={inputClass} value={form.referenceUrl} onChange={(e) => setForm({ ...form, referenceUrl: e.target.value })} placeholder="https://…" type="url" />
        </Field>
        <Field label="Notes (optional)">
          <textarea className={inputClass} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Handshape, movement, regional variant…" />
        </Field>
        {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
