/* LumaFind — Part 2: fetch images from Wikimedia Commons and render them. */

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const resultsContainer = document.getElementById("results");
const resultCount = document.getElementById("result-count");
const emptyState = document.getElementById("empty-state");
const chips = document.querySelectorAll(".chip");

const API_URL = "https://commons.wikimedia.org/w/api.php";
const RESULT_LIMIT = 24;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/* Safe-search: Wikimedia Commons has no built-in filter, so we do it ourselves. */
const BLOCKED_WORDS = [
    "nude", "nudity", "naked", "topless", "nsfw", "erotic", "erotica", "porn",
    "sex", "sexual", "genital", "penis", "vagina", "breast", "nipple",
    "fetish", "bdsm", "lingerie", "underwear", "bikini", "adult", "explicit",
    "gore", "corpse", "autopsy"
];

/* Tell the search engine itself to leave these words out. */
const EXCLUDE_TERMS = BLOCKED_WORDS.slice(0, 12).map((w) => "-" + w).join(" ");

/* True if the title, description or categories contain a blocked word. */
function isUnsafe(text) {
    const words = text.toLowerCase().split(/[^a-z]+/);
    return BLOCKED_WORDS.some((blocked) => words.includes(blocked));
}

/* Build the request URL for a search query. */
function buildUrl(query) {
    const params = [
        "action=query",
        "generator=search",
        "gsrsearch=" + encodeURIComponent(query + " " + EXCLUDE_TERMS),
        "gsrnamespace=6", // 6 = the "File:" namespace (images)
        "gsrlimit=" + RESULT_LIMIT,
        "prop=imageinfo",
        "iiprop=" + encodeURIComponent("url|mime|size|extmetadata"),
        "iiurlwidth=500", // ask for a 500px-wide thumbnail
        "format=json",
        "origin=*" // required for CORS
    ];
    return API_URL + "?" + params.join("&");
}

/* Wikimedia author fields contain HTML — turn it into safe plain text. */
function stripHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent.trim();
}

/* Turn the API's page object into a clean, ordered array of image results. */
function parseResults(data) {
    if (!data.query || !data.query.pages) return [];

    return Object.values(data.query.pages)
        .filter((page) => page.imageinfo && IMAGE_TYPES.includes(page.imageinfo[0].mime))
        .filter((page) => {
            const meta = page.imageinfo[0].extmetadata || {};
            const categories = meta.Categories ? meta.Categories.value : "";
            const description = meta.ImageDescription ? stripHtml(meta.ImageDescription.value) : "";
            return !isUnsafe(page.title + " " + categories + " " + description);
        })
        .sort((a, b) => a.index - b.index)
        .map((page) => {
            const info = page.imageinfo[0];
            const meta = info.extmetadata || {};
            return {
                title: page.title.replace(/^File:/, "").replace(/\.[^.]+$/, ""),
                thumb: info.thumburl || info.url,
                full: info.url,
                width: info.width,
                height: info.height,
                author: meta.Artist ? stripHtml(meta.Artist.value) : "Unknown author"
            };
        });
}

/* Build one card with createElement and return it. */
function createCard(item) {
    const card = document.createElement("a");
    card.className = "card";
    card.href = item.full; // open the full-size image...
    card.target = "_blank"; // ...in a new tab
    card.rel = "noopener noreferrer";

    const img = document.createElement("img");
    img.src = item.thumb;
    img.alt = item.title;
    img.loading = "lazy";

    const caption = document.createElement("div");
    caption.className = "card-caption";

    const title = document.createElement("h3");
    title.className = "card-title";
    title.textContent = item.title;

    const author = document.createElement("p");
    author.className = "card-author";
    author.textContent = "by " + item.author;

    const size = document.createElement("p");
    size.className = "card-size";
    size.textContent = item.width + " × " + item.height + " px";

    caption.appendChild(title);
    caption.appendChild(author);
    caption.appendChild(size);
    card.appendChild(img);
    card.appendChild(caption);

    return card;
}

/* Show results (or a "nothing found" message) in the grid. */
function renderResults(items, query) {
    resultsContainer.innerHTML = ""; // clear old results first

    if (items.length === 0) {
        resultCount.textContent = "No results";
        emptyState.querySelector("h3").textContent = "No results for “" + query + "”";
        emptyState.querySelector("p").textContent = "Try a different or broader search term.";
        emptyState.hidden = false;
        return;
    }

    emptyState.hidden = true;
    items.forEach((item) => resultsContainer.appendChild(createCard(item)));

    const word = items.length === 1 ? "result" : "results";
    resultCount.textContent = "Showing " + items.length + " " + word + " for “" + query + "”";
}

/* 1. Catch the search. */
form.addEventListener("submit", async (event) => {
    event.preventDefault(); // no page reload

    const query = input.value.trim();
    if (query === "") return; // 4. ignore blank searches

    // Safe-search: don't search for blocked words at all.
    if (isUnsafe(query)) {
        resultsContainer.innerHTML = "";
        resultCount.textContent = "Search blocked";
        emptyState.querySelector("h3").textContent = "Let’s keep it family-friendly";
        emptyState.querySelector("p").textContent = "Try a different search term.";
        emptyState.hidden = false;
        return;
    }

    // 2. Fetch the data.
    const response = await fetch(buildUrl(query));
    if (!response.ok) return; // Part 3 will add proper error messages

    const data = await response.json();

    // 3. Render the results.
    renderResults(parseResults(data), query);
});

/* Enhancement: clicking a quick-pick chip runs a search for it. */
chips.forEach((chip) => {
    chip.addEventListener("click", () => {
        input.value = chip.textContent;
        form.requestSubmit(); // goes through the same submit handler above
    });
});
