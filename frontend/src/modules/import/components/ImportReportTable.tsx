'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/shared';
import type { ImportReport } from '../types';

export function ImportReportTable({ report }: { report: ImportReport }) {
  const t = useTranslations('import');

  if (report.total === 0) {
    return <p className="text-sm text-muted-foreground">{t('noRows')}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="w-16 px-4 py-2 font-medium">{t('row')}</th>
            <th className="w-28 px-4 py-2 font-medium">{t('status')}</th>
            <th className="px-4 py-2 font-medium">{t('errors')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {report.rows.map((r) => (
            <tr key={r.row} className={r.ok ? '' : 'bg-danger-bg/40'}>
              <td className="px-4 py-2 tabular-nums text-muted-foreground">{r.row}</td>
              <td className="px-4 py-2">
                {r.ok ? (
                  <Badge variant="success" size="xs" dot>
                    {t('ok')}
                  </Badge>
                ) : (
                  <Badge variant="error" size="xs" dot>
                    {t('failed')}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-2">
                {r.errors.length === 0 ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <ul className="space-y-0.5">
                    {r.errors.map((e, i) => (
                      <li key={i} className="text-danger">
                        {e.field ? <span className="font-medium">{e.field}: </span> : null}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
