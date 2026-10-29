const mainTitle = document.getElementById("mainTitle");

mainTitle.addEventListener("click", function () {
    alert("Willkommen auf meinem Portfolio!");
});

// Aktuelles Jahr im Footer
document.getElementById("year").textContent = new Date().getFullYear();
