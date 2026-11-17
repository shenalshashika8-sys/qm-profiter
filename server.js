
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

require("dotenv").config();

// ------------------------------
// SUPABASE CONFIGURATION
// ------------------------------

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("Missing Supabase environment variables.");
}

const supabase = require("./auth");
const app = express();

const ADMIN_EMAIL = "jathushara54@gmail.com";

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const activityFile = process.env.VERCEL
    ? path.join("/tmp", "activity-log.json")
    : path.join(__dirname, "activity-log.json");

// ------------------------------
// FRONTEND FILE ALLOWLIST
// ------------------------------

const frontendPages = [
    "/index.html",
    "/login.html",
    "/signup.html",
    "/analyzer.html",
    "/signals.html",
    "/chart.html",
    "/calculator.html",
    "/history.html",
    "/profit-cards.html",
    "/admin-subscriptions.html",
    "/vip-signals.html"
];

const frontendAssets = [
    "/style.css",
    "/auth.js",
    "/login.js",
    "/signup.js",
    "/script.js",
    "/analysis.js",
    "/advanced-chart.js",
    "/sw.js"
];

function serveFrontendFile(req, res, next) {
    const filename = req.path.substring(1);
    const filePath = path.join(__dirname, filename);

    res.sendFile(filePath, error => {
        if (error) {
            next(error);
        }
    });
}

app.get(frontendPages, serveFrontendFile);
app.get(frontendAssets, serveFrontendFile);

// ------------------------------
// AUTHENTICATION + SUBSCRIPTION
// ------------------------------

async function authenticateUser(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                error: "Please sign in first."
            });
        }

        const token = authHeader.substring(7).trim();

        if (!token) {
            return res.status(401).json({
                error: "Login token is missing."
            });
        }

        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
            return res.status(401).json({
                error: "Invalid or expired login session."
            });
        }

        req.user = data.user;

        req.userSupabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_ANON_KEY,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                },
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            }
        );

        if (
            req.user.email?.toLowerCase() ===
            ADMIN_EMAIL.toLowerCase()
        ) {
            return next();
        }

        const { data: subscription, error: subscriptionError } =
            await req.userSupabase
                .from("user_subscriptions")
                .select("expires_at, is_paused")
                .eq("user_id", req.user.id)
                .maybeSingle();

        if (subscriptionError) {
            console.error(
                "Subscription verification error:",
                subscriptionError
            );

            return res.status(503).json({
                error: "Unable to verify your subscription. Please try again.",
                code: "SUBSCRIPTION_CHECK_FAILED"
            });
        }

        if (!subscription) {
            return res.status(403).json({
                error: "Your subscription has not been activated.",
                code: "SUBSCRIPTION_REQUIRED"
            });
        }

        if (subscription.is_paused === true) {
            return res.status(403).json({
                error: "Your account access is currently paused. Please contact the administrator.",
                code: "SUBSCRIPTION_PAUSED"
            });
        }

        const expiryTime = new Date(
            subscription.expires_at
        ).getTime();

        if (
            !Number.isFinite(expiryTime) ||
            expiryTime <= Date.now()
        ) {
            return res.status(403).json({
                error: "Your subscription has expired. Please contact the administrator for renewal.",
                code: "SUBSCRIPTION_EXPIRED"
            });
        }

        next();

    } catch (error) {
        console.error("Authentication error:", error);

        return res.status(500).json({
            error: "Authentication or subscription verification failed."
        });
    }
}

// ------------------------------
// ACTIVITY FILE MANAGEMENT
// ------------------------------

function readActivities() {
    if (!fs.existsSync(activityFile)) {
        fs.writeFileSync(activityFile, "[]");
    }

    return JSON.parse(fs.readFileSync(activityFile, "utf8"));
}

function saveActivities(activities) {
    fs.writeFileSync(
        activityFile,
        JSON.stringify(activities, null, 2)
    );
}

// ------------------------------
// ACTIVITY LOGGER
// ------------------------------

function logActivity(type, message, details = {}) {
    const activities = readActivities();

    const activity = {
        id: Date.now().toString() +
            Math.random().toString(36).slice(2, 7),
        type,
        message,
        details,
        createdAt: new Date().toISOString()
    };

    activities.unshift(activity);

    saveActivities(activities.slice(0, 500));

    return activity;
}

// ------------------------------
// FORMAT SUPABASE TRADE
// ------------------------------

