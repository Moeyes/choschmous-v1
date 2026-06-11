import { z } from 'zod';

const dashboardStatsSchema = z.object({
    events: z.number(),
    sports: z.number(),
    participants: z.number(),
    registrations: z.number(),
    organizations: z.number(),
    athletes: z.number(),
    leaders: z.number(),
});

const genderDistributionSchema = z.object({
    male: z.number(),
    female: z.number(),
    other: z.number(),
});

const topOrganizationSchema = z.object({
    name: z.string(),
    participants: z.number(),
    type: z.string(),
});

const recentEnrollmentSchema = z.object({
    id: z.number(),
    khName: z.string(),
    enName: z.string(),
    gender: z.string(),
    phone: z.string(),
    createdAt: z.string(),
});

export const dashboardDataSchema = z.object({
    stats: dashboardStatsSchema,
    genderDistribution: genderDistributionSchema,
    topOrganizations: z.array(topOrganizationSchema),
    recentEnrollments: z.array(recentEnrollmentSchema),
});

export const dashboardResponseSchema = z.object({
    success: z.boolean(),
    data: dashboardDataSchema,
});

const dashboardQueryParamsSchema = z.object({
    orgId: z.number().optional(),
    categoryId: z.number().optional(),
}).optional();

export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
export type GenderDistribution = z.infer<typeof genderDistributionSchema>;
export type TopOrganization = z.infer<typeof topOrganizationSchema>;
export type RecentEnrollment = z.infer<typeof recentEnrollmentSchema>;
export type DashboardData = z.infer<typeof dashboardDataSchema>;
type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
export type DashboardQueryParams = z.input<typeof dashboardQueryParamsSchema>;
