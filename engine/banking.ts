/**
 * BANKING — Financial Instruments & Property
 * ==================================================
 *
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  FULL RESERVE BANKING — NO FRACTIONAL RESERVE. EVER.        ║
 * ║                                                              ║
 * ║  A bank can ONLY lend gold it PHYSICALLY HOLDS in its vault. ║
 * ║  If the vault has 500 GP, the bank can lend at most 500 GP.  ║
 * ║  Deposits go INTO the vault. Loans come OUT of the vault.    ║
 * ║  The sum of all deposits must ALWAYS ≤ vault gold.           ║
 * ║  This is NOT a discoverable skill. This is a hard invariant. ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Services.ts has banking SERVICES (custody, loan, escrow...).
 * This file tracks the actual FINANCIAL STATE:
 *   - Bank vault: physical gold that backs ALL operations
 *   - Accounts: deposits, balances, interest
 *   - Loans: principal, interest, collateral, default
 *   - Property deeds: building/land ownership, collateral
 *   - Ledger: append-only transaction history (.tpb)
 *
 * Weekly tick:
 *   - Savings accounts accrue interest (ONLY from loan income in vault)
 *   - Loan payments are due (payments go back INTO vault)
 *   - Defaulted loans trigger collateral seizure
 *
 * Banks are service_providers from services.ts.
 * Bank accounts reference a provider (the bank) and an owner (polymorphic).
 */

// ============================================================
// BANK ACCOUNTS — Where money lives when not in your pouch
// ============================================================

export type AccountType = 'custody' | 'savings' | 'trade'

/** Interest rates by account type (per year, converted to weekly tick) */
export const ANNUAL_INTEREST_RATES: Record<AccountType, number> = {
  custody: 0,         // no interest, just safe storage
  savings: 0.05,      // 5% per year
  trade:   0.02,      // 2% per year (but allows letters of credit)
}

/** Fees by account type (per year) */
export const ANNUAL_FEES: Record<AccountType, number> = {
  custody: 0.01,      // 1% per year for storage
  savings: 0,         // no fee (bank profits from loan interest, NOT money creation)
  trade:   0.005,     // 0.5% per year + per-transaction fees
}

// ============================================================
// BANK VAULT — Physical gold backing. THE hard constraint.
// ============================================================

/**
 * The vault represents PHYSICAL GOLD a bank holds.
 * 
 * INVARIANT: totalDeposits + outstandingLoans ≤ vaultGP + loanedOutGP
 * In other words: every gold piece is accounted for.
 * The bank CANNOT create gold. Period.
 *
 * NEW GOLD enters the economy ONLY through:
 *   - Mining: a noble with a copper/silver/gold/platinum mine
 *     extracts ore → production-chain.ts → mints coins → vault deposit
 *   - Dungeon loot: adventurers bring treasure out
 *   - Trade surplus: foreign gold flows in via caravans
 *
 * There is NO mechanism for a bank to lend what it doesn't hold.
 * This is a hard physical constraint, not a policy.
 */
export interface BankVault {
  providerId: string
  /** Physical gold in the vault RIGHT NOW */
  vaultGP: number
  /** Total gold currently lent out (not in vault, but owed back) */
  loanedOutGP: number
  /** Total gold deposited by all account holders */
  totalDepositsGP: number
}

/** Create a new bank vault with starting capital */
export function createVault(providerId: string, startingCapitalGP: number): BankVault {
  return {
    providerId,
    vaultGP: startingCapitalGP,
    loanedOutGP: 0,
    totalDepositsGP: 0,
  }
}

/**
 * INVARIANT CHECK: Can the bank lend this amount?
 * FULL RESERVE: bank can only lend gold that is physically in the vault.
 * NO FRACTIONAL RESERVE. EVER.
 */
export function canLend(vault: BankVault, amount: number): boolean {
  return vault.vaultGP >= amount
}

export interface BankAccount {
  id: string
  providerId: string    // which bank (service_provider)
  ownerId: string       // polymorphic: character, npc, party, household, guild
  ownerType: 'character' | 'npc' | 'party' | 'household' | 'guild' | 'faction' | 'settlement' | 'trading_company'
  accountType: AccountType
  balanceGP: number     // current balance in gold pieces
  interestRate: number  // effective annual interest rate
  feeRate: number       // effective annual fee rate
  openedDay: number     // world day when account was opened
  frozen: boolean       // can be frozen by faction law or war
}

export function createAccount(
  providerId: string,
  ownerId: string,
  ownerType: BankAccount['ownerType'],
  accountType: AccountType,
  initialDeposit: number,
  worldDay: number,
): BankAccount {
  return {
    id: `acct_${providerId}_${ownerId}_${Date.now()}`,
    providerId,
    ownerId,
    ownerType,
    accountType,
    balanceGP: initialDeposit,
    interestRate: ANNUAL_INTEREST_RATES[accountType],
    feeRate: ANNUAL_FEES[accountType],
    openedDay: worldDay,
    frozen: false,
  }
}

// ============================================================
// LOANS — Borrowing with consequences
// ============================================================

