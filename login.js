
const SUPABASE_URL = "https://wuvzojlpegfqwsfhoobc.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_VnpF9r4AtZmiNLdO8SzBvg_WCb-PF2t";

const ADMIN_EMAIL = "jathushara54@gmail.com";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const loginForm = document.getElementById("login-form");
const message = document.getElementById("message");
const loginButton = document.getElementById("login-button");


/* CHECK USER SUBSCRIPTION */

async function checkSubscription(user) {

    // Admin bypass
    if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        return { allowed: true };
    }

    // Get this user's subscription
    const { data, error } = await supabaseClient
        .from("user_subscriptions")
        .select("expires_at, is_paused")
        .eq("user_id", user.id)
        .maybeSingle();

    // Fail closed if the subscription check fails
    if (error) {
        console.error("Subscription check error:", error);

        return {
            allowed: false,
            reason: "Unable to verify your subscription. Please try again later."
        };
    }

    // No subscription
    if (!data) {
        return {
            allowed: false,
            reason: "Your account has not been activated. Please contact the administrator."
        };
    }

    // Paused account
    if (data.is_paused === true) {
        return {
            allowed: false,
            reason: "Your access has been paused by the administrator."
        };
    }

    // Expired subscription
    const expiryTime = new Date(data.expires_at).getTime();

    if (!Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
        return {
            allowed: false,
            reason: "Your subscription has expired. Please contact the administrator for renewal."
        };
    }

    return { allowed: true };
}


/* LOGIN */

loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";
    message.style.color = "#ff7777";

    loginButton.disabled = true;
    loginButton.textContent = "SIGNING IN...";

    try {

        // Sign in
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            throw error;
        }

        // Check subscription
        message.style.color = "#ffd400";
        message.textContent = "Checking subscription...";

        const subscription = await checkSubscription(data.user);

        if (!subscription.allowed) {

            // Remove session if access is not allowed
            await supabaseClient.auth.signOut();

            throw new Error(subscription.reason);
        }

        // Subscription valid
        message.style.color = "#42d392";
        message.textContent = "Login successful!";

        window.location.href = "/index.html";

    } catch (error) {

        message.style.color = "#ff7777";
        message.textContent = error.message;

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "SIGN IN";

    }

});
