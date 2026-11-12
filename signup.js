
const SUPABASE_URL = "https://wuvzojlpegfqwsfhoobc.supabase.co";

// Your existing Supabase publishable key
const SUPABASE_ANON_KEY = "sb_publishable_VnpF9r4AtZmiNLdO8SzBvg_WCb-PF2t";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const signupForm = document.getElementById("signupForm");
const signupBtn = document.getElementById("signupBtn");
const message = document.getElementById("message");

signupForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password.length < 8) {
        message.textContent = "Password must contain at least 8 characters.";
        return;
    }

    if (password !== confirmPassword) {
        message.textContent = "Passwords do not match.";
        return;
    }

    signupBtn.disabled = true;
    signupBtn.textContent = "CREATING ACCOUNT...";
    message.textContent = "";

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                emailRedirectTo: "http://127.0.0.1:5500/login.html"
            }
        });

        if (error) {
            throw error;
        }

        if (data.session) {
            message.style.color = "#20d6a0";
            message.textContent = "Account created successfully!";
            window.location.replace("index.html");
        } else {
            message.style.color = "#20d6a0";
            message.textContent =
                "Account created! Please check your email and confirm your account before logging in.";
        }

    } catch (error) {
        message.style.color = "#ff7777";
        message.textContent = error.message;

    } finally {
        signupBtn.disabled = false;
        signupBtn.textContent = "CREATE ACCOUNT";
    }
});
