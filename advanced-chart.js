
// ==========================================
// QM PROFITER - ADVANCED CHART ENGINE
// Educational strategy visualization
// Lightweight Charts v4.2.2
// ==========================================

window.QMAdvancedChart = {

    chart: null,
    candles: null,
    volume: null,

    analysisLines: [],
    analysisMarkers: [],
    resizeObserver: null,

    // ======================================
    // INITIALIZE CHART
    // ======================================

    initialize(containerId) {

        const container = document.getElementById(containerId);

        if (
            !container ||
            !window.LightweightCharts
        ) {
            console.error("Chart container or library not found.");
            return false;
        }

        if (this.chart) {
            this.chart.remove();
            this.chart = null;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        this.chart = window.LightweightCharts.createChart(
            container,
            {
                width: Math.max(container.clientWidth, 300),
                height: 480,

                layout: {
                    background: { color: "#080d18" },
                    textColor: "#aab7ca"
                },

                grid: {
                    vertLines: { color: "#182438" },
                    horzLines: { color: "#182438" }
                },

                rightPriceScale: {
                    borderColor: "#293952"
                },

                timeScale: {
                    borderColor: "#293952",
                    timeVisible: true,
                    secondsVisible: false
                },

                crosshair: {
                    mode: 0
                }
            }
        );

        this.candles = this.chart.addCandlestickSeries({
            upColor: "#20d9a0",
            downColor: "#ff6177",
            borderUpColor: "#20d9a0",
            borderDownColor: "#ff6177",
            wickUpColor: "#20d9a0",
            wickDownColor: "#ff6177"
        });

        this.volume = this.chart.addHistogramSeries({
            priceFormat: {
                type: "volume"
            },
            priceScaleId: "volume"
        });

        this.chart.priceScale("volume").applyOptions({
            scaleMargins: {
                top: 0.82,
                bottom: 0
            }
        });

        this.resizeObserver = new ResizeObserver(() => {

            if (this.chart) {

                this.chart.applyOptions({
                    width: Math.max(container.clientWidth, 300)
                });

            }

        });

        this.resizeObserver.observe(container);

        console.log("QM PROFITER chart initialized.");

        return true;
    },


    // ======================================
    // LOAD CANDLES
    // Coinbase format:
    // [time, low, high, open, close, volume]
    // ======================================

    setCandles(coinbaseCandles) {

        if (!this.candles || !this.volume) return;

        const sorted = [...coinbaseCandles].sort(
            (a, b) => a[0] - b[0]
        );

        const candleData = sorted.map(c => ({
            time: Number(c[0]),
            open: Number(c[3]),
            high: Number(c[2]),
            low: Number(c[1]),
            close: Number(c[4])
        }));

        const volumeData = sorted.map(c => ({
            time: Number(c[0]),
            value: Number(c[5]),
            color: Number(c[4]) >= Number(c[3])
                ? "#168f72"
                : "#b94358"
        }));

        this.candles.setData(candleData);

        this.volume.setData(volumeData);

        this.chart.timeScale().fitContent();

    },


    // ======================================
    // CLEAR ALL ANALYSIS DRAWINGS
    // ======================================

    clearAnalysis() {

        if (!this.candles) return;

        this.analysisLines.forEach(line => {

            this.candles.removePriceLine(line);

        });

        this.analysisLines = [];

        this.analysisMarkers = [];

        this.candles.setMarkers([]);

    },


    // ======================================
    // ADD PRICE LINES
    // ======================================

    addAnalysisLines(levels) {

        if (!this.candles || !Array.isArray(levels)) return;

        levels.forEach(level => {

            const price = Number(level.price);

            if (!Number.isFinite(price) || price <= 0) return;

            const line = this.candles.createPriceLine({

                price: price,

                color: level.color || "#aab7ca",

                lineWidth: level.lineWidth || 2,

                lineStyle: level.lineStyle !== undefined
                    ? level.lineStyle
                    : window.LightweightCharts.LineStyle.Dashed,

                axisLabelVisible: true,

                title: level.title || "LEVEL"

            });

            this.analysisLines.push(line);

        });

    },


    // ======================================
    // ADD CHART MARKERS
    // ======================================

    addMarkers(markers) {

        if (!this.candles || !Array.isArray(markers)) return;

        const validMarkers = markers
            .filter(marker =>
                Number.isFinite(Number(marker.time)) &&
                ["aboveBar", "belowBar", "inBar"].includes(marker.position)
            )
            .map(marker => ({

                time: Number(marker.time),

                position: marker.position,

                color: marker.color || "#ffc65c",

                shape: marker.shape || "circle",

                text: String(marker.text || "")

            }))
            .sort((a, b) => a.time - b.time);

        this.analysisMarkers = validMarkers;

        this.candles.setMarkers(validMarkers);

    },


    // ======================================
    // DRAW COMPLETE STRATEGY ANALYSIS
    // ======================================

    renderAnalysis(analysis) {

        if (!this.candles || !analysis) return;

        this.clearAnalysis();

        // Draw all price levels.

        if (Array.isArray(analysis.levels)) {

            this.addAnalysisLines(analysis.levels);

        }

        // Draw strategy labels on candles.

        if (Array.isArray(analysis.markers)) {

            this.addMarkers(analysis.markers);

        }

        console.log(
            "QM PROFITER strategy drawings updated.",
            analysis
        );

    },


    // ======================================
    // DRAW ENTRY / SL / TP LEVELS
    // ======================================

    drawScenario(scenario) {

        if (!this.candles || !scenario) return;

        const levels = [

            {
                price: scenario.entry,
                color: "#ffffff",
                title: "ENTRY",
                lineWidth: 2
            },

            {
                price: scenario.stopLoss,
                color: "#ff6177",
                title: "STOP LOSS",
                lineWidth: 2
            },

            {
                price: scenario.tp1,
                color: "#20d9a0",
                title: "TAKE PROFIT 1",
                lineWidth: 2
            },

            {
                price: scenario.tp2,
                color: "#20d9a0",
                title: "TAKE PROFIT 2",
                lineWidth: 2
            },

            {
                price: scenario.tp3,
                color: "#20d9a0",
                title: "TAKE PROFIT 3",
                lineWidth: 2
            }

        ];

        this.addAnalysisLines(levels);

    },


    // ======================================
    // CHART RESET
    // ======================================

    reset() {

        this.clearAnalysis();

        if (this.chart) {

            this.chart.timeScale().fitContent();

        }

    }

};

console.log("QM PROFITER Advanced Chart Engine loaded.");
