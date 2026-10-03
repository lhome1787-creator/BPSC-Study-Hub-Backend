require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(cors());

// Raw body भी save करेंगे, ताकि Razorpay signature verify हो सके
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.get("/", (req, res) => {
    res.json({
        status: "success",
        message: "BPSC Study Hub Backend is running"
    });
});

// Test Razorpay connection
app.get("/razorpay-test", async (req, res) => {
    try {
        const orders = await razorpay.orders.all({
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

// Razorpay Webhook
app.post("/webhook", (req, res) => {

    console.log("Razorpay webhook received");

    const webhookSignature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

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

    if (req.body.event === "payment_link.paid") {
        console.log("💰 Payment Link PAID");

        console.log(
            "Payment Link Data:",
            req.body.payload?.payment_link
        );
    }

    res.status(200).json({
        status: "success"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});