function formatTrade(trade) {
    return {
        id: trade.id,
        symbol: trade.symbol,
        direction: trade.direction,
        entry: Number(trade.entry),
        stopLoss: Number(trade.stop_loss),
        takeProfit: Number(trade.take_profit),
        status: trade.status,
        result: trade.result,
        pnl: trade.pnl === null ? null : Number(trade.pnl),
        createdAt: trade.created_at
    };
}

// ------------------------------
// SIMULATED HEATMAP DATA
// ------------------------------

function validateHeatmapSymbol(req, res, next) {
    const symbol = String(req.query.symbol || "BTCUSDT")
        .trim()
        .toUpperCase();

    if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
        return res.status(400).json({
            error: "Invalid demo symbol."
        });
    }

    req.heatmapSymbol = symbol;
    next();
}

function createDemoHeatmapData(symbol) {
    const timeBuckets = 24;
    const priceLevels = 30;

    const now = Date.now();
    const referencePrice = 1000;

    const cells = [];

    for (let t = 0; t < timeBuckets; t++) {
        const timestamp = now - (timeBuckets - 1 - t) * 60000;

        for (let p = 0; p < priceLevels; p++) {
            const price = referencePrice +
                (p - priceLevels / 2) * 2;

            const wave = Math.sin(
                (t * 0.7) + (p * 0.35) + symbol.length
            );

            const intensity = Math.max(
                0,
                Math.min(
                    100,
                    Math.round(
                        15 + Math.abs(wave) * 70 +
                        Math.random() * 15
                    )
                )
            );

            cells.push({
                time: new Date(timestamp).toISOString(),
                price: Number(price.toFixed(2)),
                intensity
            });
        }
    }

    return {
        symbol,
        referencePrice,
        priceUnit: "SIMULATED_PRICE_UNITS",
        cells,
        generatedAt: new Date().toISOString()
    };
}

// ------------------------------
// MARKET OVERVIEW API
// ------------------------------

app.get("/api/market-overview", async (req, res) => {
    try {
        const response = await fetch(
            "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h"
        );

        if (!response.ok) {
            return res.status(502).json({
                error: "Market data provider is temporarily unavailable."
            });
        }

        const coins = await response.json();

        const btc = coins.find(coin => coin.id === "bitcoin");
        const eth = coins.find(coin => coin.id === "ethereum");

        if (!btc || !eth) {
            return res.status(502).json({
                error: "Incomplete market data received."
            });
        }

        const gainers = [...coins]
            .filter(coin => Number.isFinite(coin.price_change_percentage_24h))
            .sort((a, b) =>
                b.price_change_percentage_24h -
                a.price_change_percentage_24h
            )
            .slice(0, 5);

        const losers = [...coins]
            .filter(coin => Number.isFinite(coin.price_change_percentage_24h))
            .sort((a, b) =>
                a.price_change_percentage_24h -
                b.price_change_percentage_24h
            )
            .slice(0, 5);

        res.json({
            status: "success",
            currency: "USD",
            bitcoin: {
                price: btc.current_price,
                change24h: btc.price_change_percentage_24h
            },
            ethereum: {
                price: eth.current_price,
                change24h: eth.price_change_percentage_24h
            },
            marketCap: coins.reduce(
                (total, coin) =>
                    total + (coin.market_cap || 0),
                0
            ),
            volume24h: coins.reduce(
                (total, coin) =>
                    total + (coin.total_volume || 0),
                0
            ),
            gainers,
            losers,
            updatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("Market overview error:", error);

        res.status(500).json({
            error: "Unable to load market overview."
        });
    }
});

// ------------------------------
// HOME / DASHBOARD
// ------------------------------

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});
// ------------------------------
// LIQUIDATION HEATMAP DEMO API
// ------------------------------

app.get(
    "/api/heatmaps/liquidation",
    authenticateUser,
    validateHeatmapSymbol,
    (req, res) => {
        try {
            const demo = createDemoHeatmapData(
                req.heatmapSymbol
            );

            res.json({
                status: "success",
                mode: "SIMULATED_DEMO",
                title: "Liquidation Heatmap Demo",
                disclaimer: "This is randomly generated demonstration data. It does not represent actual liquidations, exchange data, or market conditions.",
                ...demo
            });

        } catch (error) {
            console.error("Liquidation demo error:", error);

            res.status(500).json({
                error: "Could not generate liquidation demo data."
            });
        }
    }
);

// ------------------------------
// ORDER BOOK HEATMAP DEMO API
// ------------------------------

