/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  Lock,
  Check,
  ChevronRight,
  Zap,
  Activity,
  Gauge,
  Code2,
  Layout,
  TrendingUp,
  X,
  Copy,
  CheckCircle2,
  Sparkles,
  Download,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { downloadZyroReceiptPdf } from "./receiptPdf";
import {
  fetchCheckoutConfig,
  incomeMatchesBank,
  loadZyroScript,
  refMatches,
  type CheckoutConfig,
  type GatewayIncomeTx,
  type MerchantAccount,
  type PaymentMethod,
} from "./checkoutApi";
import { zyroLogoUrl } from "./paths";

type ModalStep = "pay" | "verifying" | "success";

interface ApprovalReceipt {
  approvalId: string;
  payerName: string;
  payerPhotoUrl: string;
  txReference: string;
  methodName: string;
  amountEtb: number;
  orderRef: string;
  approvedAt: string;
}

const WHY_ZYRO = [
  { icon: Zap, text: "Seamless local payment experience" },
  { icon: Activity, text: "Real-time transaction processing" },
  { icon: Gauge, text: "Fast and reliable checkout flows" },
  { icon: ShieldCheck, text: "Secure encrypted infrastructure" },
  { icon: Code2, text: "Modern API architecture for developers" },
  { icon: Layout, text: "Minimal, conversion-focused interface" },
  { icon: TrendingUp, text: "Built for scalability and high performance" },
] as const;

function formatEtb(amount: number) {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
  }).format(amount);
}

function generateApprovalId() {
  const part = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `ZYR-APR-${part}${rand}`;
}

function payerAvatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=FF7A18&color=fff&size=128&bold=true`;
}

function qrImageUrl(data: string, size = 160) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=0a0a0a&margin=8`;
}

