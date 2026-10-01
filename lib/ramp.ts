import type { DB } from "./seed";
import { round2 } from "./seed";

/** Mirrors Ramp agent tools: issue_one_off_funds, get_funds, get_agent_card_creds, transactions, answer_policy_question. */
export type RampFund = { id: string; name: string; limit: number; interval: "monthly"; spent: number; categories: string[]; merchants: string[]; locked: boolean };
export type RampTx = { id: string; fundId: string; merchant: string; amount: number; at: string; memo: string; receiptAttached: boolean; accountingCategory: string };

export interface RampAdapter {
  mode: "mock" | "sandbox";
  getFunds(): Promise<RampFund[]>;
  issueOneOffFunds(args: { name: string; amount: number; rationale: string }): Promise<RampFund>;
  getAgentCardCreds(args: { fundId: string; merchant: string; amount: number; rationale: string }): Promise<{ token: string; last4: string; expiresInSec: number }>;
  purchase(args: { fundId: string; merchant: string; amount: number; memo: string; rationale: string }): Promise<RampTx>;
  listTransactions(fundId: string): Promise<RampTx[]>;
  answerPolicyQuestion(q: string): Promise<{ allowed: boolean; reason: string }>;
}

class MockRamp implements RampAdapter {
  mode = "mock" as const;
  fund: RampFund;
  txs: RampTx[] = [];
  constructor(db: DB) {
    this.fund = { id: db.office.rampFundId!, name: "Office Snacks", limit: db.office.monthlyBudget, interval: "monthly", spent: 0,
      categories: ["Groceries", "Food & Beverage"], merchants: ["Amazon Business", "Costco", "Instacart Business", "Local Wholesale"], locked: false };
  }
  async getFunds() { return [this.fund]; }
  async issueOneOffFunds(a: { name: string; amount: number }) { this.fund = { ...this.fund, name: a.name, limit: a.amount }; return this.fund; }
  async getAgentCardCreds(a: { amount: number }) {
    if (this.fund.spent + a.amount > this.fund.limit) throw new Error("Exceeds fund balance");
    return { token: `tok_mock_${Math.random().toString(36).slice(2, 10)}`, last4: String(1000 + Math.floor(Math.random() * 8999)), expiresInSec: 600 };
  }
  async purchase(a: { fundId: string; merchant: string; amount: number; memo: string }) {
    await this.getAgentCardCreds(a as never);
    const tx: RampTx = { id: `txn_${Math.random().toString(36).slice(2, 10)}`, fundId: a.fundId, merchant: a.merchant, amount: round2(a.amount), at: new Date().toISOString(), memo: a.memo, receiptAttached: true, accountingCategory: "Office Snacks & Meals" };
    this.txs.unshift(tx);
    this.fund.spent = round2(this.fund.spent + a.amount);
    return tx;
  }
  async listTransactions() { return this.txs; }
  async answerPolicyQuestion(q: string) {
    const banned = /(alcohol|beer|wine|liquor|gift card|cigar|vape)/i.exec(q);
    return banned ? { allowed: false, reason: `"${banned[1]}" is outside the Groceries / Food & Beverage categories on the Office Snacks fund.` }
      : { allowed: true, reason: "Food & beverage for the office pantry is allowed on the Office Snacks fund from approved merchants." };
  }
}

export function createRamp(db: DB): RampAdapter {
  // SandboxRamp (demo-api.ramp.com, OAuth client credentials) would slot in here when RAMP_MODE=sandbox.
  return new MockRamp(db);
}
