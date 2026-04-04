const machineCards = document.querySelectorAll(".machine-card");

machineCards.forEach(card => {
  card.addEventListener("click", () => {
    const machineId = card.getAttribute("data-id");
    window.location.href = `machine.html?id=${machineId}`;
  });
});