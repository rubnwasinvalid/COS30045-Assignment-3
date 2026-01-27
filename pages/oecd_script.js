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

  const svg = container.append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("role", "img");

  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain(d3.extent(data, d => d.year))
    .range([0, innerW]);

  // add a little padding to y so dots/line don’t touch edges
  const yMin = d3.min(data, d => d.value);
  const yMax = d3.max(data, d => d.value);
  const pad = (yMax - yMin) * 0.12 || 1;

  const y = d3.scaleLinear()
    .domain([yMin - pad, yMax + pad])
    .range([innerH, 0]);

  const xAxis = d3.axisBottom(x).ticks(Math.min(10, data.length)).tickFormat(d3.format("d"));
  const yAxis = d3.axisLeft(y).ticks(6);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerH})`)
    .call(xAxis);

  g.append("g")
    .attr("class", "axis")
    .call(yAxis);

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

  // Draw the line
  g.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "currentColor")
    .attr("stroke-width", 2)
    .attr("d", line);

  // Points
  g.selectAll("circle.point")
    .data(data)
    .enter()
    .append("circle")
    .attr("class", "point")
    .attr("cx", d => x(d.year))
    .attr("cy", d => y(d.value))
    .attr("r", 4)
    .attr("fill", "currentColor")
    .attr("opacity", 0.9);

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

  // Overlay to capture mouse movement
  const bisect = d3.bisector(d => d.year).left;

  g.append("rect")
    .attr("width", innerW)
    .attr("height", innerH)
    .attr("fill", "transparent")
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event);
      const yearX = x.invert(mx);

      let i = bisect(data, yearX);
      if (i <= 0) i = 1;
      if (i >= data.length) i = data.length - 1;

      const a = data[i - 1];
      const b = data[i];
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

})
.catch(err => {
  console.error(err);
  status.text(
    "CSV failed to load. Check the path: " +
    DATA_FILE +
    " (and confirm the file name matches exactly)."
  );
});
