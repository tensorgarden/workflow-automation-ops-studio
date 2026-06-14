import { describe, it, expect } from "vitest";
import { demoConnectors, demoWorkflows, demoActiveRun, demoCostSummary, demoWebhookRecovery } from "@/lib/demo-data";

describe("connector health", () => {
  it("has healthy connectors", () => {
    expect(demoConnectors.filter(c => c.status === "healthy").length).toBeGreaterThanOrEqual(2);
  });
  it("has at least one degraded or down connector", () => {
    expect(demoConnectors.some(c => c.status === "degraded" || c.status === "down")).toBe(true);
  });
});

describe("workflows", () => {
  it("each workflow has steps", () => {
    for (const wf of demoWorkflows) expect(wf.steps.length).toBeGreaterThan(0);
  });
  it("has approval gate workflow", () => {
    expect(demoWorkflows.some(w => w.steps.some(s => s.type === "approval_gate"))).toBe(true);
  });
});

describe("execution trace", () => {
  it("active run has step results", () => {
    expect(demoActiveRun.stepResults.length).toBeGreaterThanOrEqual(3);
  });
  it("failed run has error on failed step", () => {
    expect(demoActiveRun.stepResults.every(s => s.status !== "failed" || s.error)).toBe(true);
  });
});

describe("cost tracking", () => {
  it("cost stays under budget", () => {
    expect(demoCostSummary.totalCost).toBeLessThan(demoCostSummary.budgetLimit);
  });
  it("cost breakdown covers all runs", () => {
    const totalRuns = demoCostSummary.costByWorkflow.reduce((s, w) => s + w.runs, 0);
    expect(totalRuns).toBe(demoCostSummary.totalRuns);
  });
});

describe("webhook recovery safeguards", () => {
  it("ties dead-lettered payloads to workflow and trace context", () => {
    const workflowIds = new Set(demoWorkflows.map(w => w.id));

    for (const event of demoWebhookRecovery) {
      expect(workflowIds.has(event.workflowId)).toBe(true);
      expect(event.traceId).toMatch(/^trc_/);
      expect(event.idempotencyKey).toMatch(/^idem_/);
      expect(event.idempotencyKey.length).toBeGreaterThan(20);
    }
  });

  it("exhausts retries before operator replay review", () => {
    for (const event of demoWebhookRecovery) {
      expect(event.retryCount).toBe(event.maxRetries);
      expect(Number.isNaN(Date.parse(event.deadLetteredAt))).toBe(false);
      expect(event.operatorAction).toMatch(/replay|review|duplicate/i);
    }
  });

  it("keeps duplicate-risk webhook retries quarantined", () => {
    const duplicateRisk = demoWebhookRecovery.filter(event => !event.replaySafe);

    expect(duplicateRisk.length).toBeGreaterThan(0);
    expect(duplicateRisk.every(event => event.status === "quarantined")).toBe(true);
  });
});
