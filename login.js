
const SUPABASE_URL = "https://wuvzojlpegfqwsfhoobc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_VnpF9r4AtZmiNLdO8SzBvg_WCb-PF2t";
const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const loginForm = document.getElementById("login-form");
const message = document.getElementById("message");
const loginButton = document.getElementById("login-button");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "";
    loginButton.disabled = true;
    loginButton.textContent = "SIGNING IN...";

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

        if (error) {
            throw error;
        }

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
