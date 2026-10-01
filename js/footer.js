// js/footer.js
//
// Builds the footer and injects it into <div id="footer"></div>.
// The year is calculated automatically, so it never needs manual updates.

function renderFooter() {
  const currentYear = new Date().getFullYear();

  const footerHTML = `
    <footer class="footer">
      <p class="footer__text">&copy; ${currentYear} João Santos</p>
    </footer>
  `;

  const footerContainer = document.getElementById("footer");
  if (!footerContainer) return;

  footerContainer.innerHTML = footerHTML;
}

document.addEventListener("DOMContentLoaded", renderFooter);