app.get(
    "/api/heatmaps/order-book",
    authenticateUser,
    validateHeatmapSymbol,
    (req, res) => {
        try {
            const levels = 40;
            const referencePrice = 1000;
            const orderBook = [];

            for (let i = 0; i < levels; i++) {
                const distance = (i + 1) * 1.5;

                const bidIntensity = Math.round(
                    10 + Math.random() * 90
                );

                const askIntensity = Math.round(
                    10 + Math.random() * 90
                );

                orderBook.push({
                    bidPrice: Number(
                        (referencePrice - distance).toFixed(2)
                    ),
                    bidIntensity,
                    askPrice: Number(
                        (referencePrice + distance).toFixed(2)
                    ),
                    askIntensity
                });
            }

            res.json({
                status: "success",
                mode: "SIMULATED_DEMO",
                title: "Order Book Heatmap Demo",
                symbol: req.heatmapSymbol,
                referencePrice,
                priceUnit: "SIMULATED_PRICE_UNITS",
                disclaimer: "This is randomly generated demonstration data. It does not represent real exchange orders, liquidity, or market conditions.",
                orderBook,
                generatedAt: new Date().toISOString()
            });

        } catch (error) {
            console.error("Order book demo error:", error);

            res.status(500).json({
                error: "Could not generate order book demo data."
            });
        }
    }
);

// ------------------------------
// MARKET ANALYSIS
// ------------------------------

app.post(
    "/api/analyze",
    authenticateUser,
    (req, res) => {
        const { indicators } = req.body;

        if (!indicators) {
            return res.status(400).json({
                error: "Market indicators are required."
            });
        }

        res.json({
            status: "received",
            message: "Market data received successfully.",
            indicators
        });
    }
);

// ------------------------------
// GET USER'S OWN PAPER TRADES
// ------------------------------

app.get(
    "/api/paper-trades",
    authenticateUser,
    async (req, res) => {
        try {
            const { data, error } = await req.userSupabase
                .from("paper_trades")
                .select("*")
                .eq("user_id", req.user.id)
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Trade history error:", error);

                return res.status(500).json({
                    error: "Could not load your trade history."
                });
            }

            res.json((data || []).map(formatTrade));

        } catch (error) {
            console.error("Trade history error:", error);

            res.status(500).json({
                error: "Could not load your trade history."
            });
        }
    }
);

// ------------------------------
// SAVE USER'S SIMULATED SCENARIO
// ------------------------------

app.post(
    "/api/paper-trades",
    authenticateUser,
    async (req, res) => {
        try {
            const {
                symbol,
                direction,
                entry,
                stopLoss,
                takeProfit
            } = req.body;

            if (
                typeof symbol !== "string" ||
                !symbol.trim() ||
                symbol.trim().length > 50 ||
                !["LONG", "SHORT"].includes(direction) ||
                ![entry, stopLoss, takeProfit].every(
                    value =>
                        typeof value === "number" &&
                        Number.isFinite(value)
                )
            ) {
                return res.status(400).json({
                    error: "Please provide valid simulated trade details."
                });
            }

            const { data, error } = await req.userSupabase
                .from("paper_trades")
                .insert({
                    user_id: req.user.id,
                    symbol: symbol.trim(),
                    direction,
                    entry,
                    stop_loss: stopLoss,
                    take_profit: takeProfit,
                    status: "SIMULATED"
                })
                .select()
                .single();

            if (error) {
                console.error("Supabase save error:", error);

                return res.status(500).json({
                    error: "Could not save simulated trade."
                });
            }

            res.status(201).json({
                message: "Simulated trade saved successfully.",
                trade: formatTrade(data)
            });

        } catch (error) {
            console.error("Save scenario error:", error);

            res.status(500).json({
                error: "Could not save simulated trade."
            });
        }
    }
);

// ------------------------------
// UPDATE USER'S SIMULATED TRADE
// ------------------------------

