import { describe, it, expect, beforeEach } from 'vitest'
import {
  createAccount,
  createVault,
  canLend,
  issueLoan,
  deposit,
  withdraw,
  makeLoanPayment,
  transferDeed,
  weeklyBankingTick,
  calculateWeeklyPayment,
  resetLedgerSeq,
  ANNUAL_INTEREST_RATES,
  ANNUAL_FEES,
  type BankAccount,
  type BankVault,
  type Loan,
  type PropertyDeed,
} from '../banking'

function makeVault(gp = 10000): BankVault {
  return createVault('bank_1', gp)
}

function makeAccount(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    id: 'acct_1',
    providerId: 'bank_1',
    ownerId: 'char_1',
    ownerType: 'character',
    accountType: 'savings',
    balanceGP: 100,
    interestRate: ANNUAL_INTEREST_RATES.savings,
    feeRate: ANNUAL_FEES.savings,
    openedDay: 1,
    frozen: false,
    ...overrides,
  }
}

function makeDeed(overrides: Partial<PropertyDeed> = {}): PropertyDeed {
  return {
    id: 'deed_1',
    ownerId: 'char_1',
    ownerType: 'character',
    nodeId: 'building_1',
    propertyType: 'building',
    acquiredDay: 1,
    pledgedAsCollateral: false,
    appraisedValueGP: 5000,
    ...overrides,
  }
}

