export interface WalletSettings {
  usdKesRate: number

  minDepositUsd: number

  minWithdrawalUsd: number

  primaryCurrency: "USD"
}

const STORAGE_KEY = "pb.wallet.settings.v1"

const DEFAULTS: WalletSettings = {
  usdKesRate: Number(import.meta.env.VITE_USD_KES_RATE || 129.5),

  minDepositUsd: 4,

  minWithdrawalUsd: 15,

  primaryCurrency: "USD",
}

export function getWalletSettings(): WalletSettings {
  if (typeof window === "undefined") {
    return DEFAULTS
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return DEFAULTS
    }

    const parsed = JSON.parse(raw) as Partial<WalletSettings>

    const usdKesRate = Number(parsed.usdKesRate ?? DEFAULTS.usdKesRate)

    return {
      usdKesRate:
        Number.isFinite(usdKesRate) && usdKesRate > 0
          ? usdKesRate
          : DEFAULTS.usdKesRate,

      minDepositUsd: DEFAULTS.minDepositUsd,

      minWithdrawalUsd: DEFAULTS.minWithdrawalUsd,

      primaryCurrency: "USD",
    }
  } catch {
    return DEFAULTS
  }
}

export function saveWalletSettings(settings: WalletSettings) {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function usdToKes(usdAmount: number, rate: number) {
  const numeric = Number(usdAmount)

  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.round(numeric * rate * 100) / 100
}

export function toKes(amount: number, currency: "USD" | "KES", rate: number) {
  return currency === "USD"
    ? usdToKes(amount, rate)
    : Math.round(amount * 100) / 100
}

export function formatKes(amount: number) {
  return `KSh ${new Intl.NumberFormat("en-KE", {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  }).format(amount)}`
}

export function formatUsd(amount: number) {
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,

    maximumFractionDigits: 2,
  }).format(amount)}`
}