export type LoanStatus = 'active' | 'paid' | 'defaulted' | 'restructured'
export type CollateralType = 'none' | 'property' | 'inventory' | 'title' | 'guild_share'

export interface Loan {
  id: string
  accountId: string          // borrower's bank account
  providerId: string         // lending bank
  principal: number          // original amount borrowed (GP)
  remainingPrincipal: number // how much is still owed
  interestRate: number       // annual rate (typically 8-20%)
  termWeeks: number          // total loan term
  weeksRemaining: number     // weeks until due
  weeklyPayment: number      // calculated payment per week
  collateralType: CollateralType
  collateralId?: string      // property_deed.id, inventory.id, etc.
  status: LoanStatus
  missedPayments: number     // consecutive missed payments
  issuedDay: number          // world day
}

/**
 * Calculate weekly payment for a loan.
 * Simple amortization: total owed / term weeks.
 */
export function calculateWeeklyPayment(principal: number, annualRate: number, termWeeks: number): number {
  const totalInterest = principal * annualRate * (termWeeks / 52)
  return (principal + totalInterest) / termWeeks
}

/**
 * Issue a new loan.
 * FULL RESERVE: The bank must have the gold PHYSICALLY IN THE VAULT.
 * Loan gold comes OUT of the vault and INTO the borrower's account.
 * Returns null if vault has insufficient gold.
 */
export function issueLoan(
  vault: BankVault,
  bankAccount: BankAccount,
  providerId: string,
  principal: number,
  annualRate: number,
  termWeeks: number,
  collateralType: CollateralType,
  collateralId: string | undefined,
  worldDay: number,
): Loan | null {
  if (principal <= 0 || termWeeks <= 0) return null

  // ══════════════════════════════════════════════════
  // FULL RESERVE CHECK — This is the hard constraint.
  // The bank CANNOT lend gold it does not PHYSICALLY HOLD.
  // ══════════════════════════════════════════════════
  if (!canLend(vault, principal)) return null

  const weeklyPayment = calculateWeeklyPayment(principal, annualRate, termWeeks)

  // Gold physically leaves the vault → goes to borrower
  vault.vaultGP -= principal
  vault.loanedOutGP += principal
  bankAccount.balanceGP += principal

  return {
    id: `loan_${bankAccount.id}_${Date.now()}`,
    accountId: bankAccount.id,
    providerId,
    principal,
    remainingPrincipal: principal,
    interestRate: annualRate,
    termWeeks,
    weeksRemaining: termWeeks,
    weeklyPayment,
    collateralType,
    collateralId,
    status: 'active',
    missedPayments: 0,
    issuedDay: worldDay,
  }
}

// ============================================================
// PROPERTY DEEDS — Ownership of land and buildings
// ============================================================

export type PropertyType = 'building' | 'land' | 'edge_segment'

export interface PropertyDeed {
  id: string
  ownerId: string
  ownerType: 'character' | 'npc' | 'party' | 'household' | 'guild' | 'faction' | 'trading_company'
  nodeId: string           // .tp node (building, land plot, edge segment)
  propertyType: PropertyType
  acquiredDay: number
  /** Is this deed pledged as loan collateral? */
  pledgedAsCollateral: boolean
  /** Appraised value in GP */
  appraisedValueGP: number
}

/**
 * Transfer deed ownership. Returns false if pledged as collateral.
 */
export function transferDeed(
  deed: PropertyDeed,
  newOwnerId: string,
  newOwnerType: PropertyDeed['ownerType'],
  worldDay: number,
): boolean {
  if (deed.pledgedAsCollateral) return false
  deed.ownerId = newOwnerId
  deed.ownerType = newOwnerType
  deed.acquiredDay = worldDay
  return true
}

// ============================================================
// LEDGER — Append-only transaction history (.tpb)
// ============================================================

export type LedgerEntryType =
  | 'deposit' | 'withdrawal' | 'interest' | 'fee'
  | 'loan_disbursement' | 'loan_payment' | 'loan_default'
  | 'transfer' | 'seizure'

export interface LedgerEntry {
  id: string
  accountId: string
  worldDay: number
  entryType: LedgerEntryType
  amountGP: number          // positive = credit, negative = debit
  balanceAfter: number      // running balance
  description: string
  relatedId?: string        // loan ID, deed ID, etc.
}

let _ledgerSeq = 0

function createLedgerEntry(
  account: BankAccount,
  worldDay: number,
  entryType: LedgerEntryType,
  amountGP: number,
  description: string,
  relatedId?: string,
): LedgerEntry {
  const entry: LedgerEntry = {
    id: `led_${++_ledgerSeq}`,
    accountId: account.id,
    worldDay,
    entryType,
    amountGP,
    balanceAfter: account.balanceGP,
    description,
    relatedId,
  }
  return entry
}

/** Reset ledger sequence (for tests) */
export function resetLedgerSeq(): void { _ledgerSeq = 0 }

// ============================================================
// BANKING OPERATIONS — Deposit, Withdraw, Pay
// ============================================================

