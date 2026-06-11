'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRegistrations } from '../hooks';
import { useAuth, usePermissions, CAPABILITIES } from '@/core/auth';
import { Search, Filter, User, Trash2, Edit2, Award, Calendar } from 'lucide-react';
import { Button, Badge, ListPage } from '@/shared';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export function ParticipantList() {
  const router = useRouter();
  const { user } = useAuth();
  const { can } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 10;
  const isAdmin = can(CAPABILITIES.CROSS_ORG_ADMIN);
  const organization_id = isAdmin ? undefined : (user?.org_id || undefined);
  const t = useTranslations('registration.list');
  const tCommon = useTranslations('common');

  const { data: registrationsResponse, isLoading, error, deleteRegistration, isDeleting } = useRegistrations({
    search: searchTerm || undefined, organization_id, skip: currentPage * PAGE_SIZE, limit: PAGE_SIZE,
  });

  const registrations = registrationsResponse?.data || [];
  const totalCount = registrationsResponse?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleDelete = (id: number) => { if (window.confirm(t('deleteConfirm'))) deleteRegistration(id); };
  const openDetail = (id: number, role: string) => router.push(`/registrations/${id}?role=${role}`);

  return (
    <ListPage
      title={t('title')}
      icon={User}
      error={error}
      errorTitle={t('failedToLoad')}
      isLoading={isLoading}
      data={registrations}
      onRowClick={(row) => openDetail(row.id, row.role)}
      emptyMessage={t('noParticipants')}
      pagination={{
        page: currentPage + 1,
        totalPages,
        totalCount,
        pageSize: PAGE_SIZE,
        onPageChange: (p) => setCurrentPage(p - 1),
      }}
      columns={[
        {
          header: t('columns.participant'),
          accessor: (p) => (
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center overflow-hidden shrink-0">
                {p.photo_url ? (
                  <Image src={p.photo_url} alt="" fill sizes="40px" unoptimized className="object-cover" />
                ) : (
                  <User className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-heading truncate">
                  {p.kh_family_name} {p.kh_given_name}
                </p>
                <p className="text-xs text-muted-text uppercase truncate">
                  {p.en_family_name} {p.en_given_name}
                </p>
              </div>
            </div>
          ),
          mobileLabel: t('columns.participant'),
        },
        {
          header: t('columns.eventSport'),
          accessor: (p) => (
            <div className="min-w-0">
              <p className="text-sm font-medium text-heading truncate">{p.sport_name || '\u2014'}</p>
              <p className="text-xs text-muted-text truncate flex items-center gap-1">
                <Calendar className="w-3 h-3 shrink-0" />
                {p.event_name || '\u2014'}
              </p>
            </div>
          ),
          mobileLabel: t('columns.eventSport'),
        },
        {
          header: t('columns.role'),
          accessor: (p) => (
            <div>
              <Badge variant={p.role === 'athlete' ? 'primary' : 'warning'} size="sm">
                <Award className="w-3 h-3" />
                {p.role}
              </Badge>
              {p.leader_role && (
                <p className="text-[10px] text-muted-text mt-0.5">{p.leader_role}</p>
              )}
            </div>
          ),
          mobileLabel: t('columns.role'),
        },
        {
          header: t('columns.registered'),
          accessor: (p) => (
            <span className="text-sm text-muted-text">
              {p.created_at ? new Date(p.created_at).toLocaleDateString() : '\u2014'}
            </span>
          ),
          hideOnMobile: true,
        },
        {
          header: tCommon('actions'),
          align: 'right',
          accessor: (p) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost" size="icon-sm"
                onClick={(e) => { e.stopPropagation(); openDetail(p.id, p.role); }}
                className="text-muted-text hover:text-primary"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost" size="icon-sm"
                onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                disabled={isDeleting}
                className="text-muted-text hover:text-danger"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ),
          mobileLabel: tCommon('actions'),
        },
      ]}
    >
      <div className="flex flex-col sm:flex-row gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-text" />
          <input
            type="text"
            placeholder={t('searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(0); }}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-body placeholder-muted-text focus:ring-1 focus:ring-primary focus:border-primary transition-all outline-none"
          />
        </div>
        <Button variant="outline" className="gap-2 shrink-0">
          <Filter className="w-4 h-4" />
          {tCommon('filters')}
        </Button>
      </div>
    </ListPage>
  );
}
