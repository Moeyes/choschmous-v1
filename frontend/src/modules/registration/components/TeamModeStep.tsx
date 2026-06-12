"use client";

import { useTranslations } from "next-intl";
import { Users, User as UserIcon } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, RadioCardGroup } from "@/shared";
import type { RadioCardOption } from "@/shared";

interface TeamModeStepProps {
    value: "individual" | "team" | null;
    onChange: (mode: "individual" | "team") => void;
    availableModes?: ("individual" | "team")[];
}

export function TeamModeStep({ value, onChange, availableModes }: TeamModeStepProps) {
    const t = useTranslations("registration");

    const allOptions: RadioCardOption[] = [
        {
            value: "individual",
            label: t("team.individual"),
            description: t("team.individualDesc"),
            icon: UserIcon,
        },
        {
            value: "team",
            label: t("team.team"),
            description: t("team.teamDesc"),
            icon: Users,
        },
    ];

    const options = availableModes
        ? allOptions.filter((o) => availableModes.includes(o.value as "individual" | "team"))
        : allOptions;

    return (
        <Card>
            <CardHeader>
                <CardTitle icon={Users} subtitle={t("team.modeSubtitle")}>
                    {t("team.modeTitle")}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <RadioCardGroup
                    options={options}
                    value={value}
                    onChange={(v) => onChange(v as "individual" | "team")}
                />
            </CardContent>
        </Card>
    );
}
