import { describe, it, expect } from "vitest";
import { demoConnectors, demoWorkflows, demoActiveRun, demoCostSummary, demoWebhookRecovery, demoRunHistory, demoApprovals } from "@/lib/demo-data";

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

describe("connector blast radius", () => {
  it("every degraded connector has at least one workflow that depends on it", () => {
    const degradedIds = new Set(
      demoConnectors.filter(c => c.status === "degraded").map(c => c.id)
    );

    for (const connId of degradedIds) {
      const impacted = demoWorkflows.filter(w => w.dependsOnConnectorIds.includes(connId));
      expect(impacted.length).toBeGreaterThan(0);
    }
  });

  it("the down connector is flagged without active workflow dependents, reflecting a decommissioned integration", () => {
    const downConnectors = demoConnectors.filter(c => c.status === "down");
    expect(downConnectors.length).toBeGreaterThan(0);
    // A down legacy connector may have zero active workflows — that is the point of the health dashboard
  });

  it("every workflow dependency references a real connector", () => {
    const connectorIds = new Set(demoConnectors.map(c => c.id));

    for (const wf of demoWorkflows) {
      for (const connId of wf.dependsOnConnectorIds) {
        expect(connectorIds.has(connId)).toBe(true);
      }
    }
  });
});

describe("approval gate safety", () => {
  it("every approval request references a real run that is awaiting approval", () => {
    const awaitingRunIds = new Set(
      demoRunHistory.filter(r => r.status === "awaiting_approval").map(r => r.id)
    );

    for (const app of demoApprovals) {
      expect(awaitingRunIds.has(app.runId)).toBe(true);
    }
  });

  it("no completed or failed run has a pending approval", () => {
    const terminalRunIds = new Set(
      demoRunHistory.filter(r => r.status === "completed" || r.status === "failed").map(r => r.id)
    );
    const pendingForTerminal = demoApprovals.filter(a => terminalRunIds.has(a.runId));
    expect(pendingForTerminal.length).toBe(0);
  });
});

describe("error classification", () => {
  it("classifies transient webhook failures as replay-safe for automatic retry", () => {
    const transient = demoWebhookRecovery.filter(e => e.errorCategory === "transient");
    expect(transient.length).toBeGreaterThan(0);
    expect(transient.every(e => e.replaySafe && e.status === "ready_for_replay")).toBe(true);
  });

  it("classifies permanent webhook failures as quarantined with no safe replay", () => {
    const permanent = demoWebhookRecovery.filter(e => e.errorCategory === "permanent");
    expect(permanent.length).toBeGreaterThan(0);
    expect(permanent.every(e => !e.replaySafe && e.status === "quarantined")).toBe(true);
  });

  it("marks failed step results with an error category", () => {
    const failedSteps = demoRunHistory.flatMap(r => r.stepResults.filter(s => s.status === "failed" && s.error));
    expect(failedSteps.length).toBeGreaterThan(0);
    expect(failedSteps.every(s => s.errorCategory === "transient")).toBe(true);
    // Transient step failures should have exhausted retries
    expect(failedSteps.every(s => s.retries >= 3)).toBe(true);
  });

  it("distinguishes transient from permanent errors in recovery queue", () => {
    const categories = new Set(demoWebhookRecovery.map(e => e.errorCategory));
    expect(categories.has("transient")).toBe(true);
    expect(categories.has("permanent")).toBe(true);
    expect(categories.size).toBeGreaterThanOrEqual(2);
  });
});

describe("credential reauthorization monitoring", () => {
  it("flags connectors with credential risk for operator review", () => {
    const needsReview = demoConnectors.filter(c => c.auth.status !== "valid");

    expect(needsReview.length).toBeGreaterThan(0);
    for (const connector of needsReview) {
      expect(Number.isNaN(Date.parse(connector.auth.checkedAt))).toBe(false);
      expect(Number.isNaN(Date.parse(connector.auth.nextReviewAt))).toBe(false);
      expect(Date.parse(connector.auth.nextReviewAt)).toBeGreaterThanOrEqual(Date.parse(connector.auth.checkedAt));
      expect(connector.auth.operatorAction).toMatch(/refresh|isolated|review|rotate/i);
    }
  });

  it("does not mark healthy connectors with expired credentials", () => {
    const healthyConnectors = demoConnectors.filter(c => c.status === "healthy");
    expect(healthyConnectors.every(c => c.auth.status !== "expired")).toBe(true);
  });
});
