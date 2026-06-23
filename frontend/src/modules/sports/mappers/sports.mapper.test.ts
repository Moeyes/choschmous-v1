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
    it("attaches the sport id and keeps the gender; individual clears team size", () => {
        expect(formDataToAddCategory(3, { category: "U18", gender: Gender.MALE, categoryType: "individual" })).toEqual({
            sport_id: 3,
            category: "U18",
            gender: Gender.MALE,
            team_size_min: null,
            team_size_max: null,
        });
    });

    it("sends the team sizes when the category is a team", () => {
        expect(
            formDataToAddCategory(3, { category: "Doubles", gender: Gender.MALE, categoryType: "team", team_size_min: 2, team_size_max: 2 }),
        ).toEqual({
            sport_id: 3,
            category: "Doubles",
            gender: Gender.MALE,
            team_size_min: 2,
            team_size_max: 2,
        });
    });

    it("defaults an absent gender to null", () => {
        expect(formDataToAddCategory(3, { category: "Open", gender: undefined, categoryType: "individual" }).gender).toBeNull();
    });
});

describe("formDataToUpdateCategory", () => {
    it("includes both the category id and the sport id", () => {
        expect(formDataToUpdateCategory(5, 3, { category: "U21", gender: Gender.FEMALE, categoryType: "individual" })).toEqual({
            id: 5,
            sport_id: 3,
            category: "U21",
            gender: Gender.FEMALE,
            team_size_min: null,
            team_size_max: null,
        });
    });

    it("defaults an absent gender to null", () => {
        expect(formDataToUpdateCategory(5, 3, { category: "U21", gender: undefined, categoryType: "individual" }).gender).toBeNull();
    });
});
