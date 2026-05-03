/**
 * MM_BANKING — Layer 2 ISimulatedMM adapter for banking.ts
 * ============================================================
 *
 * One MMBanking per BankVault (i.e. per bank branch). Lives at the
 * settlement node, registered as an entity (`type='bank'`). Ticks
 * weekly. Each resolve folds N weeks of `weeklyBankingTick` over every
 * account at the bank:
 *
 *   For each account:
 *     - Accrue interest (weekly = annual/52)
 *     - Charge fees
 *     - Process loan payments → may default loans (defaulted loans
 *       expose collateral for seizure, handled by social system)
 *
 * Faction ownership: every bank has a `factionOwnerId` — the faction
 * that owns the charter (Banking Family, Merchant Guild, Crown Mint,
 * Church Treasury, etc). Faction-owned vaults are how "global" banks
 * exist: a Banking Family with branches across continents shares
 * bullion across the network.
 *
 * Currency: every vault denominates its gold in a single CurrencySystem
 * (referenced by `currencyId`). Inter-bank transfers across kingdoms
 * convert via MMCurrency.getRate + currency.convertCurrency.
 *
 * Bullion transport: shipBullion(toBankId, amount) immediately deducts
 * from this vault and creates a `BullionShipment` record. The shipment
 * is `staged` until a caravan picks it up — that wiring lands when
 * MMCaravan ships next push. For now MMBanking just stages and tracks.
 *
 * Cadence: weekly. Layer: 2 (ECONOMY).
 */

import {
  SimulatedMMBase,
  type PendingDelta,
} from './mm-simulated'
import {
  weeklyBankingTick,
  type BankVault,
  type BankAccount,
  type Loan,
  type BankingTickResult,
} from './banking'
import type { TP } from './tp'

// ============================================================
// BULLION SHIPMENT — uncoined gold in transit between vaults
// ============================================================

export type BullionShipmentStatus = 'staged' | 'in_transit' | 'delivered' | 'lost'

export interface BullionShipment {
  id: string
  fromBankId: string
  toBankId: string
  /** Amount in gold pieces (denominated in the source vault's currency). */
  amount: number
  /** Source currency id — destination converts on receipt. */
  currencyId: string
  status: BullionShipmentStatus
  stagedDay: number
  /** Edge id along which the bullion travels. Null until a caravan picks it up. */
  edgeId?: string
  /** Caravan entity id carrying the bullion. Null until pickup. */
  caravanId?: string
  /** Day delivered (if status === 'delivered'). */
  deliveredDay?: number
  /** Why it was lost (if status === 'lost') — bandits, sea storm, embezzlement. */
  lossReason?: string
}

let _shipmentSeq = 0
export function resetShipmentIdCounter(): void { _shipmentSeq = 0 }

function newShipmentId(): string {
  return `bullion_${++_shipmentSeq}`
}

// ============================================================
// MM_BANKING
// ============================================================

export interface MMBankingDomainState {
  vault: BankVault
  accounts: BankAccount[]
  loans: Loan[]
  /** Faction that owns the charter. */
  factionOwnerId: string
  /** CurrencySystem id this vault denominates in. */
  currencyId: string
  /** Active shipments out of this vault (any status). */
  pendingShipments: BullionShipment[]
  /** Cumulative tick stats. */
  cumulative: {
    weeksTicked: number
    interestPaid: number
    feesCollected: number
    loanPaymentsMade: number
    loansDefaulted: number
  }
  /** Last week's tick results (per account). */
  lastTickResults: BankingTickResult[]
}

export interface MMBankingOptions {
  name?: string
}

/** Stable entity id used in the TP entity registry. */
export function bankEntityId(vault: BankVault): string {
  return `bank:${vault.providerId}`
}

export class MMBanking extends SimulatedMMBase {
  domain: MMBankingDomainState

