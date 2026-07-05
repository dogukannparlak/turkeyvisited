const DATA_KEY = "turkeyvisitedData";
const MAP_COLOR = "#fff2e3";
const DEFAULT_VISITED_COLOR = "#EFAE88";
const DEFAULT_PLANNED_COLOR = "#6B9BD1";

let activeMode = "visited";
let mapPaths = null;
let appData;

appData = loadData();

function loadData() {
  const stored = localStorage.getItem(DATA_KEY);
  if (stored) {
    const data = JSON.parse(stored);
    data.visited = data.visited || [];
    data.planned = data.planned || [];
    data.colors = data.colors || {};
    data.colors.visited = data.colors.visited || DEFAULT_VISITED_COLOR;
    data.colors.planned = data.colors.planned || DEFAULT_PLANNED_COLOR;
    return data;
  }

  const legacy = localStorage.getItem("selectedCities");
  const data = {
    visited: legacy ? JSON.parse(legacy) : [],
    planned: [],
    colors: {
      visited: DEFAULT_VISITED_COLOR,
      planned: DEFAULT_PLANNED_COLOR,
    },
  };

  if (legacy) {
    localStorage.removeItem("selectedCities");
  }

  saveData(data);
  return data;
}

function saveData(data) {
  appData = data;
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function getProvinceStatus(name) {
  if (appData.visited.includes(name)) return "visited";
  if (appData.planned.includes(name)) return "planned";
  return "none";
}

function getProvinceColor(status) {
  if (status === "visited") return appData.colors.visited;
  if (status === "planned") return appData.colors.planned;
  return MAP_COLOR;
}

function removeFromList(list, name) {
  const index = list.indexOf(name);
  if (index !== -1) {
    list.splice(index, 1);
  }
}

function updateCounts() {
  document.getElementById("visited_count").innerHTML = appData.visited.length;
  document.getElementById("planned_count").innerHTML = appData.planned.length;
}

function updateLegend() {
  document.getElementById("legend_visited_swatch").style.backgroundColor =
    appData.colors.visited;
  document.getElementById("legend_planned_swatch").style.backgroundColor =
    appData.colors.planned;
  document.getElementById("legend_none_swatch").style.backgroundColor = MAP_COLOR;
}

function setActiveMode(mode) {
  activeMode = mode;
  document.getElementById("mode_visited").classList.toggle("active", mode === "visited");
  document.getElementById("mode_planned").classList.toggle("active", mode === "planned");
}

function applyPathFill(selection, d) {
  selection.attr("fill", getProvinceColor(d.status));
}

function refreshMapColors() {
  if (!mapPaths) return;
  mapPaths.each(function (d) {
    applyPathFill(d3.select(this), d);
  });
}

function syncColorInputs() {
  document.getElementById("visited_color").value = appData.colors.visited;
  document.getElementById("planned_color").value = appData.colors.planned;
}

function initControls() {
  setActiveMode("visited");
  syncColorInputs();
  updateCounts();
  updateLegend();

  document.getElementById("mode_visited").addEventListener("click", function () {
    setActiveMode("visited");
  });

  document.getElementById("mode_planned").addEventListener("click", function () {
    setActiveMode("planned");
  });

  document.getElementById("visited_color").addEventListener("change", function (event) {
    appData.colors.visited = event.target.value;
    saveData(appData);
    refreshMapColors();
    updateLegend();
  });

  document.getElementById("planned_color").addEventListener("change", function (event) {
    appData.colors.planned = event.target.value;
    saveData(appData);
    refreshMapColors();
    updateLegend();
  });
}

initControls();

d3.json("tr-cities.json").then(function (data) {
  const width = 1200;
  const height = 800;
  const projection = d3.geoEqualEarth();
  projection.fitSize([width, height], data);
  const path = d3.geoPath().projection(projection);

  const svg = d3
    .select("#map_container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("preserveAspectRatio", "xMidYMid meet");

  mapPaths = svg
    .append("g")
    .selectAll("path")
    .data(data.features)
    .enter()
    .append("path")
    .attr("d", path)
    .each(function (d) {
      d.status = getProvinceStatus(d.properties.name);
    })
    .attr("fill", function (d) {
      return getProvinceColor(d.status);
    })
    .attr("stroke", "#000")
    .on("mouseover", function (d) {
      const hoverColor =
        d.status === "none" ? getProvinceColor(activeMode) : getProvinceColor(d.status);
      d3.select(this).attr("fill", hoverColor);
    })
    .on("mouseout", function (d) {
      applyPathFill(d3.select(this), d);
    })
    .on("click", function (d) {
      const name = d.properties.name;

      if (d.status === activeMode) {
        if (activeMode === "visited") {
          removeFromList(appData.visited, name);
        } else {
          removeFromList(appData.planned, name);
        }
        d.status = "none";
      } else if (d.status === "none") {
        if (activeMode === "visited") {
          appData.visited.push(name);
        } else {
          appData.planned.push(name);
        }
        d.status = activeMode;
      } else {
        if (d.status === "visited") {
          removeFromList(appData.visited, name);
        } else {
          removeFromList(appData.planned, name);
        }

        if (activeMode === "visited") {
          appData.visited.push(name);
        } else {
          appData.planned.push(name);
        }
        d.status = activeMode;
      }

      saveData(appData);
      applyPathFill(d3.select(this), d);
      updateCounts();
    });

  const labels = svg.append("g");

  labels
    .selectAll("text")
    .data(data.features)
    .enter()
    .append("text")
    .text(function (d) {
      return d.properties.name;
    })
    .attr("x", function (d) {
      return path.centroid(d)[0];
    })
    .attr("y", function (d) {
      return path.centroid(d)[1];
    })
    .attr("text-anchor", "middle")
    .attr("font-size", "10pt")
    .attr("fill", "black")
    .style("pointer-events", "none");
}).catch(function (error) {
  console.error("Harita verisi yuklenemedi:", error);
  document.getElementById("map_container").insertAdjacentHTML(
    "beforeend",
    "<p id=\"map_error\">Harita yüklenemedi. Sayfayı bir yerel sunucu üzerinden açın (örneğin: python3 -m http.server 8765).</p>"
  );
});

function downloadMap() {
  const exportDiv = document.createElement("div");
  exportDiv.style.background = "#e3e2df";
  exportDiv.style.display = "inline-block";
  exportDiv.style.padding = "0";

  const mapClone = document.getElementById("map_container").cloneNode(true);
  const legendClone = document.getElementById("map_legend").cloneNode(true);
  legendClone.style.marginTop = "8px";

  exportDiv.appendChild(mapClone);
  exportDiv.appendChild(legendClone);
  exportDiv.style.position = "fixed";
  exportDiv.style.left = "-9999px";
  exportDiv.style.top = "0";
  document.body.appendChild(exportDiv);

  html2canvas(exportDiv).then(function (canvas) {
    document.body.removeChild(exportDiv);

    const destCanvas = document.createElement("canvas");
    destCanvas.width = canvas.width;
    destCanvas.height = canvas.height;
    const destCtx = destCanvas.getContext("2d");
    destCtx.drawImage(canvas, 0, 0);

    const ctx = destCanvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "2em Calibri";
    ctx.fillStyle = "black";
    ctx.textAlign = "start";
    ctx.fillText("ozanyerli.github.io/turkeyvisited", 10, canvas.height - 25);
    ctx.fillText(
      "Ziyaret: " + appData.visited.length + "/81 | Plan: " + appData.planned.length + "/81",
      10,
      5
    );

    destCanvas.toBlob(function (blob) {
      saveAs(blob, "turkeyvisited.png");
    });
  });
}

function resetButton() {
  localStorage.removeItem(DATA_KEY);
  localStorage.removeItem("selectedCities");
  location.reload();
}
