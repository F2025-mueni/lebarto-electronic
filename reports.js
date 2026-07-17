// =====================================================
// LEBARTO ELECTRONICS
// REPORTS.JS
// SALES REPORTS • PROFIT • FILTER • PRINT
// =====================================================


import { auth, db } from "./firebase-config.js";


import {

    onAuthStateChanged,
    signOut

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";


import {

    collection,
    getDocs

} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";






// =====================================================
// VARIABLES
// =====================================================


let currentUser=null;

let sales=[];

let customers=[];

let products=[];

let filteredSales=[];







// =====================================================
// AUTH CHECK
// =====================================================


onAuthStateChanged(auth,(user)=>{


    if(!user){

        window.location.href="login.html";

        return;

    }


    currentUser=user;


    loadReports();


});








// =====================================================
// LOAD REPORT DATA
// =====================================================


async function loadReports(){


    try{


        const salesSnap =
        await getDocs(
            collection(db,"sales")
        );


        sales=[];


        salesSnap.forEach(doc=>{


            sales.push({

                id:doc.id,

                ...doc.data()

            });


        });





        const customerSnap =
        await getDocs(
            collection(db,"customers")
        );


        customers=[];


        customerSnap.forEach(doc=>{


            customers.push(doc.data());


        });







        const productSnap =
        await getDocs(
            collection(db,"products")
        );


        products=[];


        productSnap.forEach(doc=>{


            products.push(doc.data());


        });





        filteredSales=[...sales];


        generateReport();



    }


    catch(error){


        console.error(error);

        alert(error.message);


    }


}








// =====================================================
// GENERATE REPORT
// =====================================================


function generateReport(){



    let revenue=0;

    let profit=0;

    let soldProducts=0;




    filteredSales.forEach(sale=>{


       revenue += Number(sale.total) || 0;



     sale.items.forEach(item=>{

    soldProducts += Number(item.quantity || 0);

});


profit += Number(sale.profit) || 0;



    });







    document
    .getElementById("totalRevenue")
    .textContent =
    "KSh " + revenue.toLocaleString();





    document
    .getElementById("totalProfit")
    .textContent =
    "KSh " + profit.toLocaleString();





    document
    .getElementById("productsSold")
    .textContent =
    soldProducts;





    document
    .getElementById("customersCount")
    .textContent =
    customers.length;




    displayReportTable();


}








// =====================================================
// DISPLAY REPORT TABLE
// =====================================================


function displayReportTable(){


    const table =
    document.getElementById("reportTable");


    table.innerHTML="";



    if(filteredSales.length===0){


        table.innerHTML=`

        <tr>

        <td colspan="6">

        No records found

        </td>

        </tr>

        `;


        return;

    }






    filteredSales.forEach((sale,index)=>{



        table.innerHTML +=`


        <tr>


        <td>${index+1}</td>



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

        ${sale.customerName || "Walk-in"}

        </td>




        <td>

        ${
            sale.items
            ?
            sale.items.length
            :
            0
        }

        </td>




        <td>

        KSh ${Number(sale.total)
        .toLocaleString()}

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


        </tr>


        `;


    });


}







// =====================================================
// DATE FILTER
// =====================================================


document
.getElementById("generateReportBtn")
.addEventListener("click",()=>{


    const start =
    document
    .getElementById("startDate")
    .value;



    const end =
    document
    .getElementById("endDate")
    .value;





    filteredSales =
    sales.filter(sale=>{



        if(!sale.date){

            return false;

        }



        let saleDate =
        new Date(
        sale.date.seconds*1000
        );



        if(start){


            if(
            saleDate <
            new Date(start)
            ){

                return false;

            }


        }




        if(end){


            if(
            saleDate >
            new Date(end)
            ){

                return false;

            }


        }



        return true;


    });




    generateReport();


});








// =====================================================
// PRINT REPORT
// =====================================================


document
.getElementById("printReportBtn")
.addEventListener("click",()=>{


    window.print();


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
