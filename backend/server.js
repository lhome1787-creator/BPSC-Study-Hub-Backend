require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 5000;

app.post("/webhook", (req, res) => {
    console.log("Razorpay webhook received");

    console.log(req.body);

    res.status(200).json({
        status: "success"
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});