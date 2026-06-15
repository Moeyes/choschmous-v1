import { describe, it, expect } from "vitest";
import {
    formDataToCreateSport,
    formDataToUpdateSport,
    formDataToAddCategory,
    formDataToUpdateCategory,
} from "./sports.mapper";
import { Gender } from "../types";

describe("formDataToCreateSport", () => {
    it("passes the name through", () => {
        expect(formDataToCreateSport({ name_kh: "Football", sport_type: "team" })).toEqual({
            name_kh: "Football",
            sport_type: "team",
        });
    });

    it("normalizes an empty sport_type to undefined", () => {
        expect(formDataToCreateSport({ name_kh: "Football", sport_type: "" }).sport_type).toBeUndefined();
    });
});

describe("formDataToUpdateSport", () => {
    it("includes the id alongside the mapped fields", () => {
        expect(formDataToUpdateSport(7, { name_kh: "Swimming", sport_type: "" })).toEqual({
            id: 7,
            name_kh: "Swimming",
            sport_type: undefined,
        });
    });
});

describe("formDataToAddCategory", () => {
    it("attaches the sport id and keeps the gender", () => {
        expect(formDataToAddCategory(3, { category: "U18", gender: Gender.MALE })).toEqual({
            sport_id: 3,
            category: "U18",
            gender: Gender.MALE,
        });
    });

    it("defaults an absent gender to null", () => {
        expect(formDataToAddCategory(3, { category: "Open", gender: undefined }).gender).toBeNull();
    });
});

describe("formDataToUpdateCategory", () => {
    it("includes both the category id and the sport id", () => {
        expect(formDataToUpdateCategory(5, 3, { category: "U21", gender: Gender.FEMALE })).toEqual({
            id: 5,
            sport_id: 3,
            category: "U21",
            gender: Gender.FEMALE,
        });
    });

    it("defaults an absent gender to null", () => {
        expect(formDataToUpdateCategory(5, 3, { category: "U21", gender: undefined }).gender).toBeNull();
    });
});
