import { describe, it, expect } from "vitest";
import {
    sportFormSchema,
    categoryFormSchema,
    sportPublicSchema,
    categoryPublicSchema,
} from "./sports.schema";
import { Gender } from "../types";

describe("sportFormSchema", () => {
    it("accepts a name of at least 2 characters", () => {
        expect(sportFormSchema.safeParse({ name_kh: "បាល់ទាត់" }).success).toBe(true);
    });

    it("rejects a name shorter than 2 characters", () => {
        expect(sportFormSchema.safeParse({ name_kh: "ក" }).success).toBe(false);
    });

    it("allows sport_type to be omitted or an empty string", () => {
        expect(sportFormSchema.safeParse({ name_kh: "Football", sport_type: "" }).success).toBe(true);
        expect(sportFormSchema.safeParse({ name_kh: "Football", sport_type: "team" }).success).toBe(true);
    });
});

describe("categoryFormSchema", () => {
    it("accepts a category with a normalized gender", () => {
        const result = categoryFormSchema.safeParse({ category: "U18", gender: "MALE" });
        expect(result.success && result.data.gender).toBe(Gender.MALE);
    });

    it("treats gender as optional", () => {
        expect(categoryFormSchema.safeParse({ category: "Open" }).success).toBe(true);
    });

    it("rejects a category shorter than 2 characters", () => {
        expect(categoryFormSchema.safeParse({ category: "A" }).success).toBe(false);
    });

    it("rejects an unrecognized gender", () => {
        expect(categoryFormSchema.safeParse({ category: "U18", gender: "robot" }).success).toBe(false);
    });
});

describe("sportPublicSchema — strict envelope", () => {
    const valid = { id: 1, name_kh: "បាល់ទាត់" };

    it("accepts the minimal required shape", () => {
        expect(sportPublicSchema.safeParse(valid).success).toBe(true);
    });

    it("rejects unknown keys", () => {
        expect(sportPublicSchema.safeParse({ ...valid, surprise: true }).success).toBe(false);
    });
});

describe("categoryPublicSchema — gender preprocessing", () => {
    it("lower-cases an incoming gender before enum validation", () => {
        const result = categoryPublicSchema.safeParse({ id: 1, category: "U18", gender: "FEMALE" });
        expect(result.success && result.data.gender).toBe(Gender.FEMALE);
    });

    it("accepts a null gender", () => {
        expect(categoryPublicSchema.safeParse({ id: 1, category: "Open", gender: null }).success).toBe(true);
    });
});
