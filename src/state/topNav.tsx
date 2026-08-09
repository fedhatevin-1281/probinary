import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import {
  checkBackendHealth,
  simulateAuthenticatedMutation,
} from "../services/appApi"

import {
  formatKes,
  formatUsd,
  getWalletSettings,
  saveWalletSettings,
  usdToKes,
  type WalletSettings,
} from "../config/walletSettings"

import { marketLabel, useTrading, type BinaryTrade } from "./trading"

export type HeaderPanel = "none" | "withdraw" | "history" | "ai" | "chat" | "learn" | "deposit" | "notifications"

export type AccountType = "real" | "demo"

export type StatusType = "pending" | "processing" | "completed" | "rejected" | "success" | "failed"

export type HistoryTab = "trades" | "deposits" | "withdrawals" | "transfers" | "login"

export type NotificationCategory = "trades" | "deposits" | "withdrawals" | "system" | "news" | "promotions"

export type WalletTransactionType = "deposit" | "withdrawal" | "trade" | "adjustment"

export interface ToastItem {
  id: string

  type: "success" | "error" | "info"

  message: string
}

export interface BalanceState {
  real: number

  demo: number

  available: number

  pending: number

  currency: "USD"
}

export interface WithdrawalRequest {
  id: string

  amountUsd: number

  method: string

  accountNumber: string

  notes?: string

  referenceNumber: string

  status: "pending" | "processing" | "completed" | "rejected"

  createdAt: number
}

export interface DepositRequest {
  id: string

  amountUsd: number

  method: string

  referenceNumber: string

  receiptNumber: string

  createdAt: number

  status: "processing" | "completed" | "failed"

  mobileMoneyAmountKes?: number
}

export interface WalletTransaction {
  id: string

  timestamp: number

  type: WalletTransactionType

  amountUsd: number

  status: StatusType

  referenceNumber: string

  balanceAfterUsd: number

  source: "real" | "demo"

  note?: string
}

export interface HistoryItem {
  id: string

  date: number

  type: string

  amount: number

  status: StatusType

  market: string

  transactionId: string

  referenceNumber: string

  balanceAfter: number

  tab: HistoryTab
}

export interface NotificationItem {
  id: string

  category: NotificationCategory

  icon: string

  title: string

  description: string

  timestamp: number

  read: boolean
}

export interface ChatMessage {
  id: string

  by: "user" | "agent" | "system"

  text: string

  timestamp: number

  attachmentName?: string
}

export interface AiMessage {
  id: string

  role: "user" | "assistant"

  text: string

  timestamp: number
}

export interface LessonItem {
  id: string

  section: string

  title: string

  duration: string

  difficulty: "Beginner" | "Intermediate" | "Advanced"

  completed: boolean

  bookmarked: boolean
}

interface WithdrawInput {
  amountUsd: number

  paymentMethod: string

  accountNumber: string

  notes?: string
}

interface DepositInput {
  amountUsd: number

  paymentMethod: string

  referenceNumber: string
}

interface AppHeaderContextValue {
  panel: HeaderPanel

  setPanel: (panel: HeaderPanel) => void

  balances: BalanceState

  activeAccount: AccountType

  setActiveAccount: (account: AccountType) => void

  balancePulse: boolean

  backendOnline: boolean

  walletSettings: WalletSettings

  setUsdKesRate: (nextRate: number) => void

  withdrawalHistory: WithdrawalRequest[]

  depositHistory: DepositRequest[]

  walletTransactions: WalletTransaction[]

  historyRows: HistoryItem[]

  notifications: NotificationItem[]

  chatMessages: ChatMessage[]

  aiMessages: AiMessage[]

  aiTyping: boolean

  unreadNotifications: number

  unreadChat: number

  toasts: ToastItem[]

  lessons: LessonItem[]

  supportCategory: string

  setSupportCategory: (value: string) => void

  chatAgentOnline: boolean

  withdrawMinimumUsd: number

  depositMinimumUsd: number

  loadingStates: Record<string, boolean>

  submitWithdrawal: (
    input: WithdrawInput,
  ) => Promise<{ ok: boolean error?: string }>

  submitDeposit: (
    input: DepositInput,
  ) => Promise<{ ok: boolean receiptNumber?: string error?: string }>

  sendAiPrompt: (prompt: string) => Promise<void>