  constructor(
    nodeId: string,
    vault: BankVault,
    factionOwnerId: string,
    currencyId: string,
    accounts: BankAccount[] = [],
    loans: Loan[] = [],
    worldDay: number = 0,
    opts: MMBankingOptions = {},
  ) {
    super(bankEntityId(vault), opts.name ?? `Bank:${vault.providerId}`,
          nodeId, 'banking', worldDay)
    this.domain = {
      vault,
      accounts,
      loans,
      factionOwnerId,
      currencyId,
      pendingShipments: [],
      cumulative: {
        weeksTicked: 0,
        interestPaid: 0,
        feesCollected: 0,
        loanPaymentsMade: 0,
        loansDefaulted: 0,
      },
      lastTickResults: [],
    }
  }

  /** Register this bank as an entity at its node so TP queries find it. */
  registerWith(tp: TP): void {
    tp.registerEntity({
      id: this.state.id,
      type: 'bank',
      position: { type: 'at_node', nodeId: this.state.nodeId },
    })
  }

  protected onAccumulate(_days: number, _worldDay: number, _tp?: TP): void {
    // O(1). Interest, fees, loan payments all run inside resolve.
  }

  protected onResolve(daysResolved: number, worldDay: number, tp?: TP): {
    stateChanges: Record<string, number>
    narrative: string
    additionalEvents: PendingDelta['pendingEvents']
  } {
    const weeks = Math.floor(daysResolved / 7)
    if (weeks === 0) {
      return {
        stateChanges: { weeksTicked: 0 },
        narrative: `${this.state.name} (${daysResolved}d): less than a week — no banking.`,
        additionalEvents: [],
      }
    }

    let totalInterest = 0
    let totalFees = 0
    let totalPayments = 0
    let totalDefaults = 0
    let lastResults: BankingTickResult[] = []

    for (let w = 0; w < weeks; w++) {
      const dayOfTick = worldDay + (w + 1) * 7
      const weekResults: BankingTickResult[] = []
      for (const account of this.domain.accounts) {
        const r = weeklyBankingTick(account, this.domain.loans, dayOfTick)
        weekResults.push(r)
        totalInterest += r.interestEarned
        totalFees += r.feesCharged
        totalPayments += r.loanPaymentsMade
        totalDefaults += r.loansDefaulted.length
      }
      lastResults = weekResults
    }

    this.domain.cumulative.weeksTicked += weeks
    this.domain.cumulative.interestPaid += totalInterest
    this.domain.cumulative.feesCollected += totalFees
    this.domain.cumulative.loanPaymentsMade += totalPayments
    this.domain.cumulative.loansDefaulted += totalDefaults
    this.domain.lastTickResults = lastResults

    // Recompute totalDepositsGP from current account balances.
    this.domain.vault.totalDepositsGP = this.domain.accounts.reduce(
      (sum, a) => sum + a.balanceGP, 0,
    )

    // Write summary κ — bank activity at the settlement.
    if (tp) {
      tp.writeDomain(this.state.nodeId, 'economy', {
        // Squeeze bank summary into commodities under a special key so it
        // shows up in resolve() without needing a new domain.
        // (A 'banking' subdomain would be cleaner once schema accepts it;
        // for v1 this keeps the κ layout flat.)
      })
    }

    const narrative =
      `${this.state.name} (${daysResolved}d, ${weeks} wk): ` +
      `vault ${this.domain.vault.vaultGP.toFixed(0)} gp, ` +
      `${this.domain.accounts.length} accts, ` +
      `interest ${totalInterest.toFixed(2)} gp, ` +
      `fees ${totalFees.toFixed(2)} gp, ` +
      `${totalPayments} loan pmts` +
      (totalDefaults > 0 ? `, ${totalDefaults} DEFAULTED` : '') +
      `.`

    return {
      stateChanges: {
        weeksTicked: weeks,
        interestPaid: totalInterest,
        feesCollected: totalFees,
        loanPaymentsMade: totalPayments,
        loansDefaulted: totalDefaults,
        vaultGP: this.domain.vault.vaultGP,
      },
      narrative,
      additionalEvents: [],
    }
  }

  protected getDomainState(): MMBankingDomainState {
    return {
      vault: { ...this.domain.vault },
      accounts: this.domain.accounts.map(a => ({ ...a })),
      loans: this.domain.loans.map(l => ({ ...l })),
      factionOwnerId: this.domain.factionOwnerId,
      currencyId: this.domain.currencyId,
      pendingShipments: this.domain.pendingShipments.map(s => ({ ...s })),
      cumulative: { ...this.domain.cumulative },
      lastTickResults: this.domain.lastTickResults.map(r => ({ ...r })),
    }
  }

