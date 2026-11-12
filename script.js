
async function loadCryptoPrices() {
    const btcElement = document.getElementById("btc-price");
    const ethElement = document.getElementById("eth-price");

    try {
        const response = await fetch(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd"
        );

        if (!response.ok) {
            throw new Error("Market data unavailable");
        }

        const data = await response.json();

        btcElement.textContent =
            "$" + data.bitcoin.usd.toLocaleString("en-US");

        ethElement.textContent =
            "$" + data.ethereum.usd.toLocaleString("en-US");

    } catch (error) {
        btcElement.textContent = "Unavailable";
        ethElement.textContent = "Unavailable";

        console.error("Price error:", error);
    }
}

loadCryptoPrices();

// Refresh prices every 60 seconds
setInterval(loadCryptoPrices, 60000);
