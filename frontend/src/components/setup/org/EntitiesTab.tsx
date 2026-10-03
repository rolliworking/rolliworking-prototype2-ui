import { Building2, Save } from 'lucide-react';
import { useState } from 'react';
import * as org from '@/api/org';
import type { Entity, EntityInput } from '@/api/org';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Lbl, StatusDot, Toggle, field } from './OrgBits';

const EntityCard = ({ e, onSaved, onError }: { e: Entity; onSaved: (m: string) => void; onError: (m: string) => void }) => {
  const [f, setF] = useState<EntityInput>({ name: e.name, shortName: e.shortName, legalName: e.legalName, signature: e.signature, active: e.active });
  const dirty = f.name !== e.name || f.shortName !== e.shortName || f.legalName !== e.legalName || f.signature !== e.signature || f.active !== e.active;
  const save = () => org.saveEntity(e.id, f).then((n) => onSaved(`${n.name} saved — every badge, signature and division label now reads “${n.name}”`)).catch((x) => onError(x instanceof Error ? x.message : 'Failed'));
  return <Card testId={`entity-card-${e.id}`} title={<span className="inline-flex items-center gap-2"><Building2 size={14} /> {e.name} <StatusDot status={e.active ? 'active' : 'inactive'} /></span>} subtitle={`${e.kind === 'service_center' ? 'Service center' : 'Boutique'} · division key ${e.id} · ${e.updatedAt ? `edited ${new Date(e.updatedAt).toLocaleDateString()} by ${e.updatedBy}` : 'seed'}`}>
    <div className="grid grid-cols-2 gap-3">
      <Lbl>Display name<input data-testid={`entity-name-${e.id}`} value={f.name} onChange={(x) => setF({ ...f, name: x.target.value })} className={field} /></Lbl>
      <Lbl>Short (≤ 4)<input data-testid={`entity-short-${e.id}`} value={f.shortName} maxLength={4} onChange={(x) => setF({ ...f, shortName: x.target.value })} className={`${field} font-mono uppercase`} /></Lbl>
      <Lbl>Legal name<input data-testid={`entity-legal-${e.id}`} value={f.legalName} onChange={(x) => setF({ ...f, legalName: x.target.value })} className={field} /></Lbl>
      <Lbl>Email signature line<input data-testid={`entity-signature-${e.id}`} value={f.signature} onChange={(x) => setF({ ...f, signature: x.target.value })} className={field} /></Lbl>
    </div>
    <div className="mt-3 flex items-center justify-between"><Toggle on={f.active} onChange={(v) => setF({ ...f, active: v })} testId={`entity-active-${e.id}`} label="Active" /><Button variant="primary" size="sm" data-testid={`entity-save-${e.id}`} disabled={!dirty} onClick={save}><Save size={12} /> Save</Button></div>
  </Card>;
};

export const EntitiesTab = ({ onFlash }: { onFlash: (m: string, err?: boolean) => void }) => {
  const [list, setList] = useState<Entity[]>(() => org.getEntitiesSync());
  const reload = () => setList(org.getEntitiesSync());
  return <div data-testid="org-entities" className="space-y-3">
    <p className="text-xs text-ink-500">Two legal entities share one RolliSuite. The <b>division</b> key (rolliworks / rollishop) is permanent — what you can change is how each is named everywhere: top bar, sign-in, station badges, email signatures and the time clock.</p>
    <div className="grid grid-cols-2 gap-4">{list.map((e) => <EntityCard key={`${e.id}-${e.updatedAt ?? ''}`} e={e} onSaved={(m) => { reload(); onFlash(m); }} onError={(m) => onFlash(m, true)} />)}</div>
  </div>;
};
