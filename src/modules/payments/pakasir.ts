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
}) {
  const baseUrl = input.paymentBaseUrl.replace(/\/$/, "");
  const slug = encodeURIComponent(input.projectSlug);
  const amount = encodeURIComponent(String(Math.round(input.amount)));
  const orderId = encodeURIComponent(input.orderId);

  return `${baseUrl}/pay/${slug}/${amount}?order_id=${orderId}`;
}

export function buildPaymentInstruction(paymentUrl: string) {
  return `Open the payment URL to complete payment: ${paymentUrl}`;
}
