(function () {
  const canvas = document.getElementById("tradingChart");
  if (!canvas) throw new Error("Simulation chart canvas not found.");

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to initialize the simulation chart canvas.");

  const assets = {
    "EUR/USD": { price: 1.0842, precision: 5, delta: 0.00015 },
    "GBP/USD": { price: 1.2915, precision: 5, delta: 0.0002 },
    "USD/JPY": { price: 154.2, precision: 3, delta: 0.04 },
    "BTC/USD": { price: 91420, precision: 2, delta: 12 },
    "ETH/USD": { price: 3140.5, precision: 2, delta: 1.8 },
    "XAU/USD": { price: 2684.3, precision: 2, delta: 0.8 },
    "USD/KES": { price: 129.5, precision: 2, delta: 0.05 },
    "OIL/USD": { price: 74.85, precision: 2, delta: 0.08 },
  };
  const history = Object.fromEntries(
    Object.entries(assets).map(([name, asset]) => {
      let price = asset.price;
      const points = Array.from({ length: 80 }, () => {
        price += (Math.random() - 0.498) * asset.delta;
        return Number(price.toFixed(asset.precision));
      });
      asset.price = points[points.length - 1];
      return [name, points];
    }),
  );

  let currentAsset = "EUR/USD";
  let zoomLevel = 50;

  function drawChart() {
    const width = canvas.parentElement.clientWidth;
    const height = canvas.parentElement.clientHeight;
    if (width < 2 || height < 2) return;

    context.clearRect(0, 0, width, height);
    const asset = assets[currentAsset];
    const points = history[currentAsset].slice(-zoomLevel);
    const min = Math.min(...points);
    const max = Math.max(...points);
    const padding = Math.max((max - min) * 0.12, asset.delta * 0.5);
    const minPrice = min - padding;
    const maxPrice = max + padding;
    const priceRange = maxPrice - minPrice;
    const verticalPadding = 24;
    const axisWidth = 64;
    const chartWidth = width - axisWidth;
    const chartHeight = height - verticalPadding * 2;
    const x = index => (index / (points.length - 1)) * chartWidth;
    const y = price => verticalPadding + chartHeight - ((price - minPrice) / priceRange) * chartHeight;

    context.strokeStyle = "rgba(224, 204, 255, 0.08)";
    context.setLineDash([3, 4]);
    context.beginPath();
    context.moveTo(0, height / 2);
    context.lineTo(chartWidth, height / 2);
    context.stroke();
    context.setLineDash([]);

    context.font = "10px IBM Plex Mono, monospace";
    context.fillStyle = "#9d8ec2";
    for (let index = 0; index <= 4; index += 1) {
      const lineY = verticalPadding + (chartHeight / 4) * index;
      const price = maxPrice - (priceRange / 4) * index;
      context.fillText(price.toFixed(asset.precision), chartWidth + 6, lineY + 3);
    }

    const gradient = context.createLinearGradient(0, verticalPadding, 0, height);
    gradient.addColorStop(0, "rgba(168, 85, 247, 0.22)");
    gradient.addColorStop(1, "rgba(168, 85, 247, 0)");
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(x(0), height);
    points.forEach((price, index) => context.lineTo(x(index), y(price)));
    context.lineTo(x(points.length - 1), height);
    context.closePath();
    context.fill();

    context.strokeStyle = "#e0ccff";
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((price, index) => {
      if (index === 0) context.moveTo(x(index), y(price));
      else context.lineTo(x(index), y(price));
    });
    context.stroke();

    const lastPrice = points[points.length - 1];
    const lastX = x(points.length - 1);
    const lastY = y(lastPrice);
    context.beginPath();
    context.arc(lastX, lastY, 4, 0, Math.PI * 2);
    context.fillStyle = "#a855f7";
    context.fill();
    context.strokeStyle = "#f5f0ff";
    context.lineWidth = 1.5;
    context.stroke();

    context.fillStyle = "#a855f7";
    context.fillRect(chartWidth + 2, lastY - 9, 58, 18);
    context.fillStyle = "#090514";
    context.font = "bold 9px IBM Plex Mono, monospace";
    context.fillText(lastPrice.toFixed(asset.precision), chartWidth + 5, lastY + 3);
  }

  function updatePriceLabels() {
    const asset = assets[currentAsset];
    const priceElement = document.getElementById("centerPrice");
    const assetElement = document.getElementById("centerAssetLabel");
    const changeElement = document.getElementById("centerChangeBadge");
    const initialPrice = history[currentAsset][0];
    const change = asset.price - initialPrice;
    const percentage = ((change / initialPrice) * 100).toFixed(3);

    if (priceElement) {
      priceElement.textContent = asset.price.toFixed(asset.precision);
      priceElement.style.color = change >= 0 ? "var(--accent-green)" : "var(--accent-red)";
    }
    if (assetElement) assetElement.textContent = currentAsset;
    if (changeElement) {
      changeElement.textContent = `${change >= 0 ? "+" : ""}${percentage}%`;
      changeElement.style.color = change >= 0 ? "var(--accent-green)" : "var(--accent-red)";
    }

    const ticker = document.getElementById(`tick_${currentAsset.replace("/", "_")}`);
    if (ticker) ticker.textContent = asset.price.toFixed(asset.precision);
  }

  function resizeChart() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
    canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    drawChart();
  }

  document.querySelectorAll(".asset-tab").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".asset-tab").forEach(tab => tab.classList.remove("active"));
      button.classList.add("active");
      currentAsset = button.dataset.asset;
      updatePriceLabels();
      drawChart();
    });
  });

  document.getElementById("zoomInBtn")?.addEventListener("click", () => {
    zoomLevel = Math.max(20, zoomLevel - 8);
    drawChart();
  });
  document.getElementById("zoomOutBtn")?.addEventListener("click", () => {
    zoomLevel = Math.min(100, zoomLevel + 10);
    drawChart();
  });
  window.addEventListener("resize", resizeChart);

  function tick() {
    Object.entries(assets).forEach(([name, asset]) => {
      asset.price = Number((asset.price + (Math.random() - 0.499) * asset.delta).toFixed(asset.precision));
      history[name].push(asset.price);
      if (history[name].length > 150) history[name].shift();

      const ticker = document.getElementById(`tick_${name.replace("/", "_")}`);
      if (ticker) ticker.textContent = asset.price.toFixed(asset.precision);
    });

    updatePriceLabels();
    drawChart();
  }

  updatePriceLabels();
  window.setTimeout(resizeChart, 40);
  window.setInterval(tick, 1000);
})();