  // ── Slow-life-friendly accessors ──

  getVault(): BankVault {
    return { ...this.domain.vault }
  }
  getFactionOwner(): string {
    return this.domain.factionOwnerId
  }
  getCurrencyId(): string {
    return this.domain.currencyId
  }
  getAccount(accountId: string): BankAccount | undefined {
    return this.domain.accounts.find(a => a.id === accountId)
  }

  // ── Bullion transport (caravan hook) ──

  /**
   * Stage a bullion shipment from this vault to another bank. Deducts
   * the amount from `vault.vaultGP` immediately (the gold leaves the
   * vault as it's loaded into crates). The shipment sits `staged`
   * until a caravan picks it up — that wiring lands when MMCaravan
   * ships next push.
   *
   * Returns the shipment record. Null on insufficient vault.
   *
   * Slow-life note: this is the "caravan carrying uncoined gold"
   * primitive the user spec'd. Adventurer-guild quest hooks ("escort
   * the bullion shipment from Suzail to Waterdeep") read these
   * shipments later when the guild map lands.
   */
  shipBullion(
    toBankId: string,
    amount: number,
    worldDay: number,
  ): BullionShipment | null {
    if (amount <= 0) return null
    if (this.domain.vault.vaultGP < amount) return null

    this.domain.vault.vaultGP -= amount

    const shipment: BullionShipment = {
      id: newShipmentId(),
      fromBankId: this.state.id,
      toBankId,
      amount,
      currencyId: this.domain.currencyId,
      status: 'staged',
      stagedDay: worldDay,
    }
    this.domain.pendingShipments.push(shipment)
    return shipment
  }

  /**
   * Caravan picks up a staged shipment for transport. Marks status
   * `in_transit`, attaches edgeId + caravanId. Called by the caravan
   * system when MMCaravan lands.
   */
  markShipmentInTransit(shipmentId: string, edgeId: string, caravanId: string): boolean {
    const s = this.domain.pendingShipments.find(s => s.id === shipmentId)
    if (!s || s.status !== 'staged') return false
    s.status = 'in_transit'
    s.edgeId = edgeId
    s.caravanId = caravanId
    return true
  }

  /**
   * Receive an inbound bullion shipment from another bank. Adds to the
   * destination's vault (after currency conversion if needed — caller
   * passes `convertedAmount` so the math stays in this MM's currency).
   * Returns the shipment so the source MM can mark it 'delivered'.
   */
  receiveBullion(
    shipmentId: string,
    fromBankId: string,
    convertedAmount: number,
    worldDay: number,
  ): { shipment: BullionShipment; newVaultGP: number } {
    this.domain.vault.vaultGP += convertedAmount
    const shipment: BullionShipment = {
      id: shipmentId,
      fromBankId,
      toBankId: this.state.id,
      amount: convertedAmount,
      currencyId: this.domain.currencyId,
      status: 'delivered',
      stagedDay: 0,
      deliveredDay: worldDay,
    }
    return { shipment, newVaultGP: this.domain.vault.vaultGP }
  }

  /** Source-side: mark a shipment as delivered (after destination receives). */
  markShipmentDelivered(shipmentId: string, worldDay: number): boolean {
    const s = this.domain.pendingShipments.find(s => s.id === shipmentId)
    if (!s) return false
    s.status = 'delivered'
    s.deliveredDay = worldDay
    return true
  }

  /** Source-side: mark a shipment as lost (bandits, storm, embezzlement). */
  markShipmentLost(shipmentId: string, reason: string): boolean {
    const s = this.domain.pendingShipments.find(s => s.id === shipmentId)
    if (!s || s.status === 'delivered') return false
    s.status = 'lost'
    s.lossReason = reason
    return true
  }

  /** All staged or in-transit shipments. Useful for the caravan system. */
  getPendingShipments(): BullionShipment[] {
    return this.domain.pendingShipments.filter(
      s => s.status === 'staged' || s.status === 'in_transit',
    )
  }
}