export default function App() {
  const [checkout, setCheckout] = useState<CheckoutConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [liveIncome, setLiveIncome] = useState<GatewayIncomeTx[]>([]);
  const [zyroStatus, setZyroStatus] = useState<string>("connecting");
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>("pay");
  const [txReference, setTxReference] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ApprovalReceipt | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const paymentMethods = checkout?.paymentMethods ?? [];
  const accounts = checkout?.accounts ?? {};
  const amountEtb = checkout?.amountEtb ?? 0;
  const orderRef = checkout?.orderRef ?? "";
  const merchantName = checkout?.merchantName ?? "Store";
  const customerName = checkout?.customerName ?? "Customer";
  const customerPhotoUrl =
    checkout?.customerPhotoUrl ?? payerAvatarUrl(customerName);

  useEffect(() => {
    const saved = localStorage.getItem("last_gateway");
    if (saved) setLastUsed(saved);
  }, []);

  useEffect(() => {
    let conn: { disconnect?: () => void } | null = null;

    (async () => {
      try {
        const cfg = await fetchCheckoutConfig();
        setCheckout(cfg);
        await loadZyroScript(cfg.zyroScript || "/zyro/zyro.js");

        const Zyro = (window as Window & { Zyro?: { connect: (o: object) => {
          on: (e: string, fn: (tx: GatewayIncomeTx) => void) => () => void;
          disconnect: () => void;
        } } }).Zyro;
        if (!Zyro || !cfg.pairingCode) {
          setZyroStatus("no_pairing");
          return;
        }

        conn = Zyro.connect({
          serverUrl: cfg.serverUrl || window.location.origin,
          pairingCode: cfg.pairingCode,
          role: "desktop",
          deviceName: "Express Checkout",
        });

        conn.on("transaction", (tx: GatewayIncomeTx) => {
          setLiveIncome((prev) => {
            const key = tx.id || `${tx.transactionNumber}-${tx.amount}`;
            if (prev.some((p) => (p.id || p.transactionNumber) === key)) return prev;
            return [tx, ...prev].slice(0, 80);
          });
        });

        conn.on("status", (s: { status?: string }) => {
          setZyroStatus(s?.status ?? "unknown");
        });
      } catch (e) {
        setConfigError(e instanceof Error ? e.message : "Config load failed");
      }
    })();

    return () => {
      conn?.disconnect?.();
    };
  }, []);

  const activeMethod = paymentMethods.find((m) => m.id === selectedMethod);
  const account: MerchantAccount | null = selectedMethod
    ? accounts[selectedMethod] ?? null
    : null;

  const approvalQrPayload = useMemo(() => {
    if (!receipt) return "";
    return JSON.stringify({
      type: "zyro_approval",
      id: receipt.approvalId,
      payer: receipt.payerName,
      tx: receipt.txReference,
      amount: receipt.amountEtb,
      order: receipt.orderRef,
      at: receipt.approvedAt,
    });
  }, [receipt]);

  const openPaymentModal = (id: string) => {
    setSelectedMethod(id);
    localStorage.setItem("last_gateway", id);
    setLastUsed(id);
    setModalStep("pay");
    setTxReference("");
    setVerifyError(null);
    setReceipt(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalStep("pay");
    setTxReference("");
    setVerifyError(null);
  };

  const copyText = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const handleDownloadReceiptPdf = async () => {
    if (!receipt || !approvalQrPayload) return;
    setPdfDownloading(true);
    try {
      await downloadZyroReceiptPdf({
        approvalId: receipt.approvalId,
        payerName: receipt.payerName,
        txReference: receipt.txReference,
        methodName: receipt.methodName,
        amountEtb: receipt.amountEtb,
        orderRef: receipt.orderRef,
        approvedAt: receipt.approvedAt,
        qrPayload: approvalQrPayload,
        merchantName,
      });
    } catch {
      /* PDF generation failed silently in demo */
    } finally {
      setPdfDownloading(false);
    }
  };

  const findMatchingIncome = useCallback(
    (ref: string, bankId: string | null) => {
      if (!bankId) return null;
      const wantAmount = amountEtb;
      return liveIncome.find((tx) => {
        const amt = Number(tx.amount);
        if (!Number.isFinite(amt) || Math.abs(amt - wantAmount) > 0.02) return false;
        if (!incomeMatchesBank(tx, bankId)) return false;
        return refMatches(tx, ref);
      });
    },
    [liveIncome, amountEtb],
  );

  const handleConfirmPayment = () => {
    const ref = txReference.trim();
    if (ref.length < 6) {
      setVerifyError("Enter a valid transaction number (at least 6 characters).");
      return;
    }
    if (!selectedMethod) return;

    setVerifyError(null);
    setModalStep("verifying");
    setReceipt(null);

    const finish = (matched: GatewayIncomeTx | null) => {
      if (!matched) {
        setVerifyError(
          "Payment not found yet. Send the exact amount from your phone, then paste the SMS reference.",
        );
        setModalStep("pay");
        return;
      }

      const payer =
        (matched.name || matched.payerName || matched.sender || "Customer").trim();
      const methodLabel = activeMethod?.name ?? "Payment";
      setReceipt({
        approvalId: generateApprovalId(),
        payerName: payer,
        payerPhotoUrl: payerAvatarUrl(payer),
        txReference: ref,
        methodName: methodLabel,
        amountEtb,
        orderRef,
        approvedAt: matched.timestamp || new Date().toISOString(),
      });
      setModalStep("success");
    };

    let matched = findMatchingIncome(ref, selectedMethod);
    if (matched) {
      finish(matched);
      return;
    }

    setTimeout(() => {
      matched = findMatchingIncome(ref, selectedMethod);
      finish(matched ?? null);
    }, 2500);
  };

  if (configError) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-8 bg-neutral-100">
        <p className="text-center text-red-600 max-w-md">{configError}</p>
      </div>
    );
  }

  if (!checkout) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-neutral-100">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row font-sans overflow-hidden bg-neutral-100">
      {/* Mobile header — single row */}
      <header className="lg:hidden shrink-0 safe-top modal-header-mesh border-b border-white/10">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <img
            src={zyroLogoUrl}
            alt="Zyro"
            className="w-9 h-9 rounded-lg object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-bold text-white leading-none">
              Zyro
            </p>
            <p className="text-[9px] text-primary font-bold uppercase tracking-widest">
              Express Checkout
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <img
              src={customerPhotoUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20"
            />
            <div className="text-right">
              <p className="text-[11px] font-semibold text-white truncate max-w-[100px]">
                {customerName}
              </p>
              <p className="text-xs font-bold text-white tabular-nums">
                {formatEtb(amountEtb)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Desktop branding */}
      <aside className="hidden lg:flex lg:w-[40%] xl:w-[38%] shrink-0 h-full bg-[#0a0a0a] text-white flex-col p-10 xl:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 orange-gradient opacity-20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/30 blur-[80px] rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

        <div className="relative z-10 flex-1 min-h-0 overflow-y-auto scrollbar-hide pr-1">
          <div className="flex items-center gap-4 mb-7">
            <img
              src={zyroLogoUrl}
              alt="Zyro"
              className="w-14 h-14 rounded-2xl shadow-lg shadow-primary/20 object-cover"
            />
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">
                Zyro
              </h1>
              <p className="text-primary text-xs font-bold uppercase tracking-[0.2em] mt-0.5">
                Express Checkout
              </p>
            </div>
          </div>

          <p className="text-lg font-display font-semibold text-white/95 leading-snug max-w-md mb-5">
            Built for businesses that expect payments to feel effortless.
          </p>

          <div className="space-y-4 text-sm text-neutral-400 leading-relaxed max-w-md mb-8">
            <p>
              Zyro is a modern local payment infrastructure designed to deliver
              a premium checkout experience with speed, reliability, and trust at
              its core.
            </p>
            <p>
              From the first tap to final confirmation, every interaction is
              crafted to feel smooth, secure, and beautifully simple —
              eliminating friction and helping businesses move faster online.
            </p>
            <p>
              Inspired by the elegance of modern financial platforms, Zyro
              combines enterprise-grade infrastructure with a clean
              developer-first experience built for the next generation of digital
              commerce.
            </p>
          </div>

          <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-4">
            Why Zyro
          </h2>
          <ul className="space-y-2.5 max-w-md">
            {WHY_ZYRO.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-primary mt-0.5">
                  <Icon size={16} strokeWidth={2} />
                </span>
                <p className="text-sm text-neutral-300 leading-snug pt-1">
                  {text}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Checkout — fixed viewport, no page scroll */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden lg:bg-neutral-100">
        <div className="flex-1 flex flex-col min-h-0 p-3 sm:p-4 lg:p-8 max-w-lg lg:max-w-xl w-full mx-auto safe-bottom">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col min-h-0 bg-white rounded-[20px] lg:rounded-[24px] border border-neutral-200/90 shadow-[0_8px_30px_rgba(0,0,0,0.06)] overflow-hidden"
          >
            {/* Panel header */}
            <div className="shrink-0 px-4 py-3 lg:py-4 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
              <div className="flex items-center gap-3">
                <img
                  src={customerPhotoUrl}
                  alt=""
                  className="w-12 h-12 lg:w-14 lg:h-14 rounded-full object-cover ring-2 ring-primary/20 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-neutral-400 font-medium uppercase tracking-wide">
                    Customer
                  </p>
                  <p className="text-base lg:text-lg font-semibold text-neutral-900 truncate">
                    {customerName}
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                    Pay to {merchantName}
                    {orderRef ? ` · ${orderRef}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wide">
                    Amount
                  </p>
                  <p className="text-lg lg:text-2xl font-display font-bold text-neutral-900 tabular-nums">
                    {formatEtb(amountEtb)}
                  </p>
                </div>
              </div>
            </div>

            {/* Bank list — vertical */}
            <div className="flex-1 min-h-0 px-3 py-2 overflow-y-auto scrollbar-hide">
              <ul className="flex flex-col gap-2">
                {paymentMethods.map((method) => {
                  const isSelected = selectedMethod === method.id;
                  const isLast = lastUsed === method.id;

                  return (
                    <li key={method.id}>
                      <button
                        type="button"
                        onClick={() => openPaymentModal(method.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all active:scale-[0.99] ${
                          isSelected
                            ? "border-primary bg-primary/[0.06] shadow-[0_0_0_3px_rgba(255,122,24,0.1)]"
                            : "border-neutral-100 bg-neutral-50/80 hover:border-neutral-200 hover:bg-white"
                        }`}
                      >
                        <div className="w-12 h-12 shrink-0 rounded-lg bg-white border border-neutral-100 flex items-center justify-center p-1.5 shadow-sm">
                          <img
                            src={method.logo}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-neutral-900">
                              {method.name}
                            </span>
                            {method.recommended && (
                              <span className="text-[8px] font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                Popular
                              </span>
                            )}
                            {isLast && (
                              <span className="text-[8px] font-bold uppercase text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded">
                                Last
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          size={18}
                          className={`shrink-0 ${
                            isSelected ? "text-primary" : "text-neutral-300"
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Panel footer */}
            <div className="shrink-0 px-4 py-2.5 border-t border-neutral-100 flex flex-col items-center gap-1 text-[10px] text-neutral-400">
              <div className="flex items-center gap-3">
                <ShieldCheck size={12} className="text-primary/70" />
                <span>
                  Secured by{" "}
                  <span className="text-primary font-semibold">Zyro</span>
                </span>
                <Lock size={12} className="text-primary/70" />
              </div>
              {zyroStatus === "connected" && (
                <span className="text-emerald-600 font-medium">
                  Live · phone income linked
                </span>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Payment popup */}
      <AnimatePresence>
        {modalOpen && activeMethod && account && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0a0a0a]/50 backdrop-blur-sm"
              onClick={closeModal}
            />

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 28, stiffness: 380 }}
              className="relative z-10 w-full sm:max-w-[420px] modal-shell bg-white rounded-t-[24px] sm:rounded-[24px] max-h-[90dvh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="popup-accent-bar shrink-0" aria-hidden />

              {/* Header */}
              <div className="modal-header-mesh modal-dot-grid shrink-0 relative px-4 pt-4 pb-5 text-white">
                <button
                  type="button"
                  onClick={closeModal}
                  className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 border border-white/10"
                  aria-label="Close"
                >
                  <X size={17} />
                </button>

                <div className="flex items-center gap-3 pr-8">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center p-2 shadow-md ring-1 ring-white/30">
                    <img
                      src={activeMethod.logo}
                      alt=""
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                      {modalStep === "success"
                        ? "Zyro · Approved"
                        : modalStep === "verifying"
                          ? "Zyro · Verifying"
                          : "Zyro · Pay"}
                    </p>
                    <p className="text-lg font-display font-bold truncate">
                      {modalStep === "success"
                        ? "Payment approved"
                        : modalStep === "verifying"
                          ? "Checking payment…"
                          : activeMethod.name}
                    </p>
                  </div>
                </div>

                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-neutral-200/80 shadow-sm">
                  <span className="text-sm font-bold tabular-nums text-neutral-900">
                    {formatEtb(amountEtb)}
                  </span>
                  <span className="text-[10px] font-medium text-neutral-600">
                    exact amount
                  </span>
                </div>
              </div>

              <div
                className={`overflow-y-auto scrollbar-hide flex-1 px-4 py-4 ${
                  modalStep === "success"
                    ? "success-confetti"
                    : "popup-body-glow"
                }`}
              >
                {modalStep === "verifying" ? (
                  <div className="flex flex-col items-center justify-center min-h-[300px] py-8 text-center">
                    <div className="relative w-20 h-20 mb-6">
                      <span className="absolute inset-0 rounded-full border-4 border-primary/20" />
                      <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                      <div className="absolute inset-3 rounded-full bg-white flex items-center justify-center shadow-inner">
                        <img
                          src={activeMethod.logo}
                          alt=""
                          className="max-h-full max-w-full object-contain p-1"
                        />
                      </div>
                    </div>
                    <p className="text-base font-semibold text-neutral-900">
                      Verifying your payment
                    </p>
                    <p className="text-sm text-neutral-500 mt-2 max-w-[240px]">
                      Matching your transaction reference with our records…
                    </p>
                    <div className="flex gap-1.5 mt-6">
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="w-2 h-2 rounded-full bg-primary animate-pulse"
                          style={{ animationDelay: `${i * 200}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                ) : modalStep === "pay" ? (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <span className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
                        <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center">
                          1
                        </span>
                        Send
                      </span>
                      <span className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wide bg-neutral-100 text-neutral-400">
                        <span className="w-4 h-4 rounded-full bg-neutral-300 text-white text-[9px] flex items-center justify-center">
                          2
                        </span>
                        Confirm
                      </span>
                    </div>

                    <div className="account-ticket rounded-2xl overflow-hidden shadow-sm">
                      <div className="px-4 py-2.5 bg-primary/[0.06] border-b border-primary/10 flex items-center gap-2">
                    
                        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          Transfer to this account
                        </p>
                      </div>
                      <div className="divide-y divide-orange-100/60">
                        <div className="px-4 py-3.5">
                          <p className="text-[11px] text-neutral-400 mb-1.5">
                            Account number
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-lg font-mono font-bold text-neutral-900">
                              {account.accountNumber}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(account.accountNumber, "account")
                              }
                              className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                                copiedField === "account"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-primary/10 text-primary hover:bg-primary/20"
                              }`}
                            >
                              {copiedField === "account" ? (
                                <>
                                  <Check size={13} /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy size={13} /> Copy
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="px-4 py-3 grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-1">
                              Holder
                            </p>
                            <p className="text-sm font-semibold text-neutral-900">
                              {account.holderName}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-neutral-400 mb-1">
                              Provider
                            </p>
                            <p className="text-sm font-medium text-neutral-700 truncate">
                              {account.providerLabel}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
                      <label
                        htmlFor="tx-ref"
                        className="text-xs font-semibold text-neutral-700 block mb-2"
                      >
                        Transaction reference
                      </label>
                      <input
                        id="tx-ref"
                        type="text"
                        value={txReference}
                        onChange={(e) => {
                          setTxReference(e.target.value);
                          setVerifyError(null);
                        }}
                        placeholder="Paste your transaction ID"
                        className="w-full h-11 px-3 rounded-xl border border-neutral-200 bg-neutral-50/50 text-sm font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 focus:bg-white"
                      />
                      {verifyError && (
                        <p className="text-xs text-red-600 mt-2 px-0.5">
                          {verifyError}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmPayment}
                      className="w-full h-12 rounded-xl orange-gradient text-white font-bold text-sm flex items-center justify-center gap-2 orange-glow shadow-md"
                    >
                      <CheckCircle2 size={18} />
                      Confirm payment
                    </button>
                  </div>
                ) : modalStep === "success" && receipt ? (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", damping: 24, stiffness: 320 }}
                    className="space-y-4"
                  >
                    <div className="rounded-2xl border-2 border-emerald-200 bg-white overflow-hidden shadow-lg shadow-emerald-500/10">
                      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-4 text-center text-white">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: 0.15 }}
                          className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-2"
                        >
                          <CheckCircle2 size={32} strokeWidth={2.5} />
                        </motion.div>
                        <p className="text-lg font-display font-bold">
                          Payment approved
                        </p>
                        <p className="text-xs text-emerald-100 mt-1">
                          They paid · Transaction verified
                        </p>
                      </div>

                      <div className="p-5 flex flex-col items-center text-center">
                        <div className="flex items-center gap-3 w-full mb-5 pb-4 border-b border-neutral-100">
                          <img
                            src={receipt.payerPhotoUrl}
                            alt=""
                            className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-200"
                          />
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-bold text-neutral-900 truncate">
                              {receipt.payerName}
                            </p>
                            <p className="text-xs text-neutral-500">
                              {receipt.methodName} · {formatEtb(receipt.amountEtb)}
                            </p>
                            <p className="text-[10px] font-mono text-neutral-400 truncate mt-0.5">
                              {receipt.txReference}
                            </p>
                          </div>
                        </div>

                        <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-3">
                          Approval QR
                        </p>
                        <div className="p-3 rounded-2xl bg-neutral-50 border-2 border-primary/20 ring-4 ring-primary/5">
                          <img
                            src={qrImageUrl(approvalQrPayload, 168)}
                            alt="Scan to verify approval"
                            className="w-40 h-40"
                          />
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-3">
                          Scan to confirm this payment is approved
                        </p>
                        <p className="text-xs font-mono font-semibold text-primary mt-2 bg-primary/5 px-3 py-1.5 rounded-lg">
                          {receipt.approvalId}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={pdfDownloading}
                        onClick={handleDownloadReceiptPdf}
                        className="h-12 rounded-xl border-2 border-primary text-primary font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/5 disabled:opacity-50"
                      >
                        {pdfDownloading ? (
                          <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        ) : (
                          <Download size={18} />
                        )}
                        Receipt PDF
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="h-12 rounded-xl bg-[#0a0a0a] text-white font-bold text-sm hover:bg-neutral-800 shadow-md"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                ) : null}
              </div>

              <div className="shrink-0 px-4 py-2.5 border-t border-neutral-100 bg-neutral-50/80 flex items-center justify-center gap-1.5">
                <img
                  src={zyroLogoUrl}
                  alt=""
                  className="w-4 h-4 rounded object-cover opacity-80"
                />
                <span className="text-[10px] font-semibold text-neutral-400">
                  Powered by <span className="text-primary">Zyro</span>
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
