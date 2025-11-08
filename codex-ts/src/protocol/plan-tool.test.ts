import { describe, it, expect } from "vitest";
import { StepStatus, PlanItemArg, UpdatePlanArgs } from "./plan-tool.js";

describe("Plan Tool Protocol Types", () => {
  describe("StepStatus", () => {
    it("has correct enum values", () => {
      expect(StepStatus.Pending).toBe("pending");
      expect(StepStatus.InProgress).toBe("in_progress");
      expect(StepStatus.Completed).toBe("completed");
    });

    it("includes all expected step statuses", () => {
      const statuses = Object.values(StepStatus);
      expect(statuses).toContain("pending");
      expect(statuses).toContain("in_progress");
      expect(statuses).toContain("completed");
    });

    it("has exactly 3 status types", () => {
      const statusTypes = Object.keys(StepStatus).filter((k) =>
        isNaN(Number(k)),
      );
      expect(statusTypes).toHaveLength(3);
    });

    it("serializes to snake_case strings", () => {
      const status: StepStatus = StepStatus.InProgress;
      expect(status).toBe("in_progress");
      expect(typeof status).toBe("string");
    });

    it("can be used in JSON serialization", () => {
      const data = { status: StepStatus.Completed };
      const json = JSON.stringify(data);
      expect(json).toBe('{"status":"completed"}');
    });

    it("can be deserialized from JSON", () => {
      const json = '{"status":"in_progress"}';
      const data = JSON.parse(json);
      expect(data.status).toBe(StepStatus.InProgress);
    });

    it("can be compared for equality", () => {
      const status1: StepStatus = StepStatus.Pending;
      const status2: StepStatus = StepStatus.Pending;
      const status3: StepStatus = StepStatus.Completed;

      expect(status1).toBe(status2);
      expect(status1).not.toBe(status3);
    });

    it("can be used in switch statements", () => {
      const getStatusDescription = (status: StepStatus): string => {
        switch (status) {
          case StepStatus.Pending:
            return "Not started";
          case StepStatus.InProgress:
            return "Currently executing";
          case StepStatus.Completed:
            return "Finished";
          default:
            return "Unknown";
        }
      };

      expect(getStatusDescription(StepStatus.Pending)).toBe("Not started");
      expect(getStatusDescription(StepStatus.InProgress)).toBe(
        "Currently executing",
      );
      expect(getStatusDescription(StepStatus.Completed)).toBe("Finished");
    });
  });

  describe("PlanItemArg", () => {
    it("creates a valid plan item", () => {
      const item: PlanItemArg = {
        step: "Install dependencies",
        status: StepStatus.Completed,
      };

      expect(item.step).toBe("Install dependencies");
      expect(item.status).toBe(StepStatus.Completed);
    });

    it("serializes to JSON correctly", () => {
      const item: PlanItemArg = {
        step: "Run tests",
        status: StepStatus.InProgress,
      };

      const json = JSON.stringify(item);
      expect(json).toContain('"step":"Run tests"');
      expect(json).toContain('"status":"in_progress"');
    });

    it("deserializes from JSON correctly", () => {
      const json = '{"step":"Build project","status":"pending"}';
      const item: PlanItemArg = JSON.parse(json);

      expect(item.step).toBe("Build project");
      expect(item.status).toBe(StepStatus.Pending);
    });

    it("handles multiline step descriptions", () => {
      const item: PlanItemArg = {
        step: "Step 1:\nInstall dependencies\nVerify installation",
        status: StepStatus.Pending,
      };

      const json = JSON.stringify(item);
      const parsed: PlanItemArg = JSON.parse(json);
      expect(parsed.step).toBe(
        "Step 1:\nInstall dependencies\nVerify installation",
      );
    });

    it("handles empty step strings", () => {
      const item: PlanItemArg = {
        step: "",
        status: StepStatus.Pending,
      };

      expect(item.step).toBe("");
      const json = JSON.stringify(item);
      const parsed: PlanItemArg = JSON.parse(json);
      expect(parsed.step).toBe("");
    });

    it("handles special characters in step descriptions", () => {
      const item: PlanItemArg = {
        step: 'Run "npm test" & verify <output>',
        status: StepStatus.InProgress,
      };

      const json = JSON.stringify(item);
      const parsed: PlanItemArg = JSON.parse(json);
      expect(parsed.step).toBe('Run "npm test" & verify <output>');
    });

    it("supports all status transitions", () => {
      const step = "Example step";

      const pending: PlanItemArg = { step, status: StepStatus.Pending };
      expect(pending.status).toBe("pending");

      const inProgress: PlanItemArg = { step, status: StepStatus.InProgress };
      expect(inProgress.status).toBe("in_progress");

      const completed: PlanItemArg = { step, status: StepStatus.Completed };
      expect(completed.status).toBe("completed");
    });
  });

  describe("UpdatePlanArgs", () => {
    it("creates a valid update plan args with explanation", () => {
      const args: UpdatePlanArgs = {
        explanation: "Starting deployment process",
        plan: [
          { step: "Build application", status: StepStatus.Completed },
          { step: "Run tests", status: StepStatus.InProgress },
          { step: "Deploy to production", status: StepStatus.Pending },
        ],
      };

      expect(args.explanation).toBe("Starting deployment process");
      expect(args.plan).toHaveLength(3);
      expect(args.plan[0].step).toBe("Build application");
      expect(args.plan[1].step).toBe("Run tests");
      expect(args.plan[2].step).toBe("Deploy to production");
    });

    it("creates a valid update plan args without explanation", () => {
      const args: UpdatePlanArgs = {
        plan: [{ step: "First step", status: StepStatus.Pending }],
      };

      expect(args.explanation).toBeUndefined();
      expect(args.plan).toHaveLength(1);
    });

    it("serializes to JSON correctly", () => {
      const args: UpdatePlanArgs = {
        explanation: "Test plan",
        plan: [{ step: "Step 1", status: StepStatus.Completed }],
      };

      const json = JSON.stringify(args);
      expect(json).toContain('"explanation":"Test plan"');
      expect(json).toContain('"plan":[');
      expect(json).toContain('"step":"Step 1"');
      expect(json).toContain('"status":"completed"');
    });

    it("deserializes from JSON correctly", () => {
      const json =
        '{"explanation":"Build process","plan":[{"step":"Compile","status":"in_progress"}]}';
      const args: UpdatePlanArgs = JSON.parse(json);

      expect(args.explanation).toBe("Build process");
      expect(args.plan).toHaveLength(1);
      expect(args.plan[0].step).toBe("Compile");
      expect(args.plan[0].status).toBe(StepStatus.InProgress);
    });

    it("handles empty plan array", () => {
      const args: UpdatePlanArgs = {
        explanation: "No steps yet",
        plan: [],
      };

      expect(args.plan).toHaveLength(0);
      const json = JSON.stringify(args);
      const parsed: UpdatePlanArgs = JSON.parse(json);
      expect(parsed.plan).toEqual([]);
    });

    it("handles missing explanation (undefined)", () => {
      const args: UpdatePlanArgs = {
        plan: [{ step: "Only step", status: StepStatus.Pending }],
      };

      const json = JSON.stringify(args);
      const parsed: UpdatePlanArgs = JSON.parse(json);
      expect(parsed.explanation).toBeUndefined();
    });

    it("handles complex multi-step plan", () => {
      const args: UpdatePlanArgs = {
        explanation: "Complete CI/CD pipeline",
        plan: [
          { step: "Checkout code", status: StepStatus.Completed },
          { step: "Install dependencies", status: StepStatus.Completed },
          { step: "Lint code", status: StepStatus.Completed },
          { step: "Run unit tests", status: StepStatus.InProgress },
          { step: "Run integration tests", status: StepStatus.Pending },
          { step: "Build Docker image", status: StepStatus.Pending },
          { step: "Push to registry", status: StepStatus.Pending },
          { step: "Deploy to staging", status: StepStatus.Pending },
          { step: "Run smoke tests", status: StepStatus.Pending },
          { step: "Deploy to production", status: StepStatus.Pending },
        ],
      };

      expect(args.plan).toHaveLength(10);

      const completedSteps = args.plan.filter(
        (item) => item.status === StepStatus.Completed,
      );
      expect(completedSteps).toHaveLength(3);

      const inProgressSteps = args.plan.filter(
        (item) => item.status === StepStatus.InProgress,
      );
      expect(inProgressSteps).toHaveLength(1);

      const pendingSteps = args.plan.filter(
        (item) => item.status === StepStatus.Pending,
      );
      expect(pendingSteps).toHaveLength(6);
    });

    it("handles multiline explanation", () => {
      const args: UpdatePlanArgs = {
        explanation: "Phase 1: Setup\nPhase 2: Build\nPhase 3: Deploy",
        plan: [{ step: "Start", status: StepStatus.Pending }],
      };

      const json = JSON.stringify(args);
      const parsed: UpdatePlanArgs = JSON.parse(json);
      expect(parsed.explanation).toBe(
        "Phase 1: Setup\nPhase 2: Build\nPhase 3: Deploy",
      );
    });

    it("preserves step order in serialization", () => {
      const args: UpdatePlanArgs = {
        plan: [
          { step: "First", status: StepStatus.Pending },
          { step: "Second", status: StepStatus.Pending },
          { step: "Third", status: StepStatus.Pending },
        ],
      };

      const json = JSON.stringify(args);
      const parsed: UpdatePlanArgs = JSON.parse(json);

      expect(parsed.plan[0].step).toBe("First");
      expect(parsed.plan[1].step).toBe("Second");
      expect(parsed.plan[2].step).toBe("Third");
    });
  });
});
