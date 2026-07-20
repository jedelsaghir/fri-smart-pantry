import { describe, expect, it } from "vitest";
import { firstNameFromDisplayName, personalGreeting, timeOfDayGreeting } from "./greeting";

describe("firstNameFromDisplayName", () => {
  it("uses first token", () => {
    expect(firstNameFromDisplayName("Sam Rivera")).toBe("Sam");
  });
  it("falls back for empty / placeholder", () => {
    expect(firstNameFromDisplayName("")).toBe("there");
    expect(firstNameFromDisplayName("Your name")).toBe("there");
    expect(firstNameFromDisplayName("You")).toBe("there");
  });
});

describe("timeOfDayGreeting", () => {
  it("morning", () => {
    expect(timeOfDayGreeting(new Date(2026, 0, 1, 8))).toBe("Good morning");
  });
  it("afternoon", () => {
    expect(timeOfDayGreeting(new Date(2026, 0, 1, 14))).toBe("Good afternoon");
  });
  it("evening", () => {
    expect(timeOfDayGreeting(new Date(2026, 0, 1, 20))).toBe("Good evening");
  });
});

describe("personalGreeting", () => {
  it("combines time and first name", () => {
    expect(personalGreeting("Jed El", new Date(2026, 0, 1, 9))).toBe("Good morning, Jed");
  });
});
