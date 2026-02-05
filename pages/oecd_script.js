// IMPORTANT: this HTML file is inside /pages
// so we go UP one level to reach /datasets
const DATA_FILE = "../datasets/datasets_processed/oecd_life_expectancy_aus.csv";

const container = d3.select("#chart");

// Visible error message area (so failures aren’t silent)
const status = container.append("div")
  .style("margin", "8px 0 0")
  .style("color", "#b00020")
  .style("font-weight", "600");

const tooltip = d3.select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

const margin = { top: 30, right: 30, bottom: 60, left: 70 };
const width = 980;
const height = 520;

d3.csv(DATA_FILE, d => ({
  year: +d.year,
  value: +d.value
}))
.then(data => {
  status.text("");

  if (!data.length) {
    status.text("CSV loaded but contains no rows.");
    return;
  }

  // sort by year (safety)
  data.sort((a, b) => a.year - b.year);

  // ADDED: year range filter setup (requires #startYear and #endYear in oecd_index.html)
  const years = data.map(d => d.year);
  const minYear = d3.min(years);
  const maxYear = d3.max(years);

  const startSel = d3.select("#startYear");
  const endSel = d3.select("#endYear");

  startSel.selectAll("option")
    .data(years)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  endSel.selectAll("option")
    .data(years)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d);

  startSel.property("value", minYear);
  endSel.property("value", maxYear);

  const svg = container.append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img");

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // CHANGED: domains will be updated inside render() for filtering
  const x = d3.scaleLinear().range([0, innerW]);
  const y = d3.scaleLinear().range([innerH, 0]);

  // CHANGED: keep axis groups for transitions
  const gx = g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`);

  const gy = g.append("g")
    .attr("class", "axis");

  // Axis labels 
  g.append("text")
    .attr("x", innerW / 2)
    .attr("y", innerH + 45)
    .attr("text-anchor", "middle")
    .attr("fill", "#6b7280")
    .attr("font-size", 12)
    .text("Year");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerH / 2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .attr("fill", "#6b7280")
    .attr("font-size", 12)
    .text("Life expectancy (value)");

  // Line generator
  const line = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.value));

  // CHANGED: store path so we can transition it
  const linePath = g.append("path")
    .attr("fill", "none")
    .attr("stroke", "currentColor")
    .attr("stroke-width", 2);

  // CHANGED: points group for update pattern
  const pointsG = g.append("g");

  // Hover guideline + focus dot 
  const focusLine = g.append("line")
    .attr("y1", 0)
    .attr("y2", innerH)
    .attr("stroke", "#9ca3af")
    .attr("stroke-dasharray", "4 4")
    .style("opacity", 0);

  const focusDot = g.append("circle")
    .attr("r", 6)
    .attr("fill", "currentColor")
    .style("opacity", 0);

  // CHANGED: store overlay so hover can use filtered data
  const overlay = g.append("rect")
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("fill", "transparent");

  // ADDED: filtering helpers
  function getFilteredData() {
    const start = +startSel.property("value");
    const end = +endSel.property("value");

    if (start > end) return data.filter(d => d.year >= end && d.year <= start);
    return data.filter(d => d.year >= start && d.year <= end);
  }

  // ADDED: render with transitions
  function render() {
    const filtered = getFilteredData();

    if (!filtered.length) {
      status.text("No data available for the selected year range.");
      return;
    }
    status.text("");

    const t = d3.transition().duration(600);

    // domains based on filtered data
    x.domain(d3.extent(filtered, d => d.year));

    const yMin = d3.min(filtered, d => d.value);
    const yMax = d3.max(filtered, d => d.value);
    const pad = (yMax - yMin) * 0.12 || 1;
    y.domain([yMin - pad, yMax + pad]);

    // axes with transitions
    gx.transition(t)
      .call(d3.axisBottom(x).ticks(Math.min(10, filtered.length)).tickFormat(d3.format("d")));

    gy.transition(t)
      .call(d3.axisLeft(y).ticks(6));

    // line with transition
    linePath.datum(filtered)
      .transition(t)
      .attr("d", line);

    // points update pattern with transition
    const pts = pointsG.selectAll("circle.point")
      .data(filtered, d => d.year);

    pts.enter()
      .append("circle")
      .attr("class", "point")
      .attr("r", 4)
      .attr("fill", "currentColor")
      .attr("opacity", 0.9)
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.value))
      .merge(pts)
      .transition(t)
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.value));

    pts.exit()
      .transition(t)
      .attr("opacity", 0)
      .remove();

    // hover uses filtered data
    const bisect = d3.bisector(d => d.year).left;

    overlay
      .on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        const yearX = x.invert(mx);

        let i = bisect(filtered, yearX);
        if (i <= 0) i = 1;
        if (i >= filtered.length) i = filtered.length - 1;

        const a = filtered[i - 1];
        const b = filtered[i];
        const d = (yearX - a.year) < (b.year - yearX) ? a : b;

        focusLine
          .style("opacity", 1)
          .attr("x1", x(d.year))
          .attr("x2", x(d.year));

        focusDot
          .style("opacity", 1)
          .attr("cx", x(d.year))
          .attr("cy", y(d.value));

        tooltip
          .style("opacity", 1)
          .html(`
            <div><strong>Year:</strong> ${d.year}</div>
            <div><strong>Value:</strong> ${d.value}</div>
          `)
          .style("left", (event.pageX + 12) + "px")
          .style("top", (event.pageY + 12) + "px");
      })
      .on("mouseout", () => {
        focusLine.style("opacity", 0);
        focusDot.style("opacity", 0);
        tooltip.style("opacity", 0);
      });
  }

  // ADDED: clamp + event hooks
  function clampRange() {
    const s = +startSel.property("value");
    const e = +endSel.property("value");
    if (s > e) endSel.property("value", s);
  }

  // initial draw
  render();

  startSel.on("change", () => { clampRange(); render(); });
  endSel.on("change", () => { clampRange(); render(); });

})
.catch(err => {
  console.error(err);
  status.text(
    "CSV failed to load. Check the path: " +
    DATA_FILE +
    " (and confirm the file name matches exactly)."
  );
});
