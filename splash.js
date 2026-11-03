(() => {
  const splash = document.getElementById("cms-splash");
  if (!splash) return;

  // Short excerpts from the linked primary texts; stored locally for offline display.
  const quotes = [
    { text: "Reading maketh a full man.", author: "Francis Bacon", source: "https://www.gutenberg.org/files/56463/56463-h/56463-h.htm" },
    { text: "Some books are to be tasted, others to be swallowed.", author: "Francis Bacon", source: "https://www.gutenberg.org/files/56463/56463-h/56463-h.htm" },
    { text: "Diligence is the mother of good luck.", author: "Benjamin Franklin", source: "https://www.gutenberg.org/files/36151/36151-h/36151-h.htm" },
    { text: "There are no gains without pains.", author: "Benjamin Franklin", source: "https://www.gutenberg.org/files/36151/36151-h/36151-h.htm" },
    { text: "Learning without thought is labour lost.", author: "Confucius", source: "https://www.gutenberg.org/cache/epub/3330/pg3330-images.html" },
    { text: "He acts before he speaks.", author: "Confucius", source: "https://www.gutenberg.org/cache/epub/3330/pg3330-images.html" },
    { text: "Begin therefore with little things.", author: "Epictetus", source: "https://www.gutenberg.org/files/45109/old/45109-h/45109-h.htm" },
    { text: "Men are disturbed not by things, but by the views which they take of things.", author: "Epictetus", source: "https://www.gutenberg.org/files/45109/old/45109-h/45109-h.htm" },
    { text: "The best kind of revenge is, not to become like unto them.", author: "Marcus Aurelius", source: "https://www.gutenberg.org/files/2680/2680-h/2680-h.htm" },
    { text: "A man's true happiness doth consist in very few things.", author: "Marcus Aurelius", source: "https://www.gutenberg.org/files/2680/2680-h/2680-h.htm" },
    { text: "The spectacle of effort is what awakens and sustains our own effort.", author: "William James", source: "https://www.gutenberg.org/files/16287/16287-h/16287-h.htm" },
    { text: "To think, in short, is the secret of will.", author: "William James", source: "https://www.gutenberg.org/files/16287/16287-h/16287-h.htm" },
    { text: "Simplify, simplify.", author: "Henry David Thoreau", source: "https://www.gutenberg.org/cache/epub/205/pg205-images.html" },
    { text: "I went to the woods because I wished to live deliberately.", author: "Henry David Thoreau", source: "https://www.gutenberg.org/cache/epub/205/pg205-images.html" },
    { text: "Never speak to a sick person suddenly.", author: "Florence Nightingale", source: "https://www.gutenberg.org/files/17366/17366-h/17366-h.htm" },
    { text: "Always sit within the patient's view.", author: "Florence Nightingale", source: "https://www.gutenberg.org/files/17366/17366-h/17366-h.htm" },
    { text: "Cast down your bucket where you are.", author: "Booker T. Washington", source: "https://www.gutenberg.org/files/2376/2376-h/2376-h.htm" },
    { text: "It is at the bottom of life we must begin, and not at the top.", author: "Booker T. Washington", source: "https://www.gutenberg.org/files/2376/2376-h/2376-h.htm" },
    { text: "Life is short, and Art long.", author: "Hippocrates", source: "https://classics.mit.edu/Hippocrates/aphorisms.1.i.html" },
    { text: "The unexamined life is not worth living.", author: "Socrates, in Plato's Apology", source: "https://www.gutenberg.org/files/1656/1656-h/1656-h.htm" }
  ];

  let previous = -1;
  try {
    const stored = sessionStorage.getItem("cmsbuddy-last-splash-quote");
    if (stored !== null) previous = Number(stored);
  } catch { /* Storage can be unavailable in private browsing. */ }
  let index = Math.floor(Math.random() * quotes.length);
  if (index === previous) index = (index + 1) % quotes.length;
  try { sessionStorage.setItem("cmsbuddy-last-splash-quote", String(index)); } catch { /* Quote selection still works. */ }
  const quoteText = document.getElementById("cms-splash-quote-text");
  const selectedQuote = quotes[index];
  quoteText.closest("blockquote").setAttribute("aria-label", `${selectedQuote.text} — ${selectedQuote.author}`);
  document.getElementById("cms-splash-quote-author").textContent = `— ${quotes[index].author}`;

  const offlineDots = document.getElementById("cms-splash-offline-dots");
  let quoteReady = false;
  function syncConnection() { offlineDots.hidden = navigator.onLine || !quoteReady; }
  syncConnection();
  window.addEventListener("online", syncConnection);
  window.addEventListener("offline", syncConnection);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const minimumDuration = reducedMotion ? 0 : 8000;
  const quoteDelay = 800;
  const quoteFadeDuration = 5000;
  const started = performance.now();
  let closing = false;

  quoteText.textContent = selectedQuote.text;
  splash.classList.add("is-playing");

  function finishQuoteFade() {
    quoteReady = true;
    splash.classList.add("is-quote-visible");
    syncConnection();
  }

  if (reducedMotion) finishQuoteFade();
  else window.setTimeout(finishQuoteFade, quoteDelay + quoteFadeDuration);

  function closeSplash() {
    if (closing) return;
    closing = true;
    const remaining = Math.max(0, minimumDuration - (performance.now() - started));
    window.setTimeout(() => {
      splash.classList.add("is-leaving");
      window.setTimeout(() => {
        splash.remove();
        window.removeEventListener("online", syncConnection);
        window.removeEventListener("offline", syncConnection);
      }, reducedMotion ? 0 : 260);
    }, remaining);
  }

  if (document.readyState === "complete") closeSplash();
  else window.addEventListener("load", closeSplash, { once: true });

  // Close after eight seconds even if an external asset is slow to load.
  window.setTimeout(closeSplash, 8000);
})();
