
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
    console.error("Missing Supabase environment variables in .env");
    process.exit(1);
}

const supabase = require("./auth");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const activityFile = process.env.VERCEL
    ? path.join("/tmp", "activity-log.json")
    : path.join(__dirname, "activity-log.json");

// ------------------------------
// AUTHENTICATION
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

        // Use the signed-in user's token.
        // Supabase RLS will enforce data ownership.

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

        next();

    } catch (error) {
        console.error("Authentication error:", error);

        return res.status(401).json({
            error: "Authentication failed."
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
// HOME / SERVER STATUS
// ------------------------------

app.get("/", (req, res) => {
    res.json({
        status: "online",
        software: "QM PROFITER"
    });
});

// ------------------------------
// MARKET ANALYSIS
// ------------------------------

app.post("/api/analyze", (req, res) => {
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
});

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
            error: "Could not record system activity."
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

    next(error);
});

// ------------------------------
// START SERVER
// ------------------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(
        `QM PROFITER backend running at http://localhost:${PORT}`
    );
});
