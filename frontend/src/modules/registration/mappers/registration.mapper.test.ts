import { describe, it, expect } from "vitest";
import { formDataToPayload, parseApiError } from "./registration.mapper";
import type { RegisterFormData } from "../schema/registration.schema";
import type { ApiErrorResponse } from "../types";

/** A fully-resolved (post-parse) form output. Override per test. */
function formData(overrides: Partial<RegisterFormData> = {}): RegisterFormData {
    return {
        eventType: "national",
        eventId: 1,
        organizationId: "10",
        sportId: 2,
        categoryId: 3,
        teamId: null,
        khFamilyName: "សុខ",
        khGivenName: "ដារា",
        enFamilyName: "Sok",
        enGivenName: "Dara",
        gender: "MALE",
        dateOfBirth: "2000-01-01",
        nationality: "Cambodian",
        phone: "012345678",
        idDocumentType: "IDCARD",
        role: "athlete",
        photoPath: "/api/files/photo",
        birthCertificatePath: null,
        nationalIdPath: null,
        passportPath: null,
        ...overrides,
    } as RegisterFormData;
}

describe("formDataToPayload — field aliasing", () => {
    it("maps Khmer/Latin names to the backend alias names", () => {
        const p = formDataToPayload(formData(), "user-123");
        expect(p.lastNameKhmer).toBe("សុខ");
        expect(p.firstNameKhmer).toBe("ដារា");
        expect(p.lastNameLatin).toBe("Sok");
        expect(p.firstNameLatin).toBe("Dara");
    });

    it("carries the authenticated user id through", () => {
        expect(formDataToPayload(formData(), "user-123").userId).toBe("user-123");
    });

    it("coerces the string organizationId to a number", () => {
        const p = formDataToPayload(formData({ organizationId: "42" }), "u");
        expect(p.organizationId).toBe(42);
        expect(typeof p.organizationId).toBe("number");
    });

    it("maps normalized document type values to backend labels", () => {
        expect(formDataToPayload(formData({ idDocumentType: "IDCARD" }), "u").idDocType).toBe("IDCard");
        expect(formDataToPayload(formData({ idDocumentType: "BIRTHCERTIFICATE" }), "u").idDocType).toBe("BirthCertificate");
        expect(formDataToPayload(formData({ idDocumentType: "PASSPORT" }), "u").idDocType).toBe("Passport");
        expect(formDataToPayload(formData({ idDocumentType: "FAMILYBOOK" }), "u").idDocType).toBe("FamilyBook");
    });
});

describe("formDataToPayload — nullable defaults", () => {
    it("defaults categoryId to null when absent", () => {
        expect(formDataToPayload(formData({ categoryId: null }), "u").categoryId).toBeNull();
    });

    it("defaults teamId to null when absent but preserves a real id", () => {
        expect(formDataToPayload(formData({ teamId: null }), "u").teamId).toBeNull();
        expect(formDataToPayload(formData({ teamId: 7 }), "u").teamId).toBe(7);
    });

    it("defaults force to false but preserves an explicit true", () => {
        expect(formDataToPayload(formData(), "u").force).toBe(false);
        expect(formDataToPayload(formData({ force: true }), "u").force).toBe(true);
    });

    it("converts an empty leaderRole to null", () => {
        expect(formDataToPayload(formData({ leaderRole: "" }), "u").leaderRole).toBeNull();
        expect(formDataToPayload(formData({ leaderRole: "COACH" }), "u").leaderRole).toBe("COACH");
    });

    it("maps document paths, defaulting missing ones to null", () => {
        const p = formDataToPayload(
            formData({ birthCertificatePath: "/api/files/bc", nationalIdPath: null }),
            "u",
        );
        expect(p.photoUrl).toBe("/api/files/photo");
        expect(p.birthCertificateUrl).toBe("/api/files/bc");
        expect(p.nationalIdUrl).toBeNull();
        expect(p.passportUrl).toBeNull();
    });

    it("always sends nationalityDocumentUrl as null", () => {
        expect(formDataToPayload(formData(), "u").nationalityDocumentUrl).toBeNull();
    });
});

describe("parseApiError — normalizes every backend error shape", () => {
    it("handles a plain string detail", () => {
        expect(parseApiError({ detail: "Boom" })).toEqual({ message: "Boom" });
    });

    it("handles a FastAPI validation array, keyed by the last loc segment", () => {
        const error: ApiErrorResponse = {
            detail: [
                { loc: ["body", "phone"], msg: "bad phone", type: "value_error" },
                { loc: ["body", "gender"], msg: "bad gender", type: "value_error" },
            ],
        };
        const parsed = parseApiError(error);
        expect(parsed.message).toBe("bad phone");
        expect(parsed.fields?.get("phone")).toBe("bad phone");
        expect(parsed.fields?.get("gender")).toBe("bad gender");
    });

    it("handles a structured coded error", () => {
        const parsed = parseApiError({
            detail: {
                code: "DUPLICATE_PARTICIPANT",
                message: "Already registered",
                params: { existing_id: 99 },
                duplicate_suspect: true,
            },
        });
        expect(parsed.code).toBe("DUPLICATE_PARTICIPANT");
        expect(parsed.message).toBe("Already registered");
        expect(parsed.params).toEqual({ existing_id: 99 });
        expect(parsed.duplicateSuspect).toBe(true);
    });

    it("falls back to a generic message for a coded error without a message", () => {
        const parsed = parseApiError({ detail: { code: "X" } });
        expect(parsed.message).toBe("An unexpected error occurred. Please try again.");
        expect(parsed.duplicateSuspect).toBe(false);
    });

    it("falls back when detail is missing entirely", () => {
        expect(parseApiError({}).message).toBe("An unexpected error occurred. Please try again.");
    });
});
