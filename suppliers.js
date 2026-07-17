// =====================================================
// LEBARTO ELECTRONICS
// SUPPLIERS.JS
// ADD • EDIT • DELETE • SEARCH SUPPLIERS
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


let currentUser=null;

let suppliers=[];

let editingSupplierId=null;





// =====================================================
// AUTH CHECK
// =====================================================


onAuthStateChanged(auth,(user)=>{


    if(!user){

        window.location.href="login.html";

        return;

    }


    currentUser=user;


    loadSuppliers();


});







// =====================================================
// LOAD SUPPLIERS
// =====================================================


async function loadSuppliers(){


    try{


        const q=query(

            collection(db,"suppliers"),

            orderBy("name")

        );


        const snapshot=
        await getDocs(q);



        suppliers=[];



        snapshot.forEach((item)=>{


            suppliers.push({

                id:item.id,

                ...item.data()

            });


        });



        displaySuppliers(suppliers);


        updateStatistics();



    }

    catch(error){


        console.error(error);

        alert(error.message);


    }


}








// =====================================================
// DISPLAY SUPPLIERS
// =====================================================


function displaySuppliers(data){


    const table=
    document.getElementById("supplierTable");


    table.innerHTML="";



    if(data.length===0){


        table.innerHTML=`

        <tr>

        <td colspan="7">

        No Suppliers Found

        </td>

        </tr>

        `;


        return;


    }






    data.forEach((supplier,index)=>{


        table.innerHTML +=`


        <tr>


        <td>${index+1}</td>


        <td>${supplier.name}</td>


        <td>${supplier.phone || "-"}</td>


        <td>${supplier.email || "-"}</td>


        <td>${supplier.address || "-"}</td>


        <td>

        ${
            supplier.createdAt
            ?
            supplier.createdAt
            .toDate()
            .toLocaleDateString()
            :
            "N/A"
        }

        </td>


        <td>


        <button

        class="edit-btn"

        onclick="editSupplier('${supplier.id}')">

        <i class="fa-solid fa-pen"></i>

        </button>



        <button

        class="delete-btn"

        onclick="deleteSupplier('${supplier.id}')">

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


    document
    .getElementById("totalSuppliers")
    .textContent =
    suppliers.length;



    document
    .getElementById("activeSuppliers")
    .textContent =
    suppliers.length;


}








// =====================================================
// OPEN MODAL
// =====================================================


document
.getElementById("addSupplierBtn")
.addEventListener("click",()=>{


    editingSupplierId=null;


    document
    .getElementById("modalTitle")
    .textContent="Add Supplier";


    document
    .getElementById("supplierForm")
    .reset();



    document
    .getElementById("supplierModal")
    .style.display="flex";


});







// =====================================================
// SAVE SUPPLIER
// =====================================================


document
.getElementById("supplierForm")
.addEventListener("submit",saveSupplier);





async function saveSupplier(e){


    e.preventDefault();



    const name =
    document
    .getElementById("supplierName")
    .value.trim();



    const phone =
    document
    .getElementById("supplierPhone")
    .value.trim();



    const email =
    document
    .getElementById("supplierEmail")
    .value.trim();



    const address =
    document
    .getElementById("supplierAddress")
    .value.trim();





    if(name===""){


        alert("Supplier name required");

        return;


    }






    try{


        const supplierData={


            name,

            phone,

            email,

            address,

            updatedAt:
            serverTimestamp()


        };





        if(editingSupplierId){



            await updateDoc(

                doc(
                    db,
                    "suppliers",
                    editingSupplierId
                ),

                supplierData

            );


            alert("Supplier updated");


        }



        else{


            supplierData.createdAt=
            serverTimestamp();



            await addDoc(

                collection(
                    db,
                    "suppliers"
                ),

                supplierData

            );


            alert("Supplier added");


        }





        document
        .getElementById("supplierModal")
        .style.display="none";



        loadSuppliers();



    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


}









// =====================================================
// EDIT SUPPLIER
// =====================================================


window.editSupplier=function(id){



    const supplier =
    suppliers.find(
        item=>item.id===id
    );



    if(!supplier){

        return;

    }



    editingSupplierId=id;



    document
    .getElementById("modalTitle")
    .textContent="Edit Supplier";



    document
    .getElementById("supplierName")
    .value=
    supplier.name;



    document
    .getElementById("supplierPhone")
    .value=
    supplier.phone || "";



    document
    .getElementById("supplierEmail")
    .value=
    supplier.email || "";



    document
    .getElementById("supplierAddress")
    .value=
    supplier.address || "";



    document
    .getElementById("supplierModal")
    .style.display="flex";


};








// =====================================================
// DELETE SUPPLIER
// =====================================================


window.deleteSupplier=async function(id){



    if(!confirm("Delete supplier?")){

        return;

    }



    try{


        await deleteDoc(

            doc(
                db,
                "suppliers",
                id
            )

        );


        alert("Supplier deleted");


        loadSuppliers();


    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


};








// =====================================================
// SEARCH SUPPLIER
// =====================================================


document
.getElementById("searchSupplier")
.addEventListener("keyup",function(){


    const value=
    this.value.toLowerCase();



    const filtered=
    suppliers.filter(supplier=>{


        return(

            supplier.name
            .toLowerCase()
            .includes(value)

            ||

            supplier.phone
            .toLowerCase()
            .includes(value)

            ||

            supplier.email
            .toLowerCase()
            .includes(value)

        );


    });



    displaySuppliers(filtered);


});








// =====================================================
// CLOSE MODAL
// =====================================================


document
.getElementById("closeModal")
.onclick=()=>{


    document
    .getElementById("supplierModal")
    .style.display="none";


};



document
.getElementById("cancelBtn")
.onclick=()=>{


    document
    .getElementById("supplierModal")
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
