// IMPORTANT: abs_index.html is inside /pages
// So we must go UP one level to reach /datasets
const DATA_FILE = "../datasets/datasets_processed/abs_long_term_conditions_tidy.csv";

const container = d3.select("#chart");

// Visible error message area (so you don't have to rely on console only)
const status = container.append("div")
  .style("margin", "8px 0 0")
  .style("color", "#b00020")
  .style("font-weight", "600");

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

const margin = { top: 30, right: 30, bottom: 90, left: 260 };
const width = 1050;
const height = 650;

let sortDescending = true;

d3.csv(DATA_FILE, d => ({
  age_group: d.age_group,
  condition_group: d.condition_group,
  proportion: +d.proportion
}))
.then(data => {
  status.text(""); // clear error area if load succeeds

  if (!data.length) {
    status.text("CSV loaded but contains no rows.");
    return;
  }

  const ageGroups = Array.from(new Set(data.map(d => d.age_group)));
  let conditionGroups = Array.from(new Set(data.map(d => d.condition_group)));

  const svg = container.append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img");

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(ageGroups)
    .range([0, innerW])
    .padding(0.08);

  const y = d3.scaleBand()
    .domain(conditionGroups)
    .range([0, innerH])
    .padding(0.08);

  const minVal = d3.min(data, d => d.proportion);
  const maxVal = d3.max(data, d => d.proportion);

  const color = d3.scaleSequential()
    .domain([minVal, maxVal])
    .interpolator(d3.interpolateBlues);

  const gx = g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(d3.axisBottom(x));

  gx.selectAll("text")
    .attr("text-anchor", "end")
    .attr("transform", "rotate(-35)")
    .attr("dx", "-0.5em")
    .attr("dy", "0.3em");

  const gy = g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y));

  function renderTiles() {
    y.domain(conditionGroups);
    gy.transition().duration(450).call(d3.axisLeft(y));

    const tiles = g.selectAll("rect.tile")
      .data(data, d => `${d.condition_group}||${d.age_group}`);

    tiles.enter()
      .append("rect")
      .attr("class", "tile")
      .attr("x", d => x(d.age_group))
      .attr("y", d => y(d.condition_group))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => color(d.proportion))
      .on("mousemove", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>Condition:</strong> ${escapeHtml(d.condition_group)}</div>
            <div><strong>Age group:</strong> ${escapeHtml(d.age_group)}</div>
            <div><strong>Proportion:</strong> ${d.proportion}</div>
          `)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0))
      .merge(tiles)
      .transition()
      .duration(450)
      .attr("x", d => x(d.age_group))
      .attr("y", d => y(d.condition_group))
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => color(d.proportion));

    tiles.exit().remove();
  }

  renderTiles();

  d3.select("#sortBtn").on("click", () => {
    const totals = d3.rollup(
      data,
      v => d3.sum(v, d => d.proportion),
      d => d.condition_group
    );

    conditionGroups = conditionGroups.slice().sort((a, b) => {
      const diff = (totals.get(a) || 0) - (totals.get(b) || 0);
      return sortDescending ? -diff : diff;
    });

    sortDescending = !sortDescending;

    d3.select("#sortBtn").text(
      sortDescending
        ? "Sort conditions by total (descending)"
        : "Sort conditions by total (ascending)"
    );

    renderTiles();
  });
})
.catch(err => {
  console.error(err);
  status.text(
    "CSV failed to load. Check the path: " +
    DATA_FILE +
    " (and confirm the file name matches exactly)."
  );
});

// Basic HTML escaping for tooltip safety
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
