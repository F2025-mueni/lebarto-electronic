// =============================================
// LEBARTO ELECTRONICS SALES SYSTEM
// CASHIER DASHBOARD.JS
// =============================================


import { auth, db } from "./firebase-config.js";


import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {
    collection,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// =============================================
// AUTH CHECK
// =============================================


onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href = "login.html";

        return;

    }

    try {

        // Find Firestore user profile using Firebase Auth UID
        const userQuery = query(
            collection(db, "users"),
            where("uid", "==", user.uid)
        );

        const userSnapshot =
            await getDocs(userQuery);


        if (userSnapshot.empty) {

            console.error(
                "Cashier Firestore profile not found."
            );

            await signOut(auth);

            window.location.href = "login.html";

            return;

        }


        const userData =
            userSnapshot.docs[0].data();


        // Only cashiers can use cashier dashboard
        if (userData.role !== "cashier") {

            window.location.href = "admin.html";

            return;

        }


        document
            .getElementById("cashierName")
            .textContent =
            userData.name || "Cashier";


        await loadDashboard(
            userData.name
        );

    }

    catch (error) {

        console.error(
            "Cashier authentication error:",
            error
        );

        alert(
            "Unable to load cashier account."
        );

    }

});





// =============================================
// DASHBOARD
// =============================================


async function loadDashboard(cashierName){


    updateClock();


    setInterval(updateClock,1000);



    await loadTodaySales(cashierName);


    await loadRecentSales(cashierName);


}







// =============================================
// CLOCK
// =============================================


function updateClock(){


    const clock =
    document.getElementById("currentTime");


    if(clock){


        clock.textContent =
        new Date()
        .toLocaleString();


    }


}







// =============================================
// TODAY SALES
// =============================================


async function loadTodaySales(cashierName){


    try{


        const snapshot =
        await getDocs(
            collection(db,"sales")
        );



        let salesAmount = 0;

        let transactions = 0;

        let productsSold = 0;



        const today =
        new Date()
        .toDateString();




        snapshot.forEach((doc)=>{


            const sale =
            doc.data();



            if(!sale.date){

                return;

            }



            let saleDate;



            // Firestore Timestamp

            if(sale.date.seconds){


                saleDate =
                new Date(
                    sale.date.seconds * 1000
                );


            }

            else{


                saleDate =
                new Date(sale.date);


            }





            if(
                saleDate.toDateString()
                ===
                today
            ){



                // Only this cashier

                if(
                    sale.cashier &&
                    sale.cashier !== cashierName
                ){

                    return;

                }





                salesAmount +=
                Number(
                    sale.total || 0
                );



                transactions++;



                if(
                    Array.isArray(sale.items)
                ){


                    sale.items.forEach(item=>{


                        productsSold +=
                        Number(
                            item.quantity || 0
                        );


                    });


                }


            }



        });





        document
        .getElementById("todaySales")
        .textContent =
        "KSh " +
        salesAmount.toLocaleString();




        document
        .getElementById("todayTransactions")
        .textContent =
        transactions;




        document
        .getElementById("productsSold")
        .textContent =
        productsSold;



    }

    catch(error){

        console.error(
            "Sales error:",
            error
        );

    }


}







// =============================================
// RECENT SALES
// =============================================


async function loadRecentSales(cashierName){


    const table =
    document.getElementById("salesTable");



    if(!table){

        return;

    }



    table.innerHTML="";



    const q =
    query(

        collection(db,"sales"),

        orderBy(
            "date",
            "desc"
        ),

        limit(20)

    );



    const snapshot =
    await getDocs(q);





    snapshot.forEach((doc)=>{


        const sale =
        doc.data();




        if(
            sale.cashier &&
            sale.cashier !== cashierName
        ){

            return;

        }





        table.innerHTML += `


        <tr>


        <td>
        ${sale.receiptNo || "-"}
        </td>



        <td>
        ${sale.customerName || "Walk-in Customer"}
        </td>



        <td>
        KSh ${
            Number(
            sale.total || 0
            )
            .toLocaleString()
        }
        </td>



        <td>

        ${
            sale.paymentMethods
            ?
            sale.paymentMethods.join(", ")
            :
            "-"
        }

        </td>



        <td>

        ${
            sale.date && sale.date.seconds
            ?
            new Date(
            sale.date.seconds*1000
            )
            .toLocaleString()
            :
            "-"
        }

        </td>


        </tr>


        `;



    });


}







// =============================================
// SEARCH
// =============================================


const search =
document.getElementById("searchSale");


if(search){


search.addEventListener(
"keyup",
function(){


    const value =
    this.value.toLowerCase();



    document
    .querySelectorAll("#salesTable tr")
    .forEach(row=>{


        row.style.display =
        row.innerText
        .toLowerCase()
        .includes(value)
        ?
        ""
        :
        "none";


    });



});


}







// =============================================
// LOGOUT
// =============================================


const logoutBtn =
document.getElementById("logoutBtn");



if(logoutBtn){


logoutBtn.onclick =
async()=>{


    try{


        await signOut(auth);


        window.location.replace(
            "login.html"
        );


    }

    catch(error){

        console.error(error);

    }


};


}
