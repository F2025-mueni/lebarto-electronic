// =====================================================
// LEBARTO ELECTRONICS
// CATEGORIES.JS
// ADD • EDIT • DELETE • SEARCH CATEGORIES
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
// GLOBAL VARIABLES
// =====================================================


let currentUser = null;

let categories = [];

let editingCategoryId = null;




// =====================================================
// AUTH CHECK
// =====================================================


onAuthStateChanged(auth, async(user)=>{


    if(!user){

        window.location.href="login.html";

        return;

    }


    currentUser=user;


    loadCategories();


});





// =====================================================
// LOAD CATEGORIES
// =====================================================


async function loadCategories(){


    try{


        const q=query(

            collection(db,"categories"),

            orderBy("name")

        );


        const snapshot =
        await getDocs(q);



        categories=[];



        snapshot.forEach((item)=>{


            categories.push({

                id:item.id,

                ...item.data()

            });


        });



        displayCategories(categories);


        updateStatistics();


    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


}






// =====================================================
// DISPLAY CATEGORIES
// =====================================================


function displayCategories(data){


    const table =
    document.getElementById("categoryTable");


    table.innerHTML="";



    if(data.length===0){


        table.innerHTML=`

        <tr>

        <td colspan="5">

        No Categories Found

        </td>

        </tr>

        `;


        return;


    }



    data.forEach((category,index)=>{


        table.innerHTML += `


        <tr>


        <td>${index+1}</td>


        <td>${category.name}</td>


        <td>${category.description || "-"}</td>


        <td>

        ${
            category.createdAt ?
            category.createdAt.toDate()
            .toLocaleDateString()
            :
            "N/A"
        }

        </td>


        <td>


        <button
        class="edit-btn"
        onclick="editCategory('${category.id}')">

        <i class="fa-solid fa-pen"></i>

        </button>



        <button
        class="delete-btn"
        onclick="deleteCategory('${category.id}')">

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
    .getElementById("totalCategories")
    .textContent =
    categories.length;



    document
    .getElementById("assignedProducts")
    .textContent =
    0;


}







// =====================================================
// OPEN ADD CATEGORY MODAL
// =====================================================


document
.getElementById("addCategoryBtn")
.addEventListener("click",()=>{


    editingCategoryId=null;


    document
    .getElementById("modalTitle")
    .textContent="Add Category";


    document
    .getElementById("categoryForm")
    .reset();



    document
    .getElementById("categoryModal")
    .style.display="flex";


});







// =====================================================
// SAVE CATEGORY
// =====================================================


document
.getElementById("categoryForm")
.addEventListener("submit",saveCategory);




async function saveCategory(e){


    e.preventDefault();



    const name =
    document
    .getElementById("categoryName")
    .value.trim();



    const description =
    document
    .getElementById("categoryDescription")
    .value.trim();




    if(name===""){


        alert("Category name required");

        return;


    }




    try{


        const categoryData={


            name:name,


            description:description,


            updatedAt:
            serverTimestamp()


        };





        if(editingCategoryId){



            await updateDoc(

                doc(
                    db,
                    "categories",
                    editingCategoryId
                ),

                categoryData

            );


            alert("Category updated");



        }

        else{



            categoryData.createdAt=
            serverTimestamp();



            await addDoc(

                collection(
                    db,
                    "categories"
                ),

                categoryData

            );



            alert("Category added");


        }



        document
        .getElementById("categoryModal")
        .style.display="none";



        loadCategories();



    }



    catch(error){


        console.error(error);

        alert(error.message);


    }



}








// =====================================================
// EDIT CATEGORY
// =====================================================


window.editCategory=function(id){



    const category =
    categories.find(
        item=>item.id===id
    );



    if(!category){

        return;

    }



    editingCategoryId=id;



    document
    .getElementById("modalTitle")
    .textContent="Edit Category";



    document
    .getElementById("categoryName")
    .value=
    category.name;



    document
    .getElementById("categoryDescription")
    .value=
    category.description || "";



    document
    .getElementById("categoryModal")
    .style.display="flex";


};







// =====================================================
// DELETE CATEGORY
// =====================================================


window.deleteCategory=async function(id){



    const confirmDelete =
    confirm(
    "Delete this category?"
    );



    if(!confirmDelete){

        return;

    }




    try{


        await deleteDoc(

            doc(
                db,
                "categories",
                id
            )

        );



        alert("Category deleted");



        loadCategories();


    }



    catch(error){


        console.error(error);

        alert(error.message);


    }


};








// =====================================================
// SEARCH CATEGORY
// =====================================================


document
.getElementById("searchCategory")
.addEventListener("keyup",function(){


    const value =
    this.value.toLowerCase();



    const filtered =
    categories.filter(category=>


        category.name
        .toLowerCase()
        .includes(value)


    );



    displayCategories(filtered);



});








// =====================================================
// CLOSE MODAL
// =====================================================


document
.getElementById("closeModal")
.onclick=function(){


    document
    .getElementById("categoryModal")
    .style.display="none";


};



document
.getElementById("cancelBtn")
.onclick=function(){


    document
    .getElementById("categoryModal")
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
