import { describe, it, expect } from "vitest";
import { PlanType } from "./account.js";

describe("Account Protocol Types", () => {
  describe("PlanType", () => {
    it("has correct enum values", () => {
      expect(PlanType.Free).toBe("free");
      expect(PlanType.Plus).toBe("plus");
      expect(PlanType.Pro).toBe("pro");
      expect(PlanType.Team).toBe("team");
      expect(PlanType.Business).toBe("business");
      expect(PlanType.Enterprise).toBe("enterprise");
      expect(PlanType.Edu).toBe("edu");
      expect(PlanType.Unknown).toBe("unknown");
    });

    it("includes all expected plan types", () => {
      const planTypes = Object.values(PlanType);
      expect(planTypes).toContain("free");
      expect(planTypes).toContain("plus");
      expect(planTypes).toContain("pro");
      expect(planTypes).toContain("team");
      expect(planTypes).toContain("business");
      expect(planTypes).toContain("enterprise");
      expect(planTypes).toContain("edu");
      expect(planTypes).toContain("unknown");
    });

    it("has exactly 8 plan types", () => {
      const planTypes = Object.keys(PlanType).filter((k) => isNaN(Number(k)));
      expect(planTypes).toHaveLength(8);
    });

    it("serializes to lowercase strings", () => {
      const plan: PlanType = PlanType.Pro;
      expect(plan).toBe("pro");
      expect(typeof plan).toBe("string");
    });

    it("can be used in JSON serialization", () => {
      const data = { plan: PlanType.Team };
      const json = JSON.stringify(data);
      expect(json).toBe('{"plan":"team"}');
    });

    it("can be deserialized from JSON", () => {
      const json = '{"plan":"enterprise"}';
      const data = JSON.parse(json);
      expect(data.plan).toBe(PlanType.Enterprise);
    });

    it("supports Free as default plan type", () => {
      const defaultPlan: PlanType = PlanType.Free;
      expect(defaultPlan).toBe("free");
    });

    it("supports Unknown for unrecognized plans", () => {
      const unknownPlan: PlanType = PlanType.Unknown;
      expect(unknownPlan).toBe("unknown");
    });

    it("can be compared for equality", () => {
      const plan1: PlanType = PlanType.Pro;
      const plan2: PlanType = PlanType.Pro;
      const plan3: PlanType = PlanType.Plus;

      expect(plan1).toBe(plan2);
      expect(plan1).not.toBe(plan3);
    });

    it("can be used in switch statements", () => {
      const getPlanDescription = (plan: PlanType): string => {
        switch (plan) {
          case PlanType.Free:
            return "Free tier";
          case PlanType.Plus:
            return "Plus subscription";
          case PlanType.Pro:
            return "Pro subscription";
          case PlanType.Team:
            return "Team subscription";
          case PlanType.Business:
            return "Business subscription";
          case PlanType.Enterprise:
            return "Enterprise subscription";
          case PlanType.Edu:
            return "Education subscription";
          case PlanType.Unknown:
            return "Unknown plan";
          default:
            return "Unhandled plan";
        }
      };

      expect(getPlanDescription(PlanType.Free)).toBe("Free tier");
      expect(getPlanDescription(PlanType.Pro)).toBe("Pro subscription");
      expect(getPlanDescription(PlanType.Unknown)).toBe("Unknown plan");
    });
  });
});
