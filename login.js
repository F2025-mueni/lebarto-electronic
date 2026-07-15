// ===================================
// LOGIN.JS
// Firebase Authentication
// ===================================

import { auth, db } from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Show / Hide Password

const togglePassword = document.getElementById("togglePassword");
const password = document.getElementById("password");

togglePassword.addEventListener("click", ()=>{

    if(password.type==="password"){

        password.type="text";
        togglePassword.classList.remove("fa-eye");
        togglePassword.classList.add("fa-eye-slash");

    }else{

        password.type="password";
        togglePassword.classList.remove("fa-eye-slash");
        togglePassword.classList.add("fa-eye");

    }

});

// Login

const loginForm=document.getElementById("loginForm");

loginForm.addEventListener("submit",async(e)=>{

    e.preventDefault();

    const email=document.getElementById("email").value.trim();
    const pass=document.getElementById("password").value;

    const message=document.getElementById("errorMessage");

    message.innerHTML="";

    try{

        const userCredential=await signInWithEmailAndPassword(auth,email,pass);

        const uid=userCredential.user.uid;

        const userDoc=await getDoc(doc(db,"users",uid));

        if(!userDoc.exists()){

            message.innerHTML="User record not found.";
            return;

        }

        const data=userDoc.data();

        localStorage.setItem("userRole",data.role);
        localStorage.setItem("userName",data.name);

        if(data.role==="admin"){

            window.location.href="admin.html";

        }else{

            window.location.href="cashier.html";

        }

    }catch(error){

        message.innerHTML=error.message;

    }

});

// Forgot Password

const forgot=document.getElementById("forgotPassword");

forgot.addEventListener("click",async(e)=>{

    e.preventDefault();

    const email=document.getElementById("email").value.trim();

    if(email===""){

        alert("Enter your email first.");

        return;

    }

    try{

        await sendPasswordResetEmail(auth,email);

        alert("Password reset email sent.");

    }catch(error){

        alert(error.message);

    }

});