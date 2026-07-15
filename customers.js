// =====================================================
// LEBARTO ELECTRONICS
// CUSTOMERS.JS
// ADD • EDIT • DELETE • SEARCH CUSTOMERS
// =====================================================


import { auth, db } from "./firebase-config.js";


import {

    onAuthStateChanged,
    signOut

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {

    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    doc,
    query,
    orderBy,
    serverTimestamp

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";




// =====================================================
// VARIABLES
// =====================================================


let currentUser = null;

let customers = [];

let editingCustomerId = null;





// =====================================================
// AUTH CHECK
// =====================================================


onAuthStateChanged(auth,(user)=>{


    if(!user){

        window.location.href="login.html";

        return;

    }


    currentUser=user;


    loadCustomers();


});







// =====================================================
// LOAD CUSTOMERS
// =====================================================


async function loadCustomers(){


    try{


        const q=query(

            collection(db,"customers"),

            orderBy("name")

        );


        const snapshot =
        await getDocs(q);



        customers=[];



        snapshot.forEach((item)=>{


            customers.push({

                id:item.id,

                ...item.data()

            });


        });



        displayCustomers(customers);


        updateStatistics();



    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


}







// =====================================================
// DISPLAY CUSTOMERS
// =====================================================


function displayCustomers(data){


    const table =
    document.getElementById("customerTable");


    table.innerHTML="";



    if(data.length===0){


        table.innerHTML=`

        <tr>

        <td colspan="7"
        style="text-align:center">

        No Customers Found

        </td>

        </tr>

        `;


        return;


    }




    data.forEach((customer,index)=>{


        table.innerHTML += `


        <tr>


        <td>${index+1}</td>


        <td>${customer.name}</td>


        <td>${customer.phone || "-"}</td>


        <td>${customer.email || "-"}</td>


        <td>${customer.address || "-"}</td>


        <td>

        ${
            customer.createdAt
            ?
            customer.createdAt
            .toDate()
            .toLocaleDateString()
            :
            "N/A"
        }

        </td>


        <td>


        <button

        class="edit-btn"

        onclick="editCustomer('${customer.id}')">

        <i class="fa-solid fa-pen"></i>

        </button>




        <button

        class="delete-btn"

        onclick="deleteCustomer('${customer.id}')">

        <i class="fa-solid fa-trash"></i>

        </button>



        </td>


        </tr>


        `;


    });



}







// =====================================================
// UPDATE STATISTICS
// =====================================================


function updateStatistics(){


    document
    .getElementById("totalCustomers")
    .textContent =
    customers.length;



    document
    .getElementById("newCustomers")
    .textContent =
    customers.length;



    document
    .getElementById("customerPurchases")
    .textContent =
    "KSh 0";


}







// =====================================================
// OPEN ADD CUSTOMER MODAL
// =====================================================


document
.getElementById("addCustomerBtn")
.addEventListener("click",()=>{


    editingCustomerId=null;



    document
    .getElementById("modalTitle")
    .textContent="Add Customer";



    document
    .getElementById("customerForm")
    .reset();



    document
    .getElementById("customerModal")
    .style.display="flex";


});








// =====================================================
// SAVE CUSTOMER
// =====================================================


document
.getElementById("customerForm")
.addEventListener("submit",saveCustomer);






async function saveCustomer(e){


    e.preventDefault();



    const name =
    document
    .getElementById("customerName")
    .value.trim();



    const phone =
    document
    .getElementById("customerPhone")
    .value.trim();



    const email =
    document
    .getElementById("customerEmail")
    .value.trim();



    const address =
    document
    .getElementById("customerAddress")
    .value.trim();





    if(name===""){


        alert("Customer name required");

        return;


    }





    try{


        const customerData={


            name,

            phone,

            email,

            address,

            updatedAt:
            serverTimestamp()


        };





        if(editingCustomerId){


            await updateDoc(

                doc(
                    db,
                    "customers",
                    editingCustomerId
                ),

                customerData

            );


            alert("Customer updated");


        }


        else{


            customerData.createdAt=
            serverTimestamp();



            await addDoc(

                collection(
                    db,
                    "customers"
                ),

                customerData

            );


            alert("Customer added");


        }




        document
        .getElementById("customerModal")
        .style.display="none";



        loadCustomers();



    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


}








// =====================================================
// EDIT CUSTOMER
// =====================================================


window.editCustomer=function(id){



    const customer =
    customers.find(
        item=>item.id===id
    );



    if(!customer){

        return;

    }



    editingCustomerId=id;



    document
    .getElementById("modalTitle")
    .textContent="Edit Customer";



    document
    .getElementById("customerName")
    .value=
    customer.name;



    document
    .getElementById("customerPhone")
    .value=
    customer.phone || "";



    document
    .getElementById("customerEmail")
    .value=
    customer.email || "";



    document
    .getElementById("customerAddress")
    .value=
    customer.address || "";



    document
    .getElementById("customerModal")
    .style.display="flex";


};








// =====================================================
// DELETE CUSTOMER
// =====================================================


window.deleteCustomer=async function(id){



    if(!confirm("Delete customer?")){

        return;

    }



    try{


        await deleteDoc(

            doc(
                db,
                "customers",
                id
            )

        );



        alert("Customer deleted");


        loadCustomers();



    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


};







// =====================================================
// SEARCH CUSTOMER
// =====================================================


document
.getElementById("searchCustomer")
.addEventListener("keyup",function(){


    const value =
    this.value.toLowerCase();



    const filtered =
    customers.filter(customer=>{


        return(

            customer.name
            .toLowerCase()
            .includes(value)

            ||

            customer.phone
            .toLowerCase()
            .includes(value)

            ||

            customer.email
            .toLowerCase()
            .includes(value)

        );


    });



    displayCustomers(filtered);



});







// =====================================================
// CLOSE MODAL
// =====================================================


document
.getElementById("closeModal")
.onclick=()=>{


    document
    .getElementById("customerModal")
    .style.display="none";


};



document
.getElementById("cancelBtn")
.onclick=()=>{


    document
    .getElementById("customerModal")
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