const firebaseConfig = {
  apiKey: "AIzaSyDzs75cgOPRzG2q_6_ofCIJ-lTKcSB3YK4",
  authDomain: "chattrix-e70e2.firebaseapp.com",
  projectId: "chattrix-e70e2",
  storageBucket: "chattrix-e70e2.firebasestorage.app",
  messagingSenderId: "381880163728",
  appId: "1:381880163728:web:cf07f5fdf20e7b3edfa715",
  measurementId: "G-WHTCTFD1JN"
};
// ------------------------------------------------------------

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const lockScreen = document.getElementById("lockScreen");

let mode = "login"; // login or signup

function toggleMode() {
    const title = document.getElementById("title");
    const btn = document.getElementById("login-btn");
    const switcher = document.querySelector(".switch");

    if (mode === "login") {
        mode = "signup";
        title.innerText = "Create Account";
        btn.innerText = "Sign Up";
        switcher.innerText = "Already have an account? Login";
    } else {
        mode = "login";
        title.innerText = "Login";
        btn.innerText = "Login";
        switcher.innerText = "Don't have an account? Create One";
    }
}

document.getElementById("login-btn").addEventListener("click", () => {
    const email = document.getElementById("Email").value.trim();
    const password = document.getElementById("password").value;

    // ------------ Email must end with ac.in ------------
    if (!email.endsWith("ac.in")) {
        document.getElementById("msg").innerText = "Only ac.in emails allowed!";
        return;
    }
    // ----------------------------------------------------

    if (mode === "login") {
        login(email, password);
    } else {
        signup(email, password);
    }
});

function signup(email, password) {
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => {
            document.getElementById("msg").style.color = "green";
            document.getElementById("msg").innerText = "Account created successfully!";
           // window.location.href = "http://localhost:3000";
        })
        .catch(err => {
            document.getElementById("msg").innerText = err.message;
            window.location.href = "http://localhost:3000";
        });
}

function login(email, password) {
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            document.getElementById("msg").style.color = "green";
            document.getElementById("msg").innerText = "Login successful!";   
            window.location.href = "http://localhost:3000";
            
        })
        .catch(err => {
            document.getElementById("msg").innerText = err.message;

        });
}