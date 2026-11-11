/* LumaFind — Part 2: fetch images from Wikimedia Commons and render them. */

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const resultsContainer = document.getElementById("results");
const resultCount = document.getElementById("result-count");
const emptyState = document.getElementById("empty-state");
const chips = document.querySelectorAll(".chip");
const searchButton = document.getElementById("search-button");
const statusBox = document.getElementById("status");

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

/* ---------- Status area: loading / empty / error / blocked ---------- */

function hideStatus() {
    statusBox.hidden = true;
    statusBox.innerHTML = "";
}

function showStatus(type, title, message, withRetry) {
    emptyState.hidden = true;
    statusBox.className = "status status-" + type;
    statusBox.innerHTML = "";

    if (type === "loading") {
        const spinner = document.createElement("div");
        spinner.className = "spinner";
        spinner.setAttribute("aria-hidden", "true");
        statusBox.appendChild(spinner);
    }

    const heading = document.createElement("h3");
    heading.textContent = title;
    statusBox.appendChild(heading);

    if (message) {
        const text = document.createElement("p");
        text.textContent = message;
        statusBox.appendChild(text);
    }

    if (withRetry) {
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "retry-button";
        retry.textContent = "Try again";
        retry.addEventListener("click", () => form.requestSubmit());
        statusBox.appendChild(retry);
    }

    statusBox.hidden = false;
}

/* Show the cards and the result count. */
function renderResults(items, query) {
    resultsContainer.innerHTML = ""; // clear old results first
    hideStatus();

    items.forEach((item, index) => {
        const card = createCard(item);
        card.style.animationDelay = Math.min(index * 40, 600) + "ms"; // staggered fade-in
        resultsContainer.appendChild(card);
    });

    const word = items.length === 1 ? "result" : "results";
    resultCount.textContent = "Showing " + items.length + " " + word + " for “" + query + "”";
}

/* Only the most recent search is allowed to update the page. */
let latestSearch = 0;

/* 1. Catch the search. */
form.addEventListener("submit", async (event) => {
    event.preventDefault(); // no page reload

    const query = input.value.trim();
    if (query === "") return; // 4. ignore blank searches

    // Safe-search: don't search for blocked words at all.
    if (isUnsafe(query)) {
        resultsContainer.innerHTML = "";
        resultCount.textContent = "Search blocked";
        showStatus("empty", "Let’s keep it family-friendly", "Try a different search term.");
        return;
    }

    const searchId = ++latestSearch;

    // LOADING: show the indicator before fetch starts.
    resultsContainer.innerHTML = "";
    resultCount.textContent = "Searching…";
    showStatus("loading", "Searching for “" + query + "”…", "Finding the best images for you.");
    searchButton.disabled = true;

    try {
        // 2. Fetch the data.
        const response = await fetch(buildUrl(query));
        if (!response.ok) {
            throw new Error("Request failed with status " + response.status);
        }

        const data = await response.json();
        if (searchId !== latestSearch) return; // a newer search took over

        const items = parseResults(data);

        // EMPTY: never show a blank grid.
        if (items.length === 0) {
            resultCount.textContent = "No results";
            showStatus("empty", "No results for “" + query + "”", "No results for that word. Try another search.");
            return;
        }

        // 3. Render the results.
        renderResults(items, query);
    } catch (error) {
        if (searchId !== latestSearch) return;
        console.error(error);

        // ERROR: friendly message instead of a blank screen.
        resultsContainer.innerHTML = "";
        resultCount.textContent = "Search failed";
        showStatus("error", "Something went wrong", "Please check your connection and try again.", true);
    } finally {
        if (searchId === latestSearch) searchButton.disabled = false;
    }
});

/* Quick-pick chips run a search when clicked. */
chips.forEach((chip) => {
    chip.addEventListener("click", () => {
        input.value = chip.textContent;
        form.requestSubmit(); // goes through the same submit handler above
    });
});
