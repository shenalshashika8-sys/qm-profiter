
const QMAnalysis = {
    calculateEMA(values, period) {
        if (values.length < period) return null;

        const multiplier = 2 / (period + 1);
        let ema = values.slice(0, period)
            .reduce((sum, value) => sum + value, 0) / period;

        for (let i = period; i < values.length; i++) {
            ema = (values[i] - ema) * multiplier + ema;
        }

        return ema;
    },

    calculateRSI(values, period = 14) {
        if (values.length <= period) return null;

        let gains = 0;
        let losses = 0;

        for (let i = 1; i <= period; i++) {
            const change = values[i] - values[i - 1];

            if (change > 0) gains += change;
            else losses += Math.abs(change);
        }

        let averageGain = gains / period;
        let averageLoss = losses / period;

        for (let i = period + 1; i < values.length; i++) {
            const change = values[i] - values[i - 1];

            averageGain =
                (averageGain * (period - 1) + Math.max(change, 0)) / period;

            averageLoss =
                (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
        }

        if (averageLoss === 0) return 100;

        const rs = averageGain / averageLoss;
        return 100 - (100 / (1 + rs));
    },

    calculateMACD(values) {
        if (values.length < 35) return null;

        const ema12 = this.calculateEMA(values, 12);
        const ema26 = this.calculateEMA(values, 26);

        return ema12 - ema26;
    },

    calculateSupportResistance(candles, period = 20) {
        const recent = candles.slice(-period);

        return {
            support: Math.min(...recent.map(candle => candle.low)),
            resistance: Math.max(...recent.map(candle => candle.high))
        };
    },

    analyze(candles) {
        if (!Array.isArray(candles) || candles.length < 50) {
            throw new Error("At least 50 candles are required.");
        }

        const closes = candles.map(candle => Number(candle.close));

        if (closes.some(value => !Number.isFinite(value) || value <= 0)) {
            throw new Error("Invalid candle price data.");
        }

        const ema20 = this.calculateEMA(closes, 20);
        const ema50 = this.calculateEMA(closes, 50);
        const rsi = this.calculateRSI(closes);
        const macd = this.calculateMACD(closes);

        const levels = this.calculateSupportResistance(candles);

        const currentPrice = closes[closes.length - 1];

        let trend = "SIDEWAYS";

        if (ema20 > ema50 && currentPrice > ema20) {
            trend = "UPTREND";
        } else if (ema20 < ema50 && currentPrice < ema20) {
            trend = "DOWNTREND";
        }

        let momentum = "NEUTRAL";

        if (rsi >= 55) momentum = "POSITIVE";
        if (rsi <= 45) momentum = "NEGATIVE";

        return {
            currentPrice,
            ema20,
            ema50,
            rsi,
            macd,
            trend,
            momentum,
            support: levels.support,
            resistance: levels.resistance,
            timestamp: new Date().toISOString()
        };
    }
};

window.QMAnalysis = QMAnalysis;