  sendSupportMessage: (message: string, fileName?: string) => Promise<void>

  addNotification: (
    item: Omit<NotificationItem, "id" | "timestamp" | "read">,
  ) => void

  markAllNotificationsRead: () => void

  deleteNotification: (id: string) => void

  refreshBalances: () => Promise<void>

  dismissToast: (id: string) => void

  markLessonCompleted: (id: string) => void

  toggleLessonBookmark: (id: string) => void

  formatUsdValue: (amount: number) => string

  formatKesValue: (amount: number) => string
}

const WITHDRAW_MAX_USD = 10000

const DEPOSIT_MAX_USD = 50000

const STORAGE_KEY = "pb.topnav.state.v3"

const LESSONS: LessonItem[] = [
  {
    id: "ls-1",
    section: "Getting Started",
    title: "Create your first synthetic trade",
    duration: "7 min",
    difficulty: "Beginner",
    completed: true,
    bookmarked: false,
  },

  {
    id: "ls-2",
    section: "Trading Basics",
    title: "Contract types explained",
    duration: "11 min",
    difficulty: "Beginner",
    completed: false,
    bookmarked: true,
  },

  {
    id: "ls-3",
    section: "Charts",
    title: "Reading candle momentum",
    duration: "13 min",
    difficulty: "Intermediate",
    completed: false,
    bookmarked: false,
  },

  {
    id: "ls-4",
    section: "Indicators",
    title: "RSI and stochastic setup",
    duration: "15 min",
    difficulty: "Intermediate",
    completed: false,
    bookmarked: false,
  },

  {
    id: "ls-5",
    section: "Risk Management",
    title: "Position sizing model",
    duration: "9 min",
    difficulty: "Advanced",
    completed: false,
    bookmarked: true,
  },

  {
    id: "ls-6",
    section: "Strategies",
    title: "Boom 1000 breakout drill",
    duration: "16 min",
    difficulty: "Advanced",
    completed: false,
    bookmarked: false,
  },

  {
    id: "ls-7",
    section: "Frequently Asked Questions",
    title: "Settlement and payout FAQ",
    duration: "6 min",
    difficulty: "Beginner",
    completed: false,
    bookmarked: false,
  },

  {
    id: "ls-8",
    section: "Video Tutorials",
    title: "Live trade replay",
    duration: "19 min",
    difficulty: "Intermediate",
    completed: false,
    bookmarked: false,
  },

  {
    id: "ls-9",
    section: "Interactive Lessons",
    title: "Risk sandbox simulator",
    duration: "12 min",
    difficulty: "Intermediate",
    completed: false,
    bookmarked: false,
  },
]

const AppHeaderContext = createContext<AppHeaderContextValue | null>(null)

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function formatTradeType(trade: BinaryTrade) {
  return `${trade.contractType} ${marketLabel(trade.direction)}`
}

function getAiResponse(prompt: string, recentTrades: BinaryTrade[]): string {
  const input = prompt.toLowerCase()

  if (input.includes("rsi")) {
    return "RSI measures momentum on a 0-100 scale. Above 70 can signal overbought pressure and below 30 can signal oversold pressure. Use RSI with trend context instead of standalone entries."
  }

  if (input.includes("boom 1000")) {
    return "Boom 1000 has infrequent but strong upward spikes. Typical approach is waiting for structure confirmation, then entering with strict downside risk limits and predefined stop logic."
  }

  if (input.includes("leverage")) {
    return "Leverage increases position size relative to capital, magnifying both gains and losses. Keep leverage tied to a fixed risk-per-trade rule, usually under 1-2 percent of account equity."
  }

  if (input.includes("recent trades")) {
    const trades = recentTrades.slice(0, 3)

    if (!trades.length) {
      return "No recent trades are available yet. Place a trade and I can summarize entries, exits, and outcomes."
    }

    const list = trades

      .map(
        (trade) =>
          `${trade.symbol} ${marketLabel(trade.direction)} ${trade.result ?? trade.status} ${
            trade.profit
              ? `${trade.profit >= 0 ? "+" : ""}${trade.profit.toFixed(2)}`
              : ""
          }`,
      )

      .join(" | ")

    return `Recent trades: ${list}`
  }

  return "I can help with market analysis, indicators, contract logic, and platform workflows. Try: What is RSI, Explain Boom 1000, or Show my recent trades."
}

interface PersistedState {
  activeAccount: AccountType

