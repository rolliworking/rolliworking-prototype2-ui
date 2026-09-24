import clsx from 'clsx';
import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react';

export const Table = ({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) => (
  <div className={clsx('overflow-x-auto', className)}>
    <table data-testid={testId} className="w-full border-collapse text-[13px]">
      {children}
    </table>
  </div>
);

export const Th = ({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    {...rest}
    className={clsx(
      'sticky top-0 z-[1] whitespace-nowrap border-b border-line bg-surface px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500',
      className,
    )}
  >
    {children}
  </th>
);

export const Td = ({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...rest} className={clsx('border-b border-line/70 px-3 py-2 align-middle text-ink-700', className)}>
    {children}
  </td>
);

export const EmptyRow = ({ colSpan, text }: { colSpan: number; text: string }) => (
  <tr>
    <td colSpan={colSpan} className="px-3 py-8 text-center text-ink-400">
      {text}
    </td>
  </tr>
);
