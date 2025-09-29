const midtransClient = require("midtrans-client");
const crypto = require("crypto");

const midtransConfig = {
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY,
};

if (!midtransConfig.serverKey || !midtransConfig.clientKey) {
  console.error("Midtrans configuration error:");
  console.error(
    "MIDTRANS_SERVER_KEY:",
    midtransConfig.serverKey ? "✅ Set" : "❌ Missing"
  );
  console.error(
    "MIDTRANS_CLIENT_KEY:",
    midtransConfig.clientKey ? "✅ Set" : "❌ Missing"
  );
  console.error(
    "Please set MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY in .env file"
  );

  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
} else {
  console.log("Midtrans configuration loaded successfully");
  console.log(
    `   Environment: ${midtransConfig.isProduction ? "Production" : "Sandbox"}`
  );
}

const snap = new midtransClient.Snap({
  isProduction: midtransConfig.isProduction,
  serverKey: midtransConfig.serverKey,
});

const coreApi = new midtransClient.CoreApi({
  isProduction: midtransConfig.isProduction,
  serverKey: midtransConfig.serverKey,
});

const createPaymentParameter = (orderData) => {
  const {
    orderId,
    amount,
    customerDetails,
    itemDetails,
    customFields = {},
    expiry = { unit: "minutes", duration: 60 },
  } = orderData;

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    credit_card: {
      secure: true,
    },
    customer_details: {
      first_name: customerDetails.first_name || customerDetails.name,
      last_name: customerDetails.last_name || "",
      email: customerDetails.email,
      phone: customerDetails.phone,
    },
    item_details: itemDetails.map((item) => ({
      id: String(item.id),
      price: item.price,
      quantity: item.quantity,
      name: item.name,
      brand: item.brand || "Legacy Training",
      category: item.category || "Training Program",
    })),
    callbacks: {
      finish: `${process.env.LANDING_FRONTEND_URL}/payment/success`,
      error: `${process.env.LANDING_FRONTEND_URL}/payment/error`,
      pending: `${process.env.LANDING_FRONTEND_URL}/payment/pending`,
    },
    expiry: {
      start_time: new Date().toISOString().slice(0, 19) + " +0700",
      unit: expiry.unit,
      duration: expiry.duration,
    },
  };

  if (customFields.custom_field1)
    parameter.custom_field1 = customFields.custom_field1;
  if (customFields.custom_field2)
    parameter.custom_field2 = customFields.custom_field2;
  if (customFields.custom_field3)
    parameter.custom_field3 = customFields.custom_field3;

  return parameter;
};

const createPaymentToken = async (orderData) => {
  try {
    const parameter = createPaymentParameter(orderData);

    const transaction = await snap.createTransaction(parameter);

    console.log("Payment token created successfully:", {
      token: transaction.token,
      redirect_url: transaction.redirect_url,
    });

    return {
      success: true,
      data: {
        token: transaction.token,
        redirect_url: transaction.redirect_url,
      },
    };
  } catch (error) {
    console.error("Midtrans payment creation error:", error);
    return {
      success: false,
      error: error.message,
      details: error.ApiResponse || error.httpResponseBody,
    };
  }
};

const getTransactionStatus = async (orderId) => {
  try {
    console.log(`Checking transaction status for: ${orderId}`);

    const statusResponse = await coreApi.transaction.status(orderId);

    console.log(`Transaction status for ${orderId}:`, statusResponse);

    return {
      success: true,
      data: statusResponse,
    };
  } catch (error) {
    console.error("Midtrans status check error:", error);
    return {
      success: false,
      error: error.message,
      details: error.ApiResponse || error.httpResponseBody,
    };
  }
};

const cancelTransaction = async (orderId) => {
  try {
    console.log(`Cancelling transaction: ${orderId}`);

    const cancelResponse = await coreApi.transaction.cancel(orderId);

    console.log(`Transaction cancelled for ${orderId}:`, cancelResponse);

    return {
      success: true,
      data: cancelResponse,
    };
  } catch (error) {
    console.error("Midtrans cancel error:", error);
    return {
      success: false,
      error: error.message,
      details: error.ApiResponse || error.httpResponseBody,
    };
  }
};

const validateNotificationSignature = (notification) => {
  try {
    const { order_id, status_code, gross_amount, signature_key } = notification;
    const serverKey = midtransConfig.serverKey;

    if (
      !order_id ||
      !status_code ||
      !gross_amount ||
      !signature_key ||
      !serverKey
    ) {
      console.error("Missing required fields for signature validation");
      return false;
    }

    // Buat hash signature untuk validasi
    const input = order_id + status_code + gross_amount + serverKey;
    const hash = crypto.createHash("sha512").update(input).digest("hex");

    const isValid = hash === signature_key;

    console.log(`Signature validation for ${order_id}:`, {
      input: `${order_id}${status_code}${gross_amount}[SERVER_KEY]`,
      expected: signature_key,
      generated: hash,
      valid: isValid,
    });

    return isValid;
  } catch (error) {
    console.error("Signature validation error:", error);
    return false;
  }
};

const mapPaymentStatus = (midtransStatus, fraudStatus = null) => {
  const statusMap = {
    capture: fraudStatus === "accept" ? "paid" : "pending",
    settlement: "paid",
    pending: "pending",
    deny: "failed",
    cancel: "cancelled",
    expire: "expired",
    failure: "failed",
  };

  const mappedStatus = statusMap[midtransStatus] || "pending";

  console.log(
    `Status mapping: ${midtransStatus} (fraud: ${fraudStatus}) → ${mappedStatus}`
  );

  return mappedStatus;
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
};

const generateOrderId = (prefix = "ORDER", suffix = "") => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}${suffix ? `-${suffix}` : ""}`;
};

const logMidtransRequest = (req, res, next) => {
  if (req.path.includes("/payment")) {
    console.log(`Midtrans API Request: ${req.method} ${req.path}`);
    console.log("Headers:", req.headers);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log("Body:", JSON.stringify(req.body, null, 2));
    }
  }
  next();
};

const testMidtransConnection = async () => {
  try {
    await snap.createTransactionToken({
      transaction_details: {
        order_id: "TEST-CONNECTION-" + Date.now(),
        gross_amount: 1000,
      },
    });
    console.log("Midtrans connection OK (token created).");
  } catch (err) {
    console.error("Midtrans connection failed:", err.message);
  }
};

if (process.env.NODE_ENV !== "production") {
  setTimeout(() => {
    testMidtransConnection();
  }, 2000);
}

module.exports = {
  snap,
  coreApi,
  createPaymentToken,
  getTransactionStatus,
  cancelTransaction,
  validateNotificationSignature,
  mapPaymentStatus,
  formatCurrency,
  generateOrderId,
  logMidtransRequest,
  testMidtransConnection,
  midtransConfig,
};
