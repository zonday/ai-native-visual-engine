import type {
  Constraint,
  ConstraintInput,
  ConstraintType,
} from "./constraint-types.js";

export interface ConstraintRegistry {
  register(constraint: Constraint): void;
  unregister(id: string): boolean;
  validate(input: ConstraintInput): ConstraintValidationReport;
}

export interface ConstraintValidationReport {
  pass: boolean;
  violations: Array<{
    constraintId: string;
    type: ConstraintType;
    code: string;
    message: string;
    severity: "error" | "warning";
  }>;
}

export function createConstraintRegistry(): ConstraintRegistry {
  const constraints = new Map<string, Constraint>();

  return {
    register(constraint: Constraint): void {
      constraints.set(constraint.id, constraint);
    },

    unregister(id: string): boolean {
      return constraints.delete(id);
    },

    validate(input: ConstraintInput): ConstraintValidationReport {
      const violations: ConstraintValidationReport["violations"] = [];

      for (const c of constraints.values()) {
        const result = c.evaluate(input);
        if (!result.pass) {
          violations.push({
            constraintId: c.id,
            type: c.type,
            code: result.code ?? c.id,
            message: result.message ?? c.message,
            severity: c.severity,
          });
        }
      }

      const hasErrors = violations.some((v) => v.severity === "error");
      return {
        pass: !hasErrors,
        violations,
      };
    },
  };
}