describe('Banking Engine', () => {
  beforeEach(() => {
    resetLedgerSeq()
  })

  // ──────────────────────────────────────
  // FULL RESERVE — THE HARD INVARIANT
  // ──────────────────────────────────────

  describe('Full Reserve Banking', () => {
    it('vault starts with starting capital', () => {
      const v = makeVault(5000)
      expect(v.vaultGP).toBe(5000)
      expect(v.loanedOutGP).toBe(0)
      expect(v.totalDepositsGP).toBe(0)
    })

    it('can lend up to vault amount', () => {
      const v = makeVault(500)
      expect(canLend(v, 500)).toBe(true)
      expect(canLend(v, 501)).toBe(false)
    })

    it('CANNOT lend more than vault holds', () => {
      const v = makeVault(100)
      expect(canLend(v, 200)).toBe(false)
    })

    it('loan reduces vault, increases loanedOut', () => {
      const v = makeVault(1000)
      const acct = makeAccount({ balanceGP: 0 })
      const loan = issueLoan(v, acct, 'bank_1', 500, 0.1, 52, 'none', undefined, 1)
      expect(loan).not.toBeNull()
      expect(v.vaultGP).toBe(500)   // 1000 - 500
      expect(v.loanedOutGP).toBe(500)
      expect(acct.balanceGP).toBe(500) // borrower got the gold
    })

    it('second loan fails if vault exhausted', () => {
      const v = makeVault(500)
      const acct = makeAccount({ balanceGP: 0 })
      issueLoan(v, acct, 'bank_1', 500, 0.1, 52, 'none', undefined, 1)
      // Vault is now 0
      const loan2 = issueLoan(v, acct, 'bank_1', 1, 0.1, 52, 'none', undefined, 1)
      expect(loan2).toBeNull() // CANNOT lend what you don't have
    })

    it('NEVER allows fractional reserve — multiple depositors', () => {
      const v = makeVault(1000) // bank has 1000 GP starting capital
      const acct1 = makeAccount({ id: 'a1', balanceGP: 0 })
      const acct2 = makeAccount({ id: 'a2', balanceGP: 0 })

      // Lend 800 to first borrower — vault has 200 left
      const loan1 = issueLoan(v, acct1, 'bank_1', 800, 0.1, 52, 'none', undefined, 1)
      expect(loan1).not.toBeNull()
      expect(v.vaultGP).toBe(200)

      // Try to lend 300 to second borrower — MUST FAIL
      const loan2 = issueLoan(v, acct2, 'bank_1', 300, 0.1, 52, 'none', undefined, 1)
      expect(loan2).toBeNull()

      // Can only lend remaining 200
      const loan3 = issueLoan(v, acct2, 'bank_1', 200, 0.1, 52, 'none', undefined, 1)
      expect(loan3).not.toBeNull()
      expect(v.vaultGP).toBe(0) // vault completely empty now
    })
  })

  // ──────────────────────────────────────
  // ACCOUNTS
  // ──────────────────────────────────────

  describe('Accounts', () => {
    it('creates account with correct rates', () => {
      const a = createAccount('bank_1', 'char_1', 'character', 'savings', 100, 1)
      expect(a.balanceGP).toBe(100)
      expect(a.interestRate).toBe(0.05)
      expect(a.feeRate).toBe(0)
    })

    it('custody has fee but no interest', () => {
      const a = createAccount('bank_1', 'char_1', 'character', 'custody', 100, 1)
      expect(a.interestRate).toBe(0)
      expect(a.feeRate).toBe(0.01)
    })

    it('trade has low interest and low fee', () => {
      const a = createAccount('bank_1', 'char_1', 'character', 'trade', 100, 1)
      expect(a.interestRate).toBe(0.02)
      expect(a.feeRate).toBe(0.005)
    })
  })

  // ──────────────────────────────────────
  // DEPOSITS & WITHDRAWALS
  // ──────────────────────────────────────

  describe('Deposits & Withdrawals', () => {
    it('deposits increase balance', () => {
      const a = makeAccount({ balanceGP: 100 })
      const r = deposit(a, 50, 1)
      expect(r.success).toBe(true)
      expect(a.balanceGP).toBe(150)
      expect(r.entry!.amountGP).toBe(50)
    })

    it('withdrawals decrease balance', () => {
      const a = makeAccount({ balanceGP: 100 })
      const r = withdraw(a, 30, 1)
      expect(r.success).toBe(true)
      expect(a.balanceGP).toBe(70)
    })

    it('cannot withdraw more than balance', () => {
      const a = makeAccount({ balanceGP: 100 })
      const r = withdraw(a, 200, 1)
      expect(r.success).toBe(false)
      expect(r.reason).toContain('Insufficient')
    })

    it('frozen accounts reject operations', () => {
      const a = makeAccount({ frozen: true })
      expect(deposit(a, 50, 1).success).toBe(false)
      expect(withdraw(a, 50, 1).success).toBe(false)
    })

    it('invalid amounts rejected', () => {
      const a = makeAccount()
      expect(deposit(a, 0, 1).success).toBe(false)
      expect(deposit(a, -10, 1).success).toBe(false)
    })

    it('ledger entries track balance after', () => {
      const a = makeAccount({ balanceGP: 100 })
      deposit(a, 50, 1)
      const r = deposit(a, 25, 2)
      expect(r.entry!.balanceAfter).toBe(175)
    })
  })

  // ──────────────────────────────────────
  // LOANS
  // ──────────────────────────────────────

  describe('Loans', () => {
    it('calculates weekly payment', () => {
      // 100 GP at 10% for 52 weeks
      // Total interest = 100 * 0.1 * 1 = 10
      // Weekly = 110 / 52 ≈ 2.115
      const payment = calculateWeeklyPayment(100, 0.1, 52)
      expect(payment).toBeCloseTo(2.115, 2)
    })

    it('rejects zero/negative principal', () => {
      const v = makeVault()
      const a = makeAccount()
      expect(issueLoan(v, a, 'b', 0, 0.1, 52, 'none', undefined, 1)).toBeNull()
      expect(issueLoan(v, a, 'b', -100, 0.1, 52, 'none', undefined, 1)).toBeNull()
    })

    it('loan payment reduces remaining principal', () => {
      const v = makeVault()
      const a = makeAccount({ balanceGP: 1000 })
      const loan = issueLoan(v, a, 'b', 100, 0.1, 52, 'none', undefined, 1)!
      const prevPrincipal = loan.remainingPrincipal
      makeLoanPayment(a, loan, 2)
      expect(loan.remainingPrincipal).toBeLessThan(prevPrincipal)
      expect(loan.weeksRemaining).toBe(51)
    })

    it('missed payment increments counter', () => {
      const v = makeVault()
      const a = makeAccount({ balanceGP: 0 })
      const loan = issueLoan(v, a, 'b', 100, 0.1, 52, 'none', undefined, 1)!
      // Borrower got 100 but let's say they spent it
      a.balanceGP = 0
      const r = makeLoanPayment(a, loan, 2)
      expect(r.success).toBe(false)
      expect(loan.missedPayments).toBe(1)
    })

    it('4 missed payments = default', () => {
      const v = makeVault()
      const a = makeAccount({ balanceGP: 0 })
      const loan = issueLoan(v, a, 'b', 100, 0.1, 52, 'none', undefined, 1)!
      a.balanceGP = 0
      for (let i = 0; i < 4; i++) makeLoanPayment(a, loan, i + 2)
      expect(loan.status).toBe('defaulted')
    })

    it('loan with collateral tracks collateral id', () => {
      const v = makeVault()
      const a = makeAccount()
      const loan = issueLoan(v, a, 'b', 100, 0.1, 52, 'property', 'deed_1', 1)!
      expect(loan.collateralType).toBe('property')
      expect(loan.collateralId).toBe('deed_1')
    })
  })

  // ──────────────────────────────────────
  // PROPERTY DEEDS
  // ──────────────────────────────────────

  describe('Property Deeds', () => {
    it('transfers ownership', () => {
      const d = makeDeed()
      const result = transferDeed(d, 'char_2', 'character', 10)
      expect(result).toBe(true)
      expect(d.ownerId).toBe('char_2')
      expect(d.acquiredDay).toBe(10)
    })

    it('blocks transfer if pledged as collateral', () => {
      const d = makeDeed({ pledgedAsCollateral: true })
      const result = transferDeed(d, 'char_2', 'character', 10)
      expect(result).toBe(false)
      expect(d.ownerId).toBe('char_1') // unchanged
    })
  })

  // ──────────────────────────────────────
  // WEEKLY TICK
  // ──────────────────────────────────────

  describe('Weekly Banking Tick', () => {
    it('accrues interest on savings', () => {
      const a = makeAccount({ balanceGP: 1000, interestRate: 0.05 })
      const result = weeklyBankingTick(a, [], 2)
      expect(result.interestEarned).toBeCloseTo(1000 * 0.05 / 52, 4)
      expect(a.balanceGP).toBeGreaterThan(1000)
    })

    it('charges fees on custody', () => {
      const a = makeAccount({ balanceGP: 1000, accountType: 'custody', interestRate: 0, feeRate: 0.01 })
      const result = weeklyBankingTick(a, [], 2)
      expect(result.feesCharged).toBeCloseTo(1000 * 0.01 / 52, 4)
      expect(a.balanceGP).toBeLessThan(1000)
    })

    it('processes loan payments', () => {
      const v = makeVault()
      const a = makeAccount({ balanceGP: 5000, interestRate: 0, feeRate: 0 })
      const loan = issueLoan(v, a, 'b', 1000, 0.1, 52, 'none', undefined, 1)!
      const result = weeklyBankingTick(a, [loan], 2)
      expect(result.loanPaymentsMade).toBe(1)
      expect(result.entries.length).toBeGreaterThan(0)
    })

    it('detects loan defaults in tick', () => {
      const v = makeVault()
      const a = makeAccount({ balanceGP: 0, interestRate: 0, feeRate: 0 })
      const loan = issueLoan(v, a, 'b', 100, 0.1, 52, 'none', undefined, 1)!
      a.balanceGP = 0

      // Miss 3 payments
      for (let i = 0; i < 3; i++) weeklyBankingTick(a, [loan], i + 2)
      expect(loan.status).toBe('active')

      // 4th miss = default
      const result = weeklyBankingTick(a, [loan], 5)
      expect(result.loansDefaulted).toHaveLength(1)
      expect(loan.status).toBe('defaulted')
    })

    it('frozen accounts skip everything', () => {
      const a = makeAccount({ frozen: true, balanceGP: 1000 })
      const result = weeklyBankingTick(a, [], 2)
      expect(result.interestEarned).toBe(0)
      expect(result.feesCharged).toBe(0)
      expect(a.balanceGP).toBe(1000) // unchanged
    })

    it('generates ledger entries for all operations', () => {
      const v = makeVault()
      const a = makeAccount({ balanceGP: 5000, interestRate: 0.05, feeRate: 0.01 })
      const loan = issueLoan(v, a, 'b', 1000, 0.1, 52, 'none', undefined, 1)!
      const result = weeklyBankingTick(a, [loan], 2)
      // Should have: interest + fee + loan payment = 3 entries
      expect(result.entries.length).toBe(3)
    })
  })
})
