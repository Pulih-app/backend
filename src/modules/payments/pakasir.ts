import { AppError, AppErrorCode } from "../../shared/errors";

const ORDER_ID_PREFIX = "PLH";

function formatTimestamp(now: Date) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
}

export function generateOrderId(now = new Date()) {
  return `${ORDER_ID_PREFIX}-${formatTimestamp(now)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function buildPakasirPaymentUrl(input: {
  paymentBaseUrl: string;
  projectSlug: string;
  amount: number;
  orderId: string;
  redirectUrl?: string;
}) {
  const baseUrl = input.paymentBaseUrl.replace(/\/$/, "");
  const slug = encodeURIComponent(input.projectSlug);
  const amount = encodeURIComponent(String(Math.round(input.amount)));
  const url = new URL(`${baseUrl}/pay/${slug}/${amount}`);
  url.searchParams.set("order_id", input.orderId);
  if (input.redirectUrl) url.searchParams.set("redirect", input.redirectUrl);

  return url.toString();
}

export function buildPaymentInstruction(paymentUrl: string) {
  return `Open the payment URL to complete payment: ${paymentUrl}`;
}

export type PakasirTransactionDetail = {
  project: string;
  orderId: string;
  amount: number;
  status: string;
  paymentMethod: string | null;
  completedAt: string | null;
};

export type PakasirClient = {
  getTransactionDetail(input: { project: string; orderId: string; amount: number }): Promise<PakasirTransactionDetail>;
  simulatePayment(input: { project: string; orderId: string; amount: number }): Promise<void>;
};

type PakasirClientOptions = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  fetcher?: typeof fetch;
};

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, done: () => clearTimeout(timeout) };
}

function mapProviderError(error: unknown): never {
  if (error instanceof AppError) throw error;
  throw new AppError(AppErrorCode.DownstreamError, "Payment provider request failed.");
}

function mapTransaction(input: unknown): PakasirTransactionDetail {
  const transaction = (input as { transaction?: Record<string, unknown> }).transaction;
  if (!transaction) throw new AppError(AppErrorCode.DownstreamError, "Payment provider response is invalid.");
  return {
    project: String(transaction.project ?? ""),
    orderId: String(transaction.order_id ?? ""),
    amount: Number(transaction.amount ?? 0),
    status: String(transaction.status ?? ""),
    paymentMethod: typeof transaction.payment_method === "string" ? transaction.payment_method : null,
    completedAt: typeof transaction.completed_at === "string" ? transaction.completed_at : null,
  };
}

export function createPakasirClient(options: PakasirClientOptions): PakasirClient {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;

  return {
    async getTransactionDetail(input) {
      const url = new URL(`${baseUrl}/api/transactiondetail`);
      url.searchParams.set("project", input.project);
      url.searchParams.set("amount", String(Math.round(input.amount)));
      url.searchParams.set("order_id", input.orderId);
      url.searchParams.set("api_key", options.apiKey);

      const timeout = withTimeout(options.timeoutMs);
      try {
        const response = await fetcher(url, { method: "GET", signal: timeout.controller.signal });
        if (!response.ok) throw new AppError(AppErrorCode.DownstreamError, "Payment provider returned an error.");
        return mapTransaction(await response.json());
      } catch (error) {
        mapProviderError(error);
      } finally {
        timeout.done();
      }
    },
    async simulatePayment(input) {
      const timeout = withTimeout(options.timeoutMs);
      try {
        const response = await fetcher(`${baseUrl}/api/paymentsimulation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: timeout.controller.signal,
          body: JSON.stringify({
            project: input.project,
            order_id: input.orderId,
            amount: Math.round(input.amount),
            api_key: options.apiKey,
          }),
        });
        if (!response.ok) throw new AppError(AppErrorCode.DownstreamError, "Payment simulation failed.");
      } catch (error) {
        mapProviderError(error);
      } finally {
        timeout.done();
      }
    },
  };
}
