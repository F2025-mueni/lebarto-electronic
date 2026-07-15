// =====================================================
// LEBARTO ELECTRONICS
// SALES.JS
// SALES HISTORY • FILTER • RECEIPTS
// =====================================================


import { auth, db } from "./firebase-config.js";


import {

    onAuthStateChanged,
    signOut

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {

    collection,
    getDocs,
    query,
    orderBy

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";





// =====================================================
// VARIABLES
// =====================================================


let currentUser = null;

let sales = [];

let selectedSale = null;






// =====================================================
// AUTH CHECK
// =====================================================


onAuthStateChanged(auth,(user)=>{


    if(!user){

        window.location.href="login.html";

        return;

    }


    currentUser=user;


    loadSales();


});







// =====================================================
// LOAD SALES
// =====================================================


async function loadSales(){


    try{


        const q=query(

            collection(db,"sales"),

            orderBy("date","desc")

        );



        const snapshot =
        await getDocs(q);



        sales=[];



        snapshot.forEach((item)=>{


            sales.push({

                id:item.id,

                ...item.data()

            });


        });



        displaySales(sales);


        updateStatistics();



    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


}







// =====================================================
// DISPLAY SALES TABLE
// =====================================================


function displaySales(data){


    const table =
    document.getElementById("salesTable");


    table.innerHTML="";



    if(data.length===0){


        table.innerHTML=`

        <tr>

        <td colspan="8">

        No Sales Found

        </td>

        </tr>

        `;


        return;

    }






    data.forEach((sale,index)=>{


        table.innerHTML += `


        <tr>


        <td>${index+1}</td>


        <td>

        ${sale.receiptNo || sale.id.substring(0,8)}

        </td>


        <td>

        ${sale.customerName || "Walk-in Customer"}

        </td>



        <td>

        ${sale.cashier || "-"}

        </td>



        <td>

        ${sale.paymentMethod || "-"}

        </td>



        <td>

        KSh ${Number(sale.total)
        .toLocaleString()}

        </td>




        <td>

        ${
            sale.date
            ?
            new Date(
            sale.date.seconds*1000
            )
            .toLocaleDateString()
            :
            "N/A"
        }

        </td>




        <td>


        <button

        class="view-btn"

        onclick="viewSale('${sale.id}')">


        <i class="fa-solid fa-eye"></i>


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


    let total=0;



    sales.forEach(sale=>{


        total += Number(sale.total || 0);


    });



    document
    .getElementById("totalSales")
    .textContent =
    "KSh " + total.toLocaleString();



    document
    .getElementById("totalTransactions")
    .textContent =
    sales.length;



    let todayTotal=0;



    let today =
    new Date()
    .toDateString();




    sales.forEach(sale=>{


        if(sale.date){


            let saleDate =
            new Date(
            sale.date.seconds*1000
            )
            .toDateString();



            if(saleDate===today){

                todayTotal += Number(sale.total);

            }


        }


    });




    document
    .getElementById("todaySales")
    .textContent =
    "KSh " + todayTotal.toLocaleString();


}







// =====================================================
// VIEW RECEIPT
// =====================================================


window.viewSale=function(id){



    selectedSale =
    sales.find(
        sale=>sale.id===id
    );



    if(!selectedSale){

        return;

    }



    let html=`



    <h3>
    Lebarto Electronics
    </h3>



    <p>
    Customer:
    ${selectedSale.customerName}
    </p>



    <p>
    Payment:
    ${selectedSale.paymentMethod}
    </p>



    <hr>




    `;



    selectedSale.items.forEach(item=>{


        html += `


        <div class="receipt-item">


        <span>

        ${item.name}
        x
        ${item.quantity}

        </span>



        <span>

        KSh ${item.price * item.quantity}

        </span>



        </div>


        `;


    });





    html +=`


    <div class="receipt-total">


    Total:

    KSh ${selectedSale.total}


    </div>


    `;




    document
    .getElementById("receiptDetails")
    .innerHTML=html;




    document
    .getElementById("receiptModal")
    .style.display="flex";



};







// =====================================================
// SEARCH SALES
// =====================================================


document
.getElementById("searchSale")
.addEventListener("keyup",function(){


    filterSales();


});







// =====================================================
// PAYMENT FILTER
// =====================================================


document
.getElementById("paymentFilter")
.addEventListener("change",filterSales);





document
.getElementById("dateFilter")
.addEventListener("change",filterSales);








function filterSales(){


    let text =
    document
    .getElementById("searchSale")
    .value
    .toLowerCase();



    let payment =
    document
    .getElementById("paymentFilter")
    .value;



    let date =
    document
    .getElementById("dateFilter")
    .value;




    let filtered =
    sales.filter(sale=>{


        let matchText =

        (

        sale.customerName || ""

        )

        .toLowerCase()

        .includes(text)

        ||

        (

        sale.cashier || ""

        )

        .toLowerCase()

        .includes(text);



        let matchPayment =

        payment===""

        ||

        sale.paymentMethod===payment;




        let matchDate=true;



        if(date && sale.date){


            let saleDate =
            new Date(
            sale.date.seconds*1000
            )
            .toISOString()
            .substring(0,10);



            matchDate =
            saleDate===date;


        }



        return(

            matchText

            &&

            matchPayment

            &&

            matchDate

        );


    });



    displaySales(filtered);


}







// =====================================================
// PRINT RECEIPT
// =====================================================


document
.getElementById("printReceiptBtn")
.onclick=function(){


    window.print();


};








// =====================================================
// CLOSE MODAL
// =====================================================


document
.getElementById("closeModal")
.onclick=()=>{


    document
    .getElementById("receiptModal")
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