export interface TransactionResult {
  success: boolean
  reason?: string
  entry?: LedgerEntry
}

export function deposit(
  account: BankAccount,
  amountGP: number,
  worldDay: number,
): TransactionResult {
  if (account.frozen) return { success: false, reason: 'Account frozen' }
  if (amountGP <= 0) return { success: false, reason: 'Invalid amount' }

  account.balanceGP += amountGP
  const entry = createLedgerEntry(account, worldDay, 'deposit', amountGP, `Deposit ${amountGP} GP`)
  return { success: true, entry }
}

export function withdraw(
  account: BankAccount,
  amountGP: number,
  worldDay: number,
): TransactionResult {
  if (account.frozen) return { success: false, reason: 'Account frozen' }
  if (amountGP <= 0) return { success: false, reason: 'Invalid amount' }
  if (account.balanceGP < amountGP) return { success: false, reason: 'Insufficient funds' }

  account.balanceGP -= amountGP
  const entry = createLedgerEntry(account, worldDay, 'withdrawal', -amountGP, `Withdrawal ${amountGP} GP`)
  return { success: true, entry }
}

/**
 * Process a loan payment. Reduces remaining principal.
 */
export function makeLoanPayment(
  account: BankAccount,
  loan: Loan,
  worldDay: number,
): TransactionResult {
  if (loan.status !== 'active') return { success: false, reason: 'Loan not active' }
  if (account.frozen) return { success: false, reason: 'Account frozen' }

  const payment = loan.weeklyPayment

  if (account.balanceGP < payment) {
    // Missed payment
    loan.missedPayments++
    if (loan.missedPayments >= 4) {
      loan.status = 'defaulted'
    }
    return { success: false, reason: 'Insufficient funds for payment' }
  }

  account.balanceGP -= payment
  loan.remainingPrincipal = Math.max(0, loan.remainingPrincipal - (payment - loan.remainingPrincipal * loan.interestRate / 52))
  loan.weeksRemaining--
  loan.missedPayments = 0

  if (loan.weeksRemaining <= 0 || loan.remainingPrincipal <= 0) {
    loan.status = 'paid'
    loan.remainingPrincipal = 0
  }

  const entry = createLedgerEntry(
    account, worldDay, 'loan_payment', -payment,
    `Loan payment: ${payment.toFixed(2)} GP (${loan.weeksRemaining} weeks remaining)`,
    loan.id,
  )
  return { success: true, entry }
}

// ============================================================
// WEEKLY BANKING TICK
// ============================================================

export interface BankingTickResult {
  accountId: string
  interestEarned: number
  feesCharged: number
  loanPaymentsMade: number
  loanPaymentsMissed: number
  loansDefaulted: string[]
  entries: LedgerEntry[]
}

/**
 * Weekly banking tick for one account + its loans.
 * 1. Accrue interest on savings
 * 2. Charge fees
 * 3. Process loan payments
 * 4. Check for defaults
 */
export function weeklyBankingTick(
  account: BankAccount,
  loans: Loan[],
  worldDay: number,
): BankingTickResult {
  const entries: LedgerEntry[] = []
  const result: BankingTickResult = {
    accountId: account.id,
    interestEarned: 0,
    feesCharged: 0,
    loanPaymentsMade: 0,
    loanPaymentsMissed: 0,
    loansDefaulted: [],
    entries,
  }

  if (account.frozen) return result

  // 1. Interest (weekly = annual / 52)
  if (account.interestRate > 0 && account.balanceGP > 0) {
    const weeklyInterest = account.balanceGP * account.interestRate / 52
    account.balanceGP += weeklyInterest
    result.interestEarned = weeklyInterest
    entries.push(createLedgerEntry(
      account, worldDay, 'interest', weeklyInterest,
      `Interest: ${weeklyInterest.toFixed(4)} GP @ ${(account.interestRate * 100).toFixed(1)}%/yr`,
    ))
  }

  // 2. Fees (weekly = annual / 52)
  if (account.feeRate > 0 && account.balanceGP > 0) {
    const weeklyFee = account.balanceGP * account.feeRate / 52
    account.balanceGP -= weeklyFee
    result.feesCharged = weeklyFee
    entries.push(createLedgerEntry(
      account, worldDay, 'fee', -weeklyFee,
      `Account fee: ${weeklyFee.toFixed(4)} GP`,
    ))
  }

  // 3. Loan payments
  const activeLoans = loans.filter(l => l.accountId === account.id && l.status === 'active')
  for (const loan of activeLoans) {
    const payResult = makeLoanPayment(account, loan, worldDay)
    if (payResult.success) {
      result.loanPaymentsMade++
      if (payResult.entry) entries.push(payResult.entry)
    } else {
      result.loanPaymentsMissed++
      if (loan.status === 'defaulted') {
        result.loansDefaulted.push(loan.id)
        entries.push(createLedgerEntry(
          account, worldDay, 'loan_default', 0,
          `LOAN DEFAULTED: ${loan.id} — collateral seizure pending`,
          loan.id,
        ))
      }
    }
  }

  return result
}
