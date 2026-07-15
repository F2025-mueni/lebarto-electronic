```javascript
// =====================================
// LEBARTO ELECTRONICS SALES SYSTEM
// index.js
// =====================================

document.addEventListener("DOMContentLoaded", () => {

    // Welcome message
    console.log("Welcome to Lebarto Electronics Sales System");

    // Animate feature cards when they appear
    const cards = document.querySelectorAll(".card");

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {

            if (entry.isIntersecting) {
                entry.target.style.opacity = "1";
                entry.target.style.transform = "translateY(0)";
            }

        });
    }, {
        threshold: 0.2
    });

    cards.forEach(card => {
        card.style.opacity = "0";
        card.style.transform = "translateY(40px)";
        card.style.transition = "all 0.6s ease";

        observer.observe(card);
    });

    // Display current year in footer automatically
    const footer = document.querySelector("footer p");

    if (footer) {
        footer.innerHTML = `© ${new Date().getFullYear()} Lebarto Electronics Sales System. All Rights Reserved.`;
    }

});
```
