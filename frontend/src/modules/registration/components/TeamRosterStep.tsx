"use client";

import { useTranslations } from "next-intl";
import { Users, UserPlus, Trash2, AlertCircle, Pencil, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@/shared";
import { useTeam, useRemoveTeamMember } from "../hooks/useTeams";
import type { TeamDetail } from "../types/team";

interface TeamRosterStepProps {
    teamId: number;
    teamSizeMin?: number | null;
    teamSizeMax?: number | null;
    onAddMember: () => void;
    onEditMember?: (enrollId: number) => void;
    onValidationChange?: (valid: boolean) => void;
}

export function TeamRosterStep({
    teamId,
    teamSizeMin,
    teamSizeMax,
    onAddMember,
    onEditMember,
    onValidationChange,
}: TeamRosterStepProps) {
    const t = useTranslations("registration");
    const { data: team, isLoading, refetch } = useTeam(teamId);
    const removeMember = useRemoveTeamMember(teamId);

    if (isLoading) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    {t("loading")}
                </CardContent>
            </Card>
        );
    }

    if (!team) return null;

    const count = team.member_count;
    const canSubmit =
        teamSizeMin == null || count >= teamSizeMin;
    const isFull = teamSizeMax != null && count >= teamSizeMax;

    return (
        <Card>
            <CardHeader>
                <CardTitle icon={Users} subtitle={t("team.rosterSubtitle")}>
                    {team.name} — {t("team.rosterTitle")}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2">
                    <span className="text-sm font-medium">{t("team.members")}</span>
                    <span className={`text-sm font-bold ${!canSubmit ? "text-destructive" : "text-primary"}`}>
                        {t("team.members")} {count}
                        {teamSizeMin != null && <> / {t("team.min")} {teamSizeMin}</>}
                        {teamSizeMax != null && <> – {t("team.max")} {teamSizeMax}</>}
                    </span>
                </div>

                {!canSubmit && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        <p className="text-xs text-destructive">
                            {t("team.minNotReached", { min: teamSizeMin })}
                        </p>
                    </div>
                )}

                {team.members.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <Users className="size-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">{t("team.noMembers")}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {team.members.map((member) => (
                            <div
                                key={member.enroll_id}
                                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                            >
                                <div className="flex items-center gap-3">
                                    {member.photo_url ? (
                                        <img
                                            src={member.photo_url}
                                            alt=""
                                            className="size-8 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                                            {member.kh_given_name?.charAt(0)}
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm font-medium">
                                            {member.kh_family_name} {member.kh_given_name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {member.en_family_name} {member.en_given_name}
                                        </p>
                                    </div>
                                    {member.status && (
                                        <Badge
                                            variant={member.status === "complete" ? "success" : "error"}
                                            size="sm"
                                            className="gap-1"
                                        >
                                            {member.status === "complete" ? (
                                                <CheckCircle2 className="size-3" />
                                            ) : (
                                                <XCircle className="size-3" />
                                            )}
                                            {t(`team.status.${member.status}` as Parameters<typeof t>[0])}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    {onEditMember && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEditMember(member.enroll_id)}
                                        >
                                            <Pencil className="size-4 text-muted-foreground" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                            await removeMember.mutateAsync(member.enroll_id);
                                            refetch();
                                        }}
                                    >
                                        <Trash2 className="size-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {!isFull && (
                    <Button onClick={onAddMember} variant="outline" className="w-full">
                        <UserPlus className="mr-2 size-4" />
                        {t("team.addMember")}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
