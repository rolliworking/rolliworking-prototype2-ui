import clsx from 'clsx';
import { Paperclip } from 'lucide-react';
import * as api from '@/api/client';
import type { MessageTemplate, PackagePhoto, TemplateCategory } from '@/api/client';

export const catLabel = (c?: TemplateCategory) => api.TEMPLATE_CATEGORIES.find((x) => x.key === (c ?? 'general'))?.label ?? 'General';
export const isPlaceholder = (p: PackagePhoto) => /PLACEHOLDER/i.test(p.fileName ?? '') || /PLACEHOLDER/i.test(p.dataUrl);

// Small badges shared by the picker, Setup page and composer
export const TemplateBadges = ({ t, showDivision }: { t: MessageTemplate; showDivision: boolean }) => <span className="inline-flex flex-wrap items-center gap-1 text-[10px]">
  <span data-testid={`template-cat-${t.key}`} className="rounded-sm bg-canvas px-1.5 py-0.5 font-semibold text-ink-600">{catLabel(t.category)}</span>
  {t.channel !== 'both' && <span className={clsx('rounded-sm px-1.5 py-0.5 font-semibold', t.channel === 'portal' ? 'bg-moss-50 text-moss-800' : 'bg-sky-50 text-sky-800')}>{t.channel}</span>}
  {showDivision && <span data-testid={`template-division-${t.key}`} className={clsx('rounded-sm px-1.5 py-0.5 font-semibold uppercase', t.division === 'rollishop' ? 'bg-amber-50 text-amber-900' : t.division === 'both' ? 'bg-canvas text-ink-500' : 'bg-ink/5 text-ink-700')}>{t.division === 'both' ? 'both' : t.division === 'rollishop' ? 'RS' : 'RW'}</span>}
  {t.shared && t.division !== 'both' && <span className="rounded-sm bg-canvas px-1.5 py-0.5 text-ink-500">shared</span>}
  {t.system && <span title={`System send · ${t.usedBy ?? ''}`} className="rounded-sm bg-canvas px-1.5 py-0.5 text-ink-400">system</span>}
  {t.active === false && <span className="rounded-sm bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-700">ARCHIVED</span>}
  {t.attachments && t.attachments.length > 0 && <span className="inline-flex items-center gap-0.5 text-ink-500"><Paperclip size={10} /> {t.attachments.length}</span>}
</span>;

// Attachment thumbnails — PLACEHOLDER-labelled seeds show the tag so nobody mistakes them for real reference photos
export const AttachmentThumbs = ({ photos, testId, size = 'h-14 w-16', onRemove }: { photos: PackagePhoto[]; testId: string; size?: string; onRemove?: (i: number) => void }) => photos.length ? <div className="flex flex-wrap gap-1.5">{photos.map((p, i) => <figure key={p.id ?? i} data-testid={`${testId}-${i}`} data-placeholder={isPlaceholder(p) || undefined} className="relative">
  <img src={p.dataUrl} alt={p.note ?? p.fileName ?? ''} title={p.note ?? p.fileName} className={clsx(size, 'rounded-sm border border-line object-cover')} />
  {isPlaceholder(p) && <figcaption className="absolute inset-x-0 bottom-0 rounded-b-sm bg-ink/80 px-1 text-center text-[8px] font-bold tracking-wide text-amber-300">PLACEHOLDER</figcaption>}
  {onRemove && <button type="button" data-testid={`${testId}-remove-${i}`} onClick={() => onRemove(i)} aria-label="Remove attachment" className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ink text-[10px] text-white">×</button>}
</figure>)}</div> : null;
