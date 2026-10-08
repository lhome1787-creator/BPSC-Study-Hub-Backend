require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());

// Raw body save करेंगे ताकि Razorpay signature verify हो सके
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
);

// Home
app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "BPSC Study Hub Backend is running"
    });
});

// Razorpay test
app.get("/razorpay-test", async (req, res) => {
    try {
        await razorpay.orders.all({
            count: 1
        });

        res.json({
            status: "success",
            message: "Razorpay connection successful"
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            status: "error",
            message: "Razorpay connection failed"
        });
    }
});

// SLET Paid Access Check
app.get("/check-access", async (req, res) => {

    const email = req.query.email?.trim().toLowerCase();
    const paymentId = req.query.paymentId?.trim();

    if (!email && !paymentId) {
        return res.status(400).json({
            access: false,
            message: "Email or Payment ID is required"
        });
    }

    try {

        // Payment ID से check
        if (paymentId) {

            const { data, error } = await supabase
                .from("paid_users")
                .select("id")
                .eq("payment_id", paymentId)
                .eq("product", "SLET 2026 Test Series")
                .limit(1);

            if (error) {
                console.error("❌ Payment ID Access Check Error:", error);

                return res.status(500).json({
                    access: false,
                    message: "Database check failed"
                });
            }

            if (data && data.length > 0) {
                return res.json({
                    access: true,
                    message: "SLET access granted"
                });
            }
        }

        // Email से check
        if (email) {

            const { data, error } = await supabase
                .from("paid_users")
                .select("id")
                .eq("email", email)
                .eq("product", "SLET 2026 Test Series")
                .limit(1);

            if (error) {
                console.error("❌ Email Access Check Error:", error);

                return res.status(500).json({
                    access: false,
                    message: "Database check failed"
                });
            }

            if (data && data.length > 0) {
                return res.json({
                    access: true,
                    message: "SLET access granted"
                });
            }
        }

        return res.json({
            access: false,
            message: "Payment not found"
        });

    } catch (error) {

        console.error("❌ Server Error:", error);

        return res.status(500).json({
            access: false,
            message: "Server error"
        });
    }
});
// Razorpay Webhook
app.post("/webhook", async (req, res) => {

    console.log("Razorpay webhook received");

    const webhookSignature =
        req.headers["x-razorpay-signature"];

    const webhookSecret =
        process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSignature || !webhookSecret) {
        console.log("Webhook signature or secret missing");

        return res.status(400).json({
            status: "error",
            message: "Webhook signature missing"
        });
    }

    const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(req.rawBody)
        .digest("hex");

    // Signature length check
    if (expectedSignature.length !== webhookSignature.length) {
        return res.status(400).json({
            status: "error",
            message: "Invalid webhook signature"
        });
    }

    const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(webhookSignature)
    );

    if (!isValid) {
        console.log("Invalid Razorpay webhook signature");

        return res.status(400).json({
            status: "error",
            message: "Invalid webhook signature"
        });
    }

    console.log("✅ Razorpay webhook signature verified");

    console.log("Event:", req.body.event);

    // Payment successful
    if (req.body.event === "payment_link.paid") {

        console.log("💰 Payment Link PAID");

        const paymentLink =
            req.body.payload?.payment_link?.entity;

        const payment =
            req.body.payload?.payment?.entity;

        console.log("Payment Link Data:", paymentLink);
        console.log("Payment Data:", payment);

        const email = payment?.email || paymentLink?.customer?.email || null;

        const paymentLinkId =
            paymentLink?.id || null;

        const paymentId =
            payment?.id || null;

        const product = "SLET 2026 Test Series";

        // Supabase में payment save करें
        const { data, error } = await supabase
            .from("paid_users")
            .insert([
                {
                    email: email,
                    payment_link_id: paymentLinkId,
                    payment_id: paymentId,
                    product: product
                }
            ])
            .select();

        if (error) {
            console.error("❌ Supabase Error:", error);

            return res.status(500).json({
                status: "error",
                message: "Payment received but database save failed"
            });
        }

        console.log("✅ Payment saved in Supabase:", data);
    }

    res.status(200).json({
        status: "success"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