app.patch(
    "/api/paper-trades/:id/result",
    authenticateUser,
    async (req, res) => {
        try {
            const { result, pnl } = req.body;

            if (
                !["WIN", "LOSS", "BREAK_EVEN"].includes(result) ||
                typeof pnl !== "number" ||
                !Number.isFinite(pnl)
            ) {
                return res.status(400).json({
                    error: "Invalid simulated trade result."
                });
            }

            const { data: existingTrade, error: lookupError } =
                await req.userSupabase
                    .from("paper_trades")
                    .select("id, status")
                    .eq("id", req.params.id)
                    .eq("user_id", req.user.id)
                    .maybeSingle();

            if (lookupError) {
                console.error("Trade lookup error:", lookupError);

                return res.status(500).json({
                    error: "Could not find simulated trade."
                });
            }

            if (!existingTrade) {
                return res.status(404).json({
                    error: "Simulated trade not found."
                });
            }

            if (existingTrade.status === "COMPLETED") {
                return res.status(409).json({
                    error: "This simulated outcome has already been recorded."
                });
            }

            const { data, error } = await req.userSupabase
                .from("paper_trades")
                .update({
                    result,
                    pnl,
                    status: "COMPLETED"
                })
                .eq("id", req.params.id)
                .eq("user_id", req.user.id)
                .eq("status", "SIMULATED")
                .select()
                .maybeSingle();

            if (error) {
                console.error("Trade update error:", error);

                return res.status(500).json({
                    error: "Could not update simulated trade."
                });
            }

            if (!data) {
                return res.status(409).json({
                    error: "This simulated trade has already been updated."
                });
            }

            res.json({
                message: "Simulated outcome saved.",
                trade: formatTrade(data)
            });

        } catch (error) {
            console.error("Outcome update error:", error);

            res.status(500).json({
                error: "Could not update simulated trade."
            });
        }
    }
);

// ------------------------------
// USER'S PAPER TRADING STATISTICS
// ------------------------------

app.get(
    "/api/paper-trades/stats",
    authenticateUser,
    async (req, res) => {
        try {
            const { data, error } = await req.userSupabase
                .from("paper_trades")
                .select("status, result, pnl")
                .eq("user_id", req.user.id);

            if (error) {
                console.error("Statistics error:", error);

                return res.status(500).json({
                    error: "Could not calculate statistics."
                });
            }

            const trades = data || [];

            const completed = trades.filter(
                trade => trade.status === "COMPLETED"
            );

            const wins = completed.filter(
                trade => trade.result === "WIN"
            ).length;

            const losses = completed.filter(
                trade => trade.result === "LOSS"
            ).length;

            const breakEven = completed.filter(
                trade => trade.result === "BREAK_EVEN"
            ).length;

            const totalPnL = completed.reduce(
                (total, trade) => total + Number(trade.pnl || 0),
                0
            );

            const winRate = completed.length > 0
                ? (wins / completed.length) * 100
                : 0;

            res.json({
                totalTrades: trades.length,
                completedTrades: completed.length,
                wins,
                losses,
                breakEven,
                winRate: Number(winRate.toFixed(2)),
                simulatedPnL: Number(totalPnL.toFixed(2))
            });

        } catch (error) {
            console.error("Statistics error:", error);

            res.status(500).json({
                error: "Could not calculate statistics."
            });
        }
    }
);

// ------------------------------
// GET SYSTEM ACTIVITY LOG
// ------------------------------

app.get("/api/activity", (req, res) => {
    try {
        res.json(readActivities());

    } catch (error) {
        console.error("Activity load error:", error);

        res.status(500).json({
            error: "Could not load activity log."
        });
    }
});

// ------------------------------
// RECORD SYSTEM ACTIVITY
// ------------------------------

app.post("/api/activity", (req, res) => {
    try {
        const { type, message } = req.body;

        const allowedTypes = [
            "SYSTEM_ONLINE",
            "SYSTEM_OFFLINE",
            "MARKET_DATA_LOADED",
            "MARKET_DATA_UNAVAILABLE"
        ];

        if (
            !allowedTypes.includes(type) ||
            typeof message !== "string" ||
            !message.trim() ||
            message.length > 200
        ) {
            return res.status(400).json({
                error: "Invalid system activity."
            });
        }

        const activity = logActivity(
            type,
            message.trim()
        );

        res.status(201).json({
            message: "Activity recorded successfully.",
            activity
        });

    } catch (error) {
        console.error("Activity save error:", error);

        res.status(500).json({
            error: "Could not record activity."
        });
    }
});

// ------------------------------
// HANDLE INVALID JSON
// ------------------------------

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({
            error: "Invalid JSON request."
        });
    }

    console.error("Server error:", error);

    if (res.headersSent) {
        return next(error);
    }

    res.status(500).json({
        error: "Internal server error."
    });
});

// ------------------------------
// EXPORT EXPRESS APP FOR VERCEL
// ------------------------------

module.exports = app;

// ------------------------------
// START SERVER LOCALLY
// ------------------------------

if (require.main === module) {
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(
            `QM PROFITER backend running at http://localhost:${PORT}`
        );
    });
}
