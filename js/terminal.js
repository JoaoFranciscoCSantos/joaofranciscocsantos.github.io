// js/terminal.js
//
// A small interactive "terminal" for the home page. Type `help` to see the
// commands, or tap the buttons under the terminal. `play` opens a bicycle
// game (see js/bike-game.js).
//
// Output is built with textContent only, so whatever the visitor types
// can never be interpreted as HTML.

(function () {
  "use strict";

  const section = document.getElementById("terminal");
  if (!section) return;

  const output = document.getElementById("terminal-output");
  const form = document.getElementById("terminal-form");
  const input = document.getElementById("terminal-input");
  const gameBox = document.getElementById("terminal-game");
  const canvas = document.getElementById("bike-canvas");
  const exitButton = document.getElementById("terminal-game-exit");
  const chips = section.querySelectorAll("[data-command]");
  const body = section.querySelector(".terminal__body");

  const PROMPT = "visitor@joao:~$";
  const PAGES = {
    home: "index.html",
    about: "about.html",
    projects: "projects.html",
    contact: "contact.html",
  };
  const GITHUB = "https://github.com/JoaoFranciscoCSantos";

  const isTouch = window.matchMedia("(pointer: coarse)").matches;

  // ---------- Output helpers ----------

  function scrollDown() {
    output.scrollTop = output.scrollHeight;
  }

  // Each argument is either a string or { t: text, cls: className, href: url }
  function line() {
    const div = document.createElement("div");
    div.className = "terminal__line";
    for (let i = 0; i < arguments.length; i++) {
      const part = arguments[i];
      if (typeof part === "string") {
        div.appendChild(document.createTextNode(part));
        continue;
      }
      let el;
      if (part.href) {
        el = document.createElement("a");
        el.href = part.href;
        if (/^https?:/.test(part.href)) {
          el.target = "_blank";
          el.rel = "noopener";
        }
      } else {
        el = document.createElement("span");
      }
      if (part.cls) el.className = part.cls;
      el.textContent = part.t;
      div.appendChild(el);
    }
    output.appendChild(div);
    scrollDown();
  }

  const dim = (t) => ({ t: t, cls: "terminal__dim" });
  const ok = (t) => ({ t: t, cls: "terminal__ok" });
  const err = (t) => ({ t: t, cls: "terminal__err" });
  const link = (t, href) => ({ t: t, href: href, cls: "terminal__link" });
  const cmd = (t) => ({ t: t, cls: "terminal__cmd" });

  function blank() {
    line("");
  }

  // ---------- Game ----------

  const game =
    typeof window.createBikeGame === "function"
      ? window.createBikeGame(canvas, {
          onExit: function (best) {
            gameBox.hidden = true;
            input.disabled = false;
            line(dim("Back to the shell. "), best > 0 ? dim("Best ride: " + best.toFixed(2) + " km.") : "");
            if (!isTouch) input.focus({ preventScroll: true });
          },
        })
      : null;

  function startGame() {
    if (!game) {
      line(err("The game could not be loaded."));
      return;
    }
    if (game.isOpen()) return;
    line(dim("Starting ride... Space or tap to jump, \u2193 to duck, Esc to exit."));
    gameBox.hidden = false;
    input.blur();
    input.disabled = true;
    game.open();
    gameBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  exitButton.addEventListener("click", function () {
    if (game) game.close();
  });

  // ---------- Commands ----------

  const commands = {
    help: function () {
      line("Available commands:");
      [
        ["about", "who I am"],
        ["skills", "what I work with"],
        ["projects", "things I've built"],
        ["contact", "how to reach me"],
        ["neofetch", "quick summary"],
        ["play", "ride a bike (a small game)"],
        ["open <page>", "go to a page: about, projects, contact"],
        ["clear", "clear the screen"],
      ].forEach(function (row) {
        line("  ", cmd(row[0].padEnd(13)), dim(row[1]));
      });
    },

    about: function () {
      line("Informatics and Computing Engineering student at FEUP, University of Porto.");
      line("Interested in C++, systems programming and computer architecture.");
      line("Outside university: cycling, powerlifting, motorcycling and acoustic guitar.");
      line(link("Read more \u2192", PAGES.about));
    },

    skills: function () {
      line(dim("Languages   "), "C++, Python");
      line(dim("Interests   "), "systems, computer architecture, embedded");
      line(dim("Tools       "), "Git, Flask, SQLite, PostgreSQL, pytest");
    },

    projects: function () {
      [
        ["Orion 2WD", "WiFi-controlled robot on an ESP8266", "https://github.com/JoaoFranciscoCSantos/Orion-2WD-Robot"],
        ["SVG to PNG Converter", "C++ group project", "https://github.com/JoaoFranciscoCSantos/svg_to_png"],
        ["Wishlist App", "Flask app with price parsing", ""],
        ["Price Scout", "price tracker across shops", ""],
        ["AI Agenda", "scheduling with conflict detection", ""],
      ].forEach(function (p) {
        if (p[2]) line("  ", link(p[0], p[2]), dim("  " + p[1]));
        else line("  ", p[0], dim("  " + p[1]));
      });
      line(link("See all projects \u2192", PAGES.projects));
    },

    contact: function () {
      line(dim("GitHub  "), link("github.com/JoaoFranciscoCSantos", GITHUB));
      line(link("More ways to reach me \u2192", PAGES.contact));
    },

    neofetch: function () {
      line(ok("visitor"), "@", ok("joao"));
      line(dim("-------------"));
      line(ok("Name      "), "Jo\u00e3o Santos");
      line(ok("Studying  "), "Informatics and Computing Engineering @ FEUP");
      line(ok("Code      "), "C++, Python");
      line(ok("Hobbies   "), "cycling, powerlifting, motorcycling, guitar");
      line(ok("Shell     "), "portfolio.sh");
    },

    play: function () {
      startGame();
    },

    whoami: function () {
      line("visitor (welcome!)");
    },

    ls: function () {
      line("about  projects  contact  ", ok("ride.sh"));
    },

    clear: function () {
      output.textContent = "";
    },

    open: function (args) {
      const target = (args[0] || "").toLowerCase().replace(/\.html$/, "");
      if (!PAGES[target]) {
        line("usage: open <", "about | projects | contact", ">");
        return;
      }
      line(dim("Opening " + PAGES[target] + "..."));
      window.location.href = PAGES[target];
    },

    sudo: function (args) {
      if (args.join(" ").toLowerCase() === "hire joao") {
        line(ok("Permission granted."), " Great decision!");
        line("Type ", cmd("contact"), " to take the next step.");
      } else {
        line(err("visitor is not in the sudoers file. This incident will be reported."));
      }
    },

    exit: function () {
      line("There is no escape. Try ", cmd("play"), " instead.");
    },

    hi: function () {
      line("Hello! Type ", cmd("help"), " to see what I can do.");
    },

    rm: function () {
      line(err("rm: permission denied. Nice try."));
    },
  };

  // aliases
  commands.cd = commands.open;
  commands.goto = commands.open;
  commands.bike = commands.play;
  commands.ride = commands.play;
  commands["./ride.sh"] = commands.play;
  commands.hello = commands.hi;
  commands.cls = commands.clear;

  const completable = [
    "about", "skills", "projects", "contact", "neofetch", "play", "open", "clear", "help",
  ];

  // ---------- Running commands ----------

  const history = [];
  let historyIndex = 0;

  function run(raw, fromChip) {
    const text = raw.trim();
    if (game && game.isOpen()) game.close();

    const echo = document.createElement("div");
    echo.className = "terminal__line";
    const p = document.createElement("span");
    p.className = "terminal__prompt-echo";
    p.textContent = PROMPT + " ";
    echo.appendChild(p);
    echo.appendChild(document.createTextNode(text));
    output.appendChild(echo);

    if (text) {
      history.push(text);
      historyIndex = history.length;

      const parts = text.split(/\s+/);
      const name = parts[0].toLowerCase();
      const handler = Object.prototype.hasOwnProperty.call(commands, name) ? commands[name] : null;
      if (handler) {
        handler(parts.slice(1));
      } else {
        line(err("command not found: " + parts[0]), dim("  (type 'help')"));
      }
    }
    scrollDown();
    if (!(fromChip && isTouch) && !input.disabled) input.focus({ preventScroll: true });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const value = input.value;
    input.value = "";
    run(value, false);
  });

  chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      run(chip.getAttribute("data-command"), true);
    });
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex];
      } else {
        historyIndex = history.length;
        input.value = "";
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const v = input.value.trim().toLowerCase();
      if (!v) return;
      const matches = completable.filter((c) => c.indexOf(v) === 0);
      if (matches.length === 1) input.value = matches[0] + " ";
    }
  });

  // Clicking anywhere in the terminal focuses the input (desktop only,
  // so phones don't pop the keyboard up unexpectedly).
  body.addEventListener("click", function (e) {
    if (isTouch || input.disabled) return;
    if (e.target.closest("a, button, canvas")) return;
    if (window.getSelection && String(window.getSelection())) return;
    input.focus({ preventScroll: true });
  });

  // ---------- Start ----------

  section.hidden = false;
  line("Welcome! Type ", cmd("help"), " or tap a command below.");
  line(dim("There is also a small game in here: try "), cmd("play"), dim("."));
})();
