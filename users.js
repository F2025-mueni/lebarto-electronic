// =====================================================
// LEBARTO ELECTRONICS
// USERS.JS
// USER MANAGEMENT
// ADD • VIEW • SEARCH • DELETE USERS
// =====================================================


import { auth, db } from "./firebase-config.js";


import {

    onAuthStateChanged,
    signOut,
    createUserWithEmailAndPassword

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {

    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
    serverTimestamp

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";





// =====================================================
// VARIABLES
// =====================================================


let currentUser=null;

let users=[];







// =====================================================
// AUTH CHECK
// =====================================================


onAuthStateChanged(auth,(user)=>{


    if(!user){

        window.location.href="login.html";

        return;

    }


    currentUser=user;


    loadUsers();


});









// =====================================================
// LOAD USERS
// =====================================================


async function loadUsers(){


    try{


        const q=query(

            collection(db,"users"),

            orderBy("name")

        );



        const snapshot =
        await getDocs(q);



        users=[];



        snapshot.forEach(item=>{


            users.push({

                id:item.id,

                ...item.data()

            });


        });




        displayUsers(users);


        updateStatistics();



    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


}









// =====================================================
// DISPLAY USERS
// =====================================================


function displayUsers(data){



    const table =
    document.getElementById("userTable");



    table.innerHTML="";





    if(data.length===0){


        table.innerHTML=`

        <tr>

        <td colspan="7">

        No Users Found

        </td>

        </tr>

        `;


        return;

    }






    data.forEach((user,index)=>{


        table.innerHTML += `



        <tr>


        <td>${index+1}</td>


        <td>

        ${user.name || "-"}

        </td>



        <td>

        ${user.email || "-"}

        </td>




        <td>

        ${user.role || "-"}

        </td>





        <td>


        <span class="active-status">

        Active

        </span>


        </td>





        <td>


        ${
            user.createdAt
            ?
            user.createdAt
            .toDate()
            .toLocaleDateString()
            :
            "N/A"
        }


        </td>





        <td>



        <button

        class="delete-btn"

        onclick="deleteUser('${user.id}')">


        <i class="fa-solid fa-trash"></i>


        </button>



        </td>



        </tr>



        `;



    });



}









// =====================================================
// STATISTICS
// =====================================================


function updateStatistics(){



    let admins=0;

    let cashiers=0;




    users.forEach(user=>{


        if(user.role==="admin"){

            admins++;

        }


        if(user.role==="cashier"){

            cashiers++;

        }


    });







    document
    .getElementById("totalUsers")
    .textContent =
    users.length;




    document
    .getElementById("totalAdmins")
    .textContent =
    admins;




    document
    .getElementById("totalCashiers")
    .textContent =
    cashiers;



}









// =====================================================
// OPEN ADD USER MODAL
// =====================================================


document
.getElementById("addUserBtn")
.addEventListener("click",()=>{


    document
    .getElementById("userForm")
    .reset();



    document
    .getElementById("modalTitle")
    .textContent="Add User";



    document
    .getElementById("userModal")
    .style.display="flex";


});









// =====================================================
// SAVE USER
// =====================================================


document
.getElementById("userForm")
.addEventListener("submit",saveUser);







async function saveUser(e){


    e.preventDefault();



    const name =
    document
    .getElementById("userName")
    .value.trim();



    const email =
    document
    .getElementById("userEmail")
    .value.trim();



    const role =
    document
    .getElementById("userRole")
    .value;



    const password =
    document
    .getElementById("userPassword")
    .value;





    if(password.length < 6){


        alert(
        "Password must contain at least 6 characters"
        );


        return;


    }





    try{



        // CREATE AUTH ACCOUNT

        const userCredential =

        await createUserWithEmailAndPassword(

            auth,

            email,

            password

        );




        const uid =
        userCredential.user.uid;







        // SAVE USER PROFILE


        await addDoc(

            collection(db,"users"),


            {


                uid,

                name,

                email,

                role,


                createdAt:
                serverTimestamp()


            }


        );




        alert("User created successfully");



        document
        .getElementById("userModal")
        .style.display="none";



        loadUsers();



    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


}









// =====================================================
// DELETE USER
// =====================================================


window.deleteUser=async function(id){



    if(!confirm("Delete this user?")){

        return;

    }




    try{


        await deleteDoc(

            doc(
                db,
                "users",
                id
            )

        );



        alert("User deleted");


        loadUsers();



    }



    catch(error){


        console.error(error);

        alert(error.message);


    }



};









// =====================================================
// SEARCH USERS
// =====================================================


document
.getElementById("searchUser")
.addEventListener("keyup",function(){



    const value =
    this.value.toLowerCase();




    const filtered =

    users.filter(user=>{


        return(

            user.name
            .toLowerCase()
            .includes(value)


            ||

            user.email
            .toLowerCase()
            .includes(value)


            ||

            user.role
            .toLowerCase()
            .includes(value)


        );


    });




    displayUsers(filtered);



});









// =====================================================
// CLOSE MODAL
// =====================================================


document
.getElementById("closeModal")
.onclick=()=>{


    document
    .getElementById("userModal")
    .style.display="none";


};



document
.getElementById("cancelBtn")
.onclick=()=>{


    document
    .getElementById("userModal")
    .style.display="none";


};









// =====================================================
// LOGOUT
// =====================================================


document
.getElementById("logoutBtn")
.onclick=async()=>{


    await signOut(auth);


    window.location.href="login.html";


};
