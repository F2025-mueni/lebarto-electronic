// =====================================================
// LEBARTO ELECTRONICS
// SETTINGS.JS
// SHOP SETTINGS • RECEIPT SETTINGS • PROFILE SETTINGS
// =====================================================


import { auth, db } from "./firebase-config.js";


import {

    onAuthStateChanged,
    signOut,
    updateProfile

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {

    doc,
    getDoc,
    setDoc,
    serverTimestamp

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";





// =====================================================
// VARIABLES
// =====================================================


let currentUser=null;






// =====================================================
// AUTH CHECK
// =====================================================


onAuthStateChanged(auth,async(user)=>{


    if(!user){


        window.location.href="login.html";

        return;


    }


    currentUser=user;


    loadSettings();


    loadProfile();


});








// =====================================================
// LOAD SETTINGS
// =====================================================


async function loadSettings(){


    try{


        const settingsRef =
        doc(db,"settings","shop");



        const snapshot =
        await getDoc(settingsRef);



        if(snapshot.exists()){


            const data=snapshot.data();



            document
            .getElementById("shopName")
            .value =
            data.shopName || "";



            document
            .getElementById("shopPhone")
            .value =
            data.phone || "";



            document
            .getElementById("shopEmail")
            .value =
            data.email || "";



            document
            .getElementById("shopAddress")
            .value =
            data.address || "";



            document
            .getElementById("receiptMessage")
            .value =
            data.receiptMessage || "";



            document
            .getElementById("showLogo")
            .value =
            data.showLogo || "yes";


        }


    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


}








// =====================================================
// SAVE SHOP DETAILS
// =====================================================


document
.getElementById("shopForm")
.addEventListener("submit",async(e)=>{


    e.preventDefault();



    try{


        await setDoc(

            doc(db,"settings","shop"),


            {


                shopName:

                document
                .getElementById("shopName")
                .value,



                phone:

                document
                .getElementById("shopPhone")
                .value,



                email:

                document
                .getElementById("shopEmail")
                .value,



                address:

                document
                .getElementById("shopAddress")
                .value,



                updatedAt:
                serverTimestamp()


            },


            {
                merge:true
            }


        );



        alert(
        "Shop details saved successfully"
        );


    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


});









// =====================================================
// SAVE RECEIPT SETTINGS
// =====================================================


document
.getElementById("receiptForm")
.addEventListener("submit",async(e)=>{


    e.preventDefault();



    try{


        await setDoc(

            doc(db,"settings","shop"),


            {


                receiptMessage:

                document
                .getElementById("receiptMessage")
                .value,



                showLogo:

                document
                .getElementById("showLogo")
                .value,



                updatedAt:
                serverTimestamp()


            },


            {
                merge:true
            }


        );



        alert(
        "Receipt settings saved"
        );


    }



    catch(error){


        console.error(error);

        alert(error.message);


    }


});









// =====================================================
// LOAD PROFILE
// =====================================================


function loadProfile(){


    document
    .getElementById("profileName")
    .value =
    currentUser.displayName || "";



    document
    .getElementById("profileEmail")
    .value =
    currentUser.email;


}








// =====================================================
// UPDATE PROFILE
// =====================================================


document
.getElementById("profileForm")
.addEventListener("submit",async(e)=>{


    e.preventDefault();



    try{


        const name =

        document
        .getElementById("profileName")
        .value;



        await updateProfile(

            currentUser,

            {

                displayName:name

            }

        );



        await setDoc(

            doc(
                db,
                "users",
                currentUser.uid
            ),


            {


                name:name,

                updatedAt:
                serverTimestamp()


            },


            {

                merge:true

            }


        );



        alert(
        "Profile updated successfully"
        );


    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


});








// =====================================================
// LOGOUT
// =====================================================


document
.getElementById("logoutBtn")
.onclick=async()=>{


    await signOut(auth);


    window.location.href="login.html";


};