const $ = (id) => document.getElementById(id);
let dashboardData = null;

function toast(message) {
  const node = $("toast");
  node.textContent = message;
  node.classList.add("show");
  setTimeout(() => node.classList.remove("show"), 2600);
}

async function analyze(csv) {
  try {
    toast("Analyzing reviews...");
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Analysis failed");
    dashboardData = data;
    render(data);
    toast("Analysis complete");
  } catch (error) {
    toast(error.message);
  }
}

function percent(value, total) {
  return total ? Math.round(value * 100 / total) + "%" : "0%";
}

function render(data) {
  $("emptyState").setAttribute("hidden", "");
  $("dashboard").removeAttribute("hidden");
  const s = data.summary;
  $("totalMetric").textContent = s.total;
  $("failedMetric").textContent = s.failed ? s.failed + " failed" : "all successful";
  $("positiveMetric").textContent = percent(s.positive, s.total);
  $("neutralMetric").textContent = percent(s.neutral, s.total);
  $("negativeMetric").textContent = percent(s.negative, s.total);
  $("replyMetric").textContent = s.needs_reply;
  $("aiCalls").textContent = data.stats.ai_calls;
  $("cacheHits").textContent = data.stats.cache_hits;
  $("processTime").textContent = data.stats.processing_ms + " ms";
  $("agreement").textContent = s.agreement == null ? "—" : s.agreement + "%";

  $("complaints").innerHTML = data.complaints.map(item =>
    `<div class="insight"><span>${item.label}</span><span class="count">${item.count}</span></div>`
  ).join("") || '<p class="muted">No complaints found</p>';
  $("praises").innerHTML = data.praises.map(item =>
    `<div class="insight"><span>${item.label}</span><span class="count">${item.count}</span></div>`
  ).join("") || '<p class="muted">No praises found</p>';

  const products = [...new Set(data.reviews.map(r => r.product))].sort();
  $("productFilter").innerHTML = '<option value="">All products</option>' +
    products.map(product => `<option value="${escapeHtml(product)}">${escapeHtml(product)}</option>`).join("");
  const topics = [...new Set(data.reviews.flatMap(r => r.topics))].sort();
  $("topicFilter").innerHTML = '<option value="">All topics</option>' +
    topics.map(topic => `<option value="${topic}">${topic}</option>`).join("");
  renderRows();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])
  );
}

function ratingBucket(rating) {
  if (rating === 1 || rating === 2) return "negative";
  if (rating === 4 || rating === 5) return "positive";
  return "neutral";
}

function renderRows() {
  if (!dashboardData) return;
  const product = $("productFilter").value;
  const sentiment = $("sentimentFilter").value;
  const topic = $("topicFilter").value;
  const filtered = dashboardData.reviews.filter(review =>
    (!product || review.product === product) &&
    (!sentiment || review.sentiment === sentiment) &&
    (!topic || review.topics.includes(topic))
  );
  $("reviewRows").innerHTML = filtered.map(review => {
    const mismatch = review.rating && review.sentiment && ratingBucket(review.rating) !== review.sentiment;
    const rating = review.rating == null ? "Unknown" : "★".repeat(review.rating);
    const reply = review.needs_reply
      ? `<button class="reply-button" data-review="${escapeHtml(review.review_text)}" data-product="${escapeHtml(review.product)}">Generate reply</button><span class="reply-target"></span>`
      : "<span>—</span>";
    const failed = "analysis_failed" in review.analysis;
    return `<tr>
      <td><strong>${escapeHtml(review.review_id)}</strong><br><small>${escapeHtml(review.date)}</small></td>
      <td>${escapeHtml(review.product)}</td>
      <td>${rating}${mismatch ? '<span class="mismatch" title="Rating disagrees with sentiment">Mismatch</span>' : ""}</td>
      <td><span class="sentiment ${failed ? "neutral" : review.sentiment || "neutral"}">${failed ? "failed" : (review.sentiment || "—")}</span></td>
      <td>${review.topics.map(item => `<span class="topic">${item}</span>`).join("")}</td>
      <td>${escapeHtml(review.summary)}</td>
      <td>${reply}</td>
    </tr>`;
  }).join("");

  document.querySelectorAll(".reply-button").forEach(button => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      button.textContent = "Generating...";
      const response = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_text: button.dataset.review, product: button.dataset.product }),
      });
      const data = await response.json();
      button.nextElementSibling.innerHTML = `<span class="reply-text">${escapeHtml(data.reply)}</span>`;
      button.remove();
    });
  });
}

$("uploadButton").addEventListener("click", () => $("csvFile").click());
$("csvFile").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (file) analyze(await file.text());
});
$("sampleButton").addEventListener("click", async () => {
  const response = await fetch("/api/sample");
  const data = await response.json();
  analyze(data.csv);
});
["productFilter", "sentimentFilter", "topicFilter"].forEach(id =>
  $(id).addEventListener("change", renderRows)
);
