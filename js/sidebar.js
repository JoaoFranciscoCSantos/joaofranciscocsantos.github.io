// js/sidebar.js
//
// Builds the sidebar and injects it into <div id="sidebar"></div>.
// This file is shared by all pages, so links and labels only need to be
// edited here once to update the whole site.

function renderSidebar() {
  const sidebarHTML = `
    <nav class="sidebar">
      <a href="index.html" class="sidebar__name">João Santos</a>

      <ul class="sidebar__links">
        <li><a href="index.html" data-page="index">Home</a></li>
        <li><a href="about.html" data-page="about">About</a></li>
        <li><a href="projects.html" data-page="projects">Projects</a></li>
        <li><a href="contact.html" data-page="contact">Contact</a></li>
      </ul>

      <div class="sidebar__socials">
        <a href="https://github.com/JoaoFranciscoCSantos" target="_blank" rel="noopener">GitHub</a>
      </div>
    </nav>
  `;

  const sidebarContainer = document.getElementById("sidebar");
  if (!sidebarContainer) return; // safety check, in case the page has no container

  sidebarContainer.innerHTML = sidebarHTML;

  // Work out the current file name (e.g. "about" from "about.html").
  // If it's empty (we're at "/"), assume "index".
  const currentPage =
    window.location.pathname.split("/").pop().replace(".html", "") || "index";

  const activeLink = sidebarContainer.querySelector(`[data-page="${currentPage}"]`);
  if (activeLink) {
    activeLink.classList.add("sidebar__links--active");
  }
}

// Only runs once the page HTML has fully loaded
document.addEventListener("DOMContentLoaded", renderSidebar);
