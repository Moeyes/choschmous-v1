import { describe, it, expect } from "vitest";
import {
    registerSchema,
    registerResponseSchema,
    enrollmentListResponseSchema,
    revealedPiiSchema,
    participantDetailResponseSchema,
    type RegisterFormInput,
} from "./registration.schema";

/** A complete, valid athlete form input. Override individual fields per test. */
function validAthleteInput(overrides: Partial<RegisterFormInput> = {}): RegisterFormInput {
    return {
        eventType: "national",
        eventId: 1,
        organizationId: "10",
        sportId: 2,
        categoryId: 3,
        khFamilyName: "សុខ",
        khGivenName: "ដារា",
        enFamilyName: "Sok",
        enGivenName: "Dara",
        gender: "male",
        dateOfBirth: "2000-01-01",
        phone: "012345678",
        idDocumentType: "idcard",
        role: "athlete",
        photoPath: "/api/files/photo",
        ...overrides,
    };
}

describe("registerSchema — happy path", () => {
    it("accepts a complete valid athlete", () => {
        const result = registerSchema.safeParse(validAthleteInput());
        expect(result.success).toBe(true);
    });

    it("accepts a valid leader (no category, with leaderRole)", () => {
        const result = registerSchema.safeParse(
            validAthleteInput({ role: "leader", categoryId: null, leaderRole: "COACH" }),
        );
        expect(result.success).toBe(true);
    });
});

describe("registerSchema — case-normalizing transforms", () => {
    it("upper-cases gender", () => {
        const result = registerSchema.safeParse(validAthleteInput({ gender: "female" }));
        expect(result.success && result.data.gender).toBe("FEMALE");
    });

    it("upper-cases the id document type", () => {
        const result = registerSchema.safeParse(validAthleteInput({ idDocumentType: "passport" }));
        expect(result.success && result.data.idDocumentType).toBe("PASSPORT");
    });

    it("lower-cases the role", () => {
        const result = registerSchema.safeParse(
            validAthleteInput({ role: "Leader", categoryId: null, leaderRole: "COACH" }),
        );
        expect(result.success && result.data.role).toBe("leader");
    });

    it("defaults nationality to 'Cambodian' when omitted", () => {
        const result = registerSchema.safeParse(validAthleteInput());
        expect(result.success && result.data.nationality).toBe("Cambodian");
    });
});

describe("registerSchema — phone validation", () => {
    it.each(["1234567", "012345678", "123456789012345"])("accepts %s", (phone) => {
        expect(registerSchema.safeParse(validAthleteInput({ phone })).success).toBe(true);
    });

    it.each([
        ["too short", "123456"],
        ["too long", "1234567890123456"],
        ["non-digits", "012-345-678"],
    ])("rejects %s (%s)", (_label, phone) => {
        expect(registerSchema.safeParse(validAthleteInput({ phone })).success).toBe(false);
    });
});

describe("registerSchema — birth date must be in the past", () => {
    it("accepts a past date", () => {
        expect(registerSchema.safeParse(validAthleteInput({ dateOfBirth: "1990-05-01" })).success).toBe(true);
    });

    it("rejects a future date", () => {
        expect(registerSchema.safeParse(validAthleteInput({ dateOfBirth: "2999-01-01" })).success).toBe(false);
    });

    it("rejects an unparseable date string", () => {
        expect(registerSchema.safeParse(validAthleteInput({ dateOfBirth: "not-a-date" })).success).toBe(false);
    });
});

describe("registerSchema — required context fields", () => {
    it("rejects an empty event type", () => {
        const result = registerSchema.safeParse(validAthleteInput({ eventType: "" }));
        expect(result.success).toBe(false);
    });

    it("rejects a null event id", () => {
        const result = registerSchema.safeParse(validAthleteInput({ eventId: null }));
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes("eventId"))).toBe(true);
        }
    });

    it("rejects a null organization id", () => {
        expect(registerSchema.safeParse(validAthleteInput({ organizationId: null })).success).toBe(false);
    });
});

describe("registerSchema — role-conditional requirements", () => {
    it("requires a category for athletes", () => {
        const result = registerSchema.safeParse(validAthleteInput({ role: "athlete", categoryId: null }));
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes("categoryId"))).toBe(true);
        }
    });

    it("requires a leaderRole for leaders", () => {
        const result = registerSchema.safeParse(
            validAthleteInput({ role: "leader", categoryId: null, leaderRole: undefined }),
        );
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues.some((i) => i.path.includes("leaderRole"))).toBe(true);
        }
    });
});

describe("response envelopes — strictness guards", () => {
    it("registerResponseSchema accepts the minimal { status, enroll_id }", () => {
        expect(registerResponseSchema.safeParse({ status: "ok", enroll_id: 5 }).success).toBe(true);
    });

    it("registerResponseSchema tolerates an echoed user_id", () => {
        expect(registerResponseSchema.safeParse({ status: "ok", enroll_id: 5, user_id: "u1" }).success).toBe(true);
    });

    it("registerResponseSchema rejects unknown keys (strict)", () => {
        expect(registerResponseSchema.safeParse({ status: "ok", enroll_id: 5, leaked: true }).success).toBe(false);
    });

    it("revealedPiiSchema rejects extra keys beyond { enroll_id, phone }", () => {
        expect(revealedPiiSchema.safeParse({ enroll_id: 5, phone: "012345678" }).success).toBe(true);
        expect(revealedPiiSchema.safeParse({ enroll_id: 5, phone: "012", extra: 1 }).success).toBe(false);
    });
});

describe("enrollmentListResponseSchema — PII minimization", () => {
    const validItem = {
        id: 1,
        created_at: "2024-01-01T00:00:00Z",
        kh_family_name: "សុខ",
        kh_given_name: "ដារា",
        en_family_name: "Sok",
        en_given_name: "Dara",
        role: "athlete",
    };

    it("accepts a lean list item", () => {
        const result = enrollmentListResponseSchema.safeParse({ status: "ok", data: [validItem], count: 1 });
        expect(result.success).toBe(true);
    });

    it("rejects a list item that leaks restricted PII (phone)", () => {
        const leaky = { ...validItem, phone: "012345678" };
        const result = enrollmentListResponseSchema.safeParse({ status: "ok", data: [leaky], count: 1 });
        expect(result.success).toBe(false);
    });
});

describe("participantDetailResponseSchema — lenient, strips unknown keys", () => {
    it("succeeds and drops unknown fields rather than throwing", () => {
        const result = participantDetailResponseSchema.safeParse({
            status: "ok",
            data: {
                participant_id: 1,
                id: 1,
                role: "athlete",
                kh_family_name: "សុខ",
                kh_given_name: "ដារា",
                en_family_name: "Sok",
                en_given_name: "Dara",
                future_backend_field: "should be stripped",
            },
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect("future_backend_field" in result.data.data).toBe(false);
        }
    });
});