  walletSettings: WalletSettings

  demoBalance: number

  withdrawalHistory: WithdrawalRequest[]

  depositHistory: DepositRequest[]

  walletTransactions: WalletTransaction[]

  notifications: NotificationItem[]

  chatMessages: ChatMessage[]

  aiMessages: AiMessage[]

  lessons: LessonItem[]
}

function loadPersistedState(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

function makeTradeTransaction(
  trade: BinaryTrade,
  balanceAfterUsd: number,
): WalletTransaction {
  return {
    id: makeId("txn-trade"),

    timestamp: trade.settledAt ?? trade.createdAt,

    type: "trade",

    amountUsd: trade.profit ?? 0,

    status: trade.result === "won" ? "completed" : "failed",

    referenceNumber: trade.id,

    balanceAfterUsd,

    source: "real",

    note: `${trade.symbol} ${formatTradeType(trade)}`,
  }
}

export function TopNavProvider({ children }: { children: ReactNode }) {
  const trading = useTrading()

  const persisted = useMemo(
    () => (typeof window === "undefined" ? null : loadPersistedState()),
    [],
  )

  const [walletSettings, setWalletSettings] = useState<WalletSettings>(
    persisted?.walletSettings ?? getWalletSettings(),
  )

  const [panel, setPanel] = useState<HeaderPanel>("none")

  const [backendOnline, setBackendOnline] = useState(false)

  const [activeAccount, setActiveAccount] = useState<AccountType>(
    persisted?.activeAccount ?? "real",
  )

  const [demoBalance, setDemoBalance] = useState<number>(
    persisted?.demoBalance ?? 10000,
  )

  const [pendingBalance, setPendingBalance] = useState<number>(0)

  const [balancePulse, setBalancePulse] = useState(false)

  const [withdrawalHistory, setWithdrawalHistory] =
    useState<WithdrawalRequest[]>(persisted?.withdrawalHistory ?? [])

  const [depositHistory, setDepositHistory] = useState<DepositRequest[]>(
    persisted?.depositHistory ?? [],
  )

  const [walletTransactions, setWalletTransactions] =
    useState<WalletTransaction[]>(persisted?.walletTransactions ?? [])

  const [notifications, setNotifications] = useState<NotificationItem[]>(
    persisted?.notifications ?? [],
  )

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    persisted?.chatMessages ?? [
      {
        id: "c-1",
        by: "agent",
        text: "Hello, support is online. How can we help today?",
        timestamp: Date.now() - 500000,
      },
    ],
  )

  const [chatAgentOnline, setChatAgentOnline] = useState(true)

  const [supportCategory, setSupportCategory] = useState("General")

  const [aiMessages, setAiMessages] = useState<AiMessage[]>(
    persisted?.aiMessages ?? [],
  )

  const [aiTyping, setAiTyping] = useState(false)

  const [lessons, setLessons] = useState<LessonItem[]>(
    persisted?.lessons ?? LESSONS,
  )

  const [toasts, setToasts] = useState<ToastItem[]>([])

  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({
    withdraw: false,
    deposit: false,
    refreshBalances: false,
    chatSend: false,
  })

  const previousTradeIdsRef = useRef<Set<string>>(
    new Set(trading.closedTrades.map((item) => item.id)),
  )

  const statusTimersRef = useRef<number[]>([])

  const balances = useMemo<BalanceState>(() => {
    const real = Math.round(trading.balance * 100) / 100

    const pending = Math.round(pendingBalance * 100) / 100

    const available = Math.max(0, Math.round((real - pending) * 100) / 100)

    return {
      real,
      demo: Math.round(demoBalance * 100) / 100,
      available,
      pending,
      currency: "USD",
    }
  }, [demoBalance, pendingBalance, trading.balance])

  const pushToast = useCallback((type: ToastItem["type"], message: string) => {
    const id = makeId("toast")

    setToasts((prev) => [{ id, type, message }, ...prev].slice(0, 5))

    window.setTimeout(
      () => setToasts((prev) => prev.filter((item) => item.id !== id)),
      2600,
    )
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const addNotification = useCallback(
    (item: Omit<NotificationItem, "id" | "timestamp" | "read">) => {
      setNotifications((prev) => [
        { id: makeId("ntf"), timestamp: Date.now(), read: false, ...item },
        ...prev,
      ])
    },
    [],
  )

  const appendTransaction = useCallback((transaction: WalletTransaction) => {
    setWalletTransactions((prev) => [transaction, ...prev].slice(0, 200))
  }, [])

  const refreshBalances = useCallback(async () => {
    setLoadingStates((prev) => ({ ...prev, refreshBalances: true }))

    try {
      const healthy = await checkBackendHealth()

      setBackendOnline(healthy)

      setBalancePulse(true)

      window.setTimeout(() => setBalancePulse(false), 280)
    } finally {
      setLoadingStates((prev) => ({ ...prev, refreshBalances: false }))
    }
  }, [])

  const setUsdKesRate = useCallback(
    (nextRate: number) => {
      if (!Number.isFinite(nextRate) || nextRate <= 0) {
        pushToast("error", "Exchange rate must be greater than zero")

        return
      }

      const next = {
        ...walletSettings,
        usdKesRate: Math.round(nextRate * 100) / 100,
      }

      setWalletSettings(next)

      saveWalletSettings(next)

      pushToast(
        "success",
        `Exchange rate updated: 1 USD = ${next.usdKesRate} KES`,
      )
    },
    [walletSettings, pushToast],
  )

  const submitWithdrawal = useCallback(
    async (input: WithdrawInput) => {
      const amountUsd = Math.round(Number(input.amountUsd || 0) * 100) / 100

      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        return { ok: false, error: "Amount must be greater than zero" }
      }

      if (amountUsd < walletSettings.minWithdrawalUsd) {
        return {
          ok: false,
          error: `Minimum withdrawal is ${formatUsd(walletSettings.minWithdrawalUsd)}`,
        }
      }

      if (amountUsd > WITHDRAW_MAX_USD) {
        return {
          ok: false,
          error: `Maximum withdrawal is ${formatUsd(WITHDRAW_MAX_USD)}`,
        }
      }

      if (amountUsd > balances.available) {
        return {
          ok: false,
          error: "Cannot withdraw more than available balance",
        }
      }

      if (!input.paymentMethod.trim() || !input.accountNumber.trim()) {
        return {
          ok: false,
          error: "Payment method and account number are required",
        }
      }

      setLoadingStates((prev) => ({ ...prev, withdraw: true }))

      try {
        await simulateAuthenticatedMutation("withdraw.create", {
          amountUsd,
          paymentMethod: input.paymentMethod,
          accountNumber: input.accountNumber,
          notes: input.notes,
        })

        const referenceNumber = `WDR-${Date.now().toString().slice(-8)}`

        const adjustResult = trading.adjustBalance(
          -amountUsd,
          `Withdrawal requested ${referenceNumber}`,
        )

        if (!adjustResult.ok) {
          return {
            ok: false,
            error: adjustResult.error || "Unable to update balance",
          }
        }

        const request: WithdrawalRequest = {
          id: makeId("wd"),

          amountUsd,

          method: input.paymentMethod,

          accountNumber: input.accountNumber,

          notes: input.notes,

          referenceNumber,

          status: "pending",

          createdAt: Date.now(),
        }

        setWithdrawalHistory((prev) => [request, ...prev])

        setPendingBalance((prev) => Math.round((prev + amountUsd) * 100) / 100)

        appendTransaction({
          id: makeId("txn-wd"),
          timestamp: Date.now(),
          type: "withdrawal",
          amountUsd: -amountUsd,
          status: "pending",
          referenceNumber,
          balanceAfterUsd: Math.max(0, trading.balance - amountUsd),
          source: "real",
          note: input.paymentMethod,
        })

        addNotification({
          category: "withdrawals",
          icon: "withdraw",
          title: "Withdrawal request created",
          description: `Your request for ${formatUsd(amountUsd)} is pending review.`,
        })

        pushToast("success", `Withdrawal submitted: ${formatUsd(amountUsd)}`)

        const processingTimer = window.setTimeout(() => {
          setWithdrawalHistory((prev) =>
            prev.map((item) =>
              item.id === request.id ? { ...item, status: "processing" } : item,
            ),
          )

          setWalletTransactions((prev) =>
            prev.map((item) =>
              item.referenceNumber === referenceNumber
                ? { ...item, status: "processing" }
                : item,
            ),
          )
        }, 2800)

        const completedTimer = window.setTimeout(() => {
          setWithdrawalHistory((prev) =>
            prev.map((item) =>
              item.id === request.id ? { ...item, status: "completed" } : item,
            ),
          )

          setWalletTransactions((prev) =>
            prev.map((item) =>
              item.referenceNumber === referenceNumber
                ? { ...item, status: "completed" }
                : item,
            ),
          )

          setPendingBalance((prev) =>
            Math.max(0, Math.round((prev - amountUsd) * 100) / 100),
          )

          addNotification({
            category: "withdrawals",
            icon: "check",
            title: "Withdrawal completed",
            description: `Withdrawal ${referenceNumber} has been completed.`,
          })
        }, 7600)

        statusTimersRef.current.push(processingTimer, completedTimer)

        return { ok: true }
      } catch {
        return {
          ok: false,
          error: "Could not submit withdrawal request. Please retry.",
        }
      } finally {
        setLoadingStates((prev) => ({ ...prev, withdraw: false }))
      }
    },
    [
      walletSettings.minWithdrawalUsd,
      balances.available,
      appendTransaction,
      addNotification,
      pushToast,
      trading,
    ],
  )

  const submitDeposit = useCallback(
    async (input: DepositInput) => {
      const amountUsd = Math.round(Number(input.amountUsd || 0) * 100) / 100

      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        return { ok: false, error: "Amount must be greater than zero" }
      }

      if (amountUsd < walletSettings.minDepositUsd) {
        return {
          ok: false,
          error: `Minimum deposit is ${formatUsd(walletSettings.minDepositUsd)}`,
        }
      }

      if (amountUsd > DEPOSIT_MAX_USD) {
        return {
          ok: false,
          error: `Maximum deposit is ${formatUsd(DEPOSIT_MAX_USD)}`,
        }
      }

      if (!input.paymentMethod.trim() || !input.referenceNumber.trim()) {
        return {
          ok: false,
          error: "Payment method and reference number are required",
        }
      }

      setLoadingStates((prev) => ({ ...prev, deposit: true }))

      try {
        const isMobileMoney = input.paymentMethod
          .toLowerCase()
          .includes("mobile")

        const mobileMoneyAmountKes = isMobileMoney
          ? usdToKes(amountUsd, walletSettings.usdKesRate)
          : undefined

        await simulateAuthenticatedMutation("deposit.create", {
          amount: isMobileMoney ? mobileMoneyAmountKes : amountUsd,

          currency: isMobileMoney ? "KES" : "USD",

          paymentMethod: input.paymentMethod,

          referenceNumber: input.referenceNumber,

          exchangeRate: walletSettings.usdKesRate,
        })

        const receiptNumber = `RCP-${Date.now().toString().slice(-8)}`

        const item: DepositRequest = {
          id: makeId("dp"),

          amountUsd,

          method: input.paymentMethod,

          referenceNumber: input.referenceNumber,

          receiptNumber,

          createdAt: Date.now(),

          status: "completed",

          mobileMoneyAmountKes,
        }

        if (activeAccount === "real") {
          const adjustResult = trading.adjustBalance(
            amountUsd,
            `Deposit completed ${receiptNumber}`,
          )

          if (!adjustResult.ok) {
            return {
              ok: false,
              error: adjustResult.error || "Unable to update real balance",
            }
          }
        } else {
          setDemoBalance((prev) => Math.round((prev + amountUsd) * 100) / 100)
        }

        setDepositHistory((prev) => [item, ...prev])

        appendTransaction({
          id: makeId("txn-dp"),
          timestamp: Date.now(),
          type: "deposit",
          amountUsd,
          status: "completed",
          referenceNumber: receiptNumber,
          balanceAfterUsd:
            activeAccount === "real"
              ? trading.balance + amountUsd
              : balances.demo + amountUsd,
          source: activeAccount,
          note: input.paymentMethod,
        })

        setBalancePulse(true)

        window.setTimeout(() => setBalancePulse(false), 280)

        addNotification({
          category: "deposits",

          icon: "deposit",

          title: "Deposit completed",

          description: isMobileMoney
            ? `${formatUsd(amountUsd)} credited. Mobile Money API payload used ${formatKes(mobileMoneyAmountKes || 0)} at rate ${walletSettings.usdKesRate}.`
            : `${formatUsd(amountUsd)} was credited to your ${activeAccount.toUpperCase()} wallet.`,
        })

        pushToast("success", `Deposit successful. Receipt ${receiptNumber}`)

        return { ok: true, receiptNumber }
      } catch {
        return { ok: false, error: "Deposit failed. Please retry." }
      } finally {
        setLoadingStates((prev) => ({ ...prev, deposit: false }))
      }
    },
    [
      walletSettings,
      activeAccount,
      trading,
      appendTransaction,
      balances.demo,
      addNotification,
      pushToast,
    ],
  )

  const sendAiPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) {
        return
      }

      setAiMessages((prev) => [
        ...prev,
        {
          id: makeId("ai-user"),
          role: "user",
          text: prompt,
          timestamp: Date.now(),
        },
      ])

      setAiTyping(true)

      const answer = getAiResponse(prompt, trading.recentTrades)

      await new Promise((resolve) => window.setTimeout(resolve, 850))

      setAiMessages((prev) => [
        ...prev,
        {
          id: makeId("ai-assistant"),
          role: "assistant",
          text: answer,
          timestamp: Date.now(),
        },
      ])

      setAiTyping(false)
    },
    [trading.recentTrades],
  )

  const sendSupportMessage = useCallback(
    async (message: string, fileName?: string) => {
      if (!message.trim() && !fileName) {
        return
      }

      setLoadingStates((prev) => ({ ...prev, chatSend: true }))

      setChatMessages((prev) => [
        ...prev,
        {
          id: makeId("msg"),
          by: "user",
          text: message,
          attachmentName: fileName,
          timestamp: Date.now(),
        },
      ])

      await new Promise((resolve) => window.setTimeout(resolve, 560))

      if (!chatAgentOnline) {
        const ticketId = `TKT-${Date.now().toString().slice(-7)}`

        setChatMessages((prev) => [
          ...prev,
          {
            id: makeId("msg"),
            by: "system",
            text: `Leave us a message recorded. Ticket ${ticketId} has been created.`,
            timestamp: Date.now(),
          },
        ])

        addNotification({
          category: "system",
          icon: "ticket",
          title: "Support ticket created",
          description: `Ticket ${ticketId} has been logged for ${supportCategory}.`,
        })

        setLoadingStates((prev) => ({ ...prev, chatSend: false }))

        return
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: makeId("msg"),
          by: "agent",
          text: "Support received your message. We are checking this now.",
          timestamp: Date.now(),
        },
      ])

      setLoadingStates((prev) => ({ ...prev, chatSend: false }))
    },
    [addNotification, chatAgentOnline, supportCategory],
  )

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })))
  }, [])

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const markLessonCompleted = useCallback((id: string) => {
    setLessons((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: true } : item,
      ),
    )
  }, [])

  const toggleLessonBookmark = useCallback((id: string) => {
    setLessons((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, bookmarked: !item.bookmarked } : item,
      ),
    )
  }, [])

  useEffect(() => {
    void refreshBalances()
  }, [refreshBalances])

  useEffect(() => {
    const ids = new Set(trading.closedTrades.map((item) => item.id))

    const previous = previousTradeIdsRef.current

    const newTrades = trading.closedTrades.filter(
      (item) => !previous.has(item.id),
    )

    if (newTrades.length) {
      setBalancePulse(true)

      window.setTimeout(() => setBalancePulse(false), 280)

      for (const trade of newTrades) {
        appendTransaction(makeTradeTransaction(trade, trading.balance))

        addNotification({
          category: "trades",

          icon: trade.result === "won" ? "profit" : "loss",

          title: `${trade.symbol} ${trade.result === "won" ? "won" : "lost"}`,

          description: `Trade ${trade.id} settled ${formatUsd(trade.profit ?? 0)}.`,
        })
      }
    }

    previousTradeIdsRef.current = ids
  }, [
    addNotification,
    appendTransaction,
    trading.balance,
    trading.closedTrades,
  ])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setChatAgentOnline(Math.random() > 0.12)

      addNotification({
        category: "news",
        icon: "news",
        title: "Market bulletin",
        description: "Synthetic market liquidity update published.",
      })
    }, 45000)

    return () => window.clearInterval(interval)
  }, [addNotification])

  useEffect(() => {
    const payload: PersistedState = {
      activeAccount,

      walletSettings,

      demoBalance,

      withdrawalHistory,

      depositHistory,

      walletTransactions,

      notifications,

      chatMessages,

      aiMessages,

      lessons,
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [
    activeAccount,
    walletSettings,
    demoBalance,
    withdrawalHistory,
    depositHistory,
    walletTransactions,
    notifications,
    chatMessages,
    aiMessages,
    lessons,
  ])

  useEffect(
    () => () => {
      for (const timer of statusTimersRef.current) {
        window.clearTimeout(timer)
      }
    },
    [],
  )

  const historyRows = useMemo<HistoryItem[]>(() => {
    const walletRows: HistoryItem[] = walletTransactions.map((item) => ({
      id: item.id,

      date: item.timestamp,

      type: item.type[0].toUpperCase() + item.type.slice(1),

      amount: item.amountUsd,

      status: item.status,

      market:
        item.note?.includes("VOL") ||
        item.note?.includes("BOOM") ||
        item.note?.includes("CRASH")
          ? item.note
          : "-",

      transactionId: item.id,

      referenceNumber: item.referenceNumber,

      balanceAfter: item.balanceAfterUsd,

      tab:
        item.type === "deposit"
          ? "deposits"
          : item.type === "withdrawal"
            ? "withdrawals"
            : item.type === "trade"
              ? "trades"
              : "transfers",
    }))

    const loginRows: HistoryItem[] = [
      {
        id: "login-1",

        date: Date.now() - 2 * 3600000,

        type: "Web login",

        amount: 0,

        status: "success",

        market: "-",

        transactionId: "LGN-00912",

        referenceNumber: "LGN-00912",

        balanceAfter: balances.real,

        tab: "login",
      },
    ]

    return [...walletRows, ...loginRows].sort((a, b) => b.date - a.date)
  }, [walletTransactions, balances.real])

  const unreadNotifications = useMemo(
    () =>
      notifications.reduce((count, item) => (item.read ? count : count + 1), 0),
    [notifications],
  )

  const unreadChat = useMemo(
    () =>
      chatMessages.reduce(
        (count, item) => (item.by === "agent" ? count + 1 : count),
        0,
      ),
    [chatMessages],
  )

  const formatUsdValue = useCallback((amount: number) => formatUsd(amount), [])

  const formatKesValue = useCallback((amount: number) => formatKes(amount), [])

  const value = useMemo<AppHeaderContextValue>(
    () => ({
      panel,

      setPanel,

      balances,

      activeAccount,

      setActiveAccount,

      balancePulse,

      backendOnline,

      walletSettings,

      setUsdKesRate,

      withdrawalHistory,

      depositHistory,

      walletTransactions,

      historyRows,

      notifications,

      chatMessages,

      aiMessages,

      aiTyping,

      unreadNotifications,

      unreadChat,

      toasts,

      lessons,

      supportCategory,

      setSupportCategory,

      chatAgentOnline,

      withdrawMinimumUsd: walletSettings.minWithdrawalUsd,

      depositMinimumUsd: walletSettings.minDepositUsd,

      loadingStates,

      submitWithdrawal,

      submitDeposit,

      sendAiPrompt,

      sendSupportMessage,

      addNotification,

      markAllNotificationsRead,

      deleteNotification,

      refreshBalances,

      dismissToast,

      markLessonCompleted,

      toggleLessonBookmark,

      formatUsdValue,

      formatKesValue,
    }),
    [
      panel,

      balances,

      activeAccount,

      balancePulse,

      backendOnline,

      walletSettings,

      withdrawalHistory,

      depositHistory,

      walletTransactions,

      historyRows,

      notifications,

      chatMessages,

      aiMessages,

      aiTyping,

      unreadNotifications,

      unreadChat,

      toasts,

      lessons,

      supportCategory,

      chatAgentOnline,

      loadingStates,

      submitWithdrawal,

      submitDeposit,

      sendAiPrompt,

      sendSupportMessage,

      addNotification,

      markAllNotificationsRead,

      deleteNotification,

      refreshBalances,

      dismissToast,

      markLessonCompleted,

      toggleLessonBookmark,

      setUsdKesRate,

      formatUsdValue,

      formatKesValue,
    ],
  )

  return (
    <AppHeaderContext.Provider value={value}>
      {children}
    </AppHeaderContext.Provider>
  )
}

export function useTopNav() {
  const context = useContext(AppHeaderContext)

  if (!context) {
    throw new Error("useTopNav must be used within TopNavProvider")
  }

  return context
}
