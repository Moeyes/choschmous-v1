"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, List } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/shared";
import { useTeams, useCreateTeam } from "../hooks/useTeams";
import type { TeamItem } from "../types/team";
import { useAuth, UserRole } from "@/core/auth";

interface TeamCreateOrPickStepProps {
    eventId: number;
    sportId: number;
    orgId: number;
    categoryId?: number | null;
    value: TeamItem | null;
    onChange: (team: TeamItem | null) => void;
}

export function TeamCreateOrPickStep({
    eventId,
    sportId,
    orgId,
    categoryId,
    value,
    onChange,
}: TeamCreateOrPickStepProps) {
    const t = useTranslations("registration");
    const tCommon = useTranslations("common");
    const { user } = useAuth();
    const effectiveOrgId =
        user?.role === UserRole.ORGANIZATION && user?.org_id
            ? Number(user.org_id)
            : orgId;

    const { data: teamsData, isLoading } = useTeams(eventId, effectiveOrgId);
    const createTeam = useCreateTeam();
    const [showCreate, setShowCreate] = useState(false);
    const [teamName, setTeamName] = useState("");

    const teams = teamsData?.data ?? [];

    const handleCreate = async () => {
        if (!teamName.trim()) return;
        const result = await createTeam.mutateAsync({
            event_id: eventId,
            sport_id: sportId,
            org_id: effectiveOrgId,
            category_id: categoryId ?? undefined,
            name: teamName.trim(),
        });
        onChange(result);
        setShowCreate(false);
        setTeamName("");
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle icon={List} subtitle={t("team.selectSubtitle")}>
                    {t("team.selectTitle")}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {showCreate ? (
                    <div className="space-y-3 rounded-lg border border-border p-4">
                        <Input
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            placeholder={t("team.namePlaceholder")}
                        />
                        <div className="flex gap-2">
                            <Button onClick={handleCreate} disabled={!teamName.trim() || createTeam.isPending}>
                                {t("team.create")}
                            </Button>
                            <Button variant="outline" onClick={() => setShowCreate(false)}>
                                {tCommon("cancel")}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Button variant="outline" onClick={() => setShowCreate(true)} className="w-full">
                        <Plus className="mr-2 size-4" />
                        {t("team.createNew")}
                    </Button>
                )}

                {isLoading ? (
                    <p className="text-sm text-muted-foreground">{t("loadingForm")}</p>
                ) : teams.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">{t("team.existing")}</p>
                        {teams.map((team) => (
                            <button
                                key={team.id}
                                type="button"
                                onClick={() =>
                                    onChange(value?.id === team.id ? null : team)
                                }
                                className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                                    value?.id === team.id
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/50"
                                }`}
                            >
                                <span className="font-medium">{team.name}</span>
                                <span className="ml-2 text-xs text-muted-foreground">
                                    {team.member_count} {t("team.members")}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : !showCreate ? (
                    <p className="text-sm text-muted-foreground">{t("team.noTeams")}</p>
                ) : null}
            </CardContent>
        </Card>
    );
}
