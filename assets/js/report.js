/**************************************************************
 * Smooth Scrolling for Sidebar Navigation Links
 * ------------------------------------------------------------
 * Adds smooth scrolling behavior when clicking any anchor link
 * inside the `.sidebar` element. Prevents default jump behavior
 * and scrolls smoothly to the section referenced in the href.
 **************************************************************/
document.querySelectorAll('.sidebar a').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault(); // Prevent default browser jump
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});


/**************************************************************
 * MAIN DATA LOAD
 * ------------------------------------------------------------
 * Fetches all stored data from Chrome local storage.
 * Loads today’s data for summary/charts, initializes all
 * analysis modules, and automatically applies default date ranges.
 **************************************************************/
chrome.storage.local.get(null, async data => {
    const todayKey = getToday();               // e.g., "01-02-2025"
    const todayData = data[todayKey] || [];    // Array of entries for today

    renderSummary(todayData);
    renderTodayCharts(todayData);

    // Attach all event listeners for range analysis features
    initRangeAnalysis(data);
    initRangeLineAnalysis(data);
    initMultiWebsiteAnalysis(data);
    initTop5RangeAnalysis(data);
    initAvgWebsiteAnalysis(data);

    // Set defaults & auto-trigger generate buttons
    setDefaultDateRange("rangeFrom", "rangeTo", "generateRangeBtn", 30);
    setDefaultDateRange("lineRangeFrom", "lineRangeTo", "generateLineRangeBtn", 30);
    setDefaultDateRange("multiWebFrom", "multiWebTo", "generateMultiWebBtn", 30);
    setDefaultDateRange("top5From", "top5To", "generateTop5Btn", 30);
    setDefaultDateRange("avgWebFrom", "avgWebTo", "generateAvgWebBtn", 30);
});


//*******************************************************//
//*******************UTILITY FUNCTIONS*******************//
//*******************************************************//

/**
 * Returns an array of N random colors, cycling through a predefined palette.
 * If index `i` is provided, return only the i-th color.
 *
 * @param {number} num - Number of colors to generate
 * @param {number} [i] - Optional explicit index for single color
 * @returns {string|string[]} Hex color string or array of them
 */
function randomColor(num, i = undefined) {
    let colors = [
        "#cd0808ff", "#cd6408ff", "#cdb308ff", "#9ccd08ff", "#40cd08ff", "#08cd7eff",
        "#08a9cdff", "#0871cdff", "#082fcdff", "#6b08cdff", "#a908cdff", "#cd08afff",
        "#cd0874ff",

        "#8b0505ff", "#854106ff", "#8a7908ff", "#678706ff", "#298405ff", "#058552ff",
        "#06728aff", "#064a87ff", "#071f7eff", "#440582ff", "#6c0683ff", "#840671ff",
        "#7d0647ff"
    ];

    if (i !== undefined) return colors[i % colors.length];

    let requiredColors = [];
    for (let j = 0; j < num; j++) {
        requiredColors.push(colors[j % colors.length]); // Cycle through palette
    }
    return requiredColors;
}

/**
 * Returns today's date key in format DD-MM-YYYY.
 * @returns {string}
 */
function getToday() {
    const d = new Date();
    return d.toLocaleDateString('en-GB').replaceAll('/', '-');
}

/**
 * Sums a list of time entries safely.
 * @param {Array} arr - Items with `time` values in seconds
 * @returns {number}
 */
function sumTimes(arr) {
    return arr.reduce((t, x) => t + (x.time || 0), 0);
}

/**
 * Converts HTML date input (YYYY-MM-DD) to storage key format DD-MM-YYYY.
 * @param {string} d
 * @returns {string|null}
 */
function convertHtmlDateToKey(d) {
    if (!d) return null;
    const [year, month, day] = d.split("-");
    return `${day}-${month}-${year}`;
}

/**
 * Checks whether a date key (DD-MM-YYYY) falls within a given range.
 * @param {string} dateKey
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {boolean}
 */
function isDateInRange(dateKey, fromKey, toKey) {
    const d = new Date(dateKey.split("-").reverse().join("-"));
    const f = new Date(fromKey.split("-").reverse().join("-"));
    const t = new Date(toKey.split("-").reverse().join("-"));
    return d >= f && d <= t;
}

/**
 * Aggregates total seconds spent per website over a date range.
 * @param {object} data - Dataset {dateKey → [items]}
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {object} website → total seconds
 */
function aggregateByWebsiteInRange(data, fromKey, toKey) {
    const totals = {};

    Object.keys(data).forEach(dateKey => {
        if (isDateInRange(dateKey, fromKey, toKey)) {
            data[dateKey].forEach(item => {
                totals[item.website] = (totals[item.website] || 0) + item.time;
            });
        }
    });

    return totals;
}

/**
 * Returns list of {date, mins} objects for charting daily totals.
 * @param {object} data
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {Array}
 */
function getDailyTotalsInRange(data, fromKey, toKey) {
    const result = [];

    Object.keys(data).forEach(dateKey => {
        if (isDateInRange(dateKey, fromKey, toKey)) {
            const totalMinutes = Math.round(sumTimes(data[dateKey]) / 60);
            result.push({ date: dateKey, mins: totalMinutes });
        }
    });

    // Sort chronological
    return result.sort((a, b) =>
        new Date(a.date.split("-").reverse().join("-")) -
        new Date(b.date.split("-").reverse().join("-"))
    );
}

/**
 * Builds a matrix for multi-website daily charting.
 * @param {object} data
 * @param {string} fromKey
 * @param {string} toKey
 * @returns {{dayList: string[], matrix: object}}
 */
function getWebsiteDailyMatrix(data, fromKey, toKey) {
    const dayList = [];
    const matrix = {};

    // Collect all valid days in range
    Object.keys(data).forEach(dateKey => {
        if (isDateInRange(dateKey, fromKey, toKey)) {
            dayList.push(dateKey);
        }
    });

    // Sort dates
    dayList.sort((a, b) =>
        new Date(a.split("-").reverse().join("-")) -
        new Date(b.split("-").reverse().join("-"))
    );

    // Initialize each website’s daily array
    dayList.forEach(dateKey => {
        data[dateKey].forEach(item => {
            if (!matrix[item.website]) matrix[item.website] = Array(dayList.length).fill(0);
        });
    });

    // Fill matrix with minute values
    dayList.forEach((dateKey, idx) => {
        data[dateKey].forEach(item => {
            matrix[item.website][idx] += Math.round(item.time / 60);
        });
    });

    return { dayList, matrix };
}

/**
 * Returns total usage time per site in range.
 */
function aggregateTop5InRange(data, fromKey, toKey) {
    const totals = {};

    Object.keys(data).forEach(dateKey => {
        if (isDateInRange(dateKey, fromKey, toKey)) {
            data[dateKey].forEach(item => {
                totals[item.website] = (totals[item.website] || 0) + item.time;
            });
        }
    });

    return totals;
}

/**
 * Computes average daily minutes per website over a date range.
 * @returns {object} website → average minutes
 */
function computeAveragePerWebsite(data, fromKey, toKey) {
    const totals = {};
    let dayCount = 0;

    Object.keys(data).forEach(dateKey => {
        if (isDateInRange(dateKey, fromKey, toKey)) {
            dayCount++;
            data[dateKey].forEach(item => {
                totals[item.website] = (totals[item.website] || 0) + item.time;
            });
        }
    });

    if (dayCount === 0) return {};

    const averages = {};
    Object.entries(totals).forEach(([site, totalTime]) => {
        averages[site] = Math.round((totalTime / 60) / dayCount);
    });

    return averages;
}

/**
 * Sets the default past range for date selectors and triggers analysis button.
 *
 * @param {string} fromId - HTML input ID for "from" date
 * @param {string} toId - HTML input ID for "to" date
 * @param {string} btnId - Button ID to click after setting values
 * @param {number} daysBack - Number of past days to include (default: 30)
 */
function setDefaultDateRange(fromId, toId, btnId, daysBack = 30) {
    const today = new Date();
    const past = new Date();
    past.setDate(today.getDate() - daysBack);

    const format = d => d.toISOString().split("T")[0]; // yyyy-mm-dd

    document.getElementById(fromId).value = format(past);
    document.getElementById(toId).value = format(today);
    document.getElementById(btnId).click();
}

//*******************************************************//
//*************** INITIALIZATION FUNCTIONS ***************//
//*******************************************************//

/**
 * Initializes the Range Analysis section.
 * -------------------------------------------------------
 * On button click:
 *  - Reads the selected date range
 *  - Validates both FROM and TO dates
 *  - Aggregates total usage time per website in range
 *  - Renders bar chart and data table of the results
 *
 * @param {object} data - Full dataset stored by dates
 */
function initRangeAnalysis(data) {
    document.getElementById("generateRangeBtn").addEventListener("click", () => {
        const from = convertHtmlDateToKey(document.getElementById("rangeFrom").value);
        const to = convertHtmlDateToKey(document.getElementById("rangeTo").value);

        // Validate user input
        if (!from || !to) {
            alert("Please select both FROM and TO dates.");
            return;
        }

        const totals = aggregateByWebsiteInRange(data, from, to);

        // Render results
        renderRangeChart(totals);
        renderRangeTable(totals);
    });
}


/**
 * Initializes daily line graph usage analysis.
 * -------------------------------------------------------
 * On button click:
 *  - Reads date range
 *  - Validates selection
 *  - Creates array of daily usage totals
 *  - Renders line chart
 *
 * @param {object} data
 */
function initRangeLineAnalysis(data) {
    document.getElementById("generateLineRangeBtn").addEventListener("click", () => {
        const from = convertHtmlDateToKey(document.getElementById("lineRangeFrom").value);
        const to = convertHtmlDateToKey(document.getElementById("lineRangeTo").value);

        if (!from || !to) {
            alert("Please select FROM and TO dates.");
            return;
        }

        const totals = getDailyTotalsInRange(data, from, to);

        renderRangeLineChart(totals);
    });
}


/**
 * Initializes multi-website comparison chart.
 * -------------------------------------------------------
 * On button click:
 *  - Reads date range
 *  - Builds time-matrix for every website vs each day
 *  - Renders multi-line comparison chart
 *  - Alerts if no data available
 *
 * @param {object} data
 */
function initMultiWebsiteAnalysis(data) {
    document.getElementById("generateMultiWebBtn")
        .addEventListener("click", () => {

            const from = convertHtmlDateToKey(document.getElementById("multiWebFrom").value);
            const to = convertHtmlDateToKey(document.getElementById("multiWebTo").value);

            if (!from || !to) {
                alert("Please select FROM and TO dates.");
                return;
            }

            const { dayList, matrix } = getWebsiteDailyMatrix(data, from, to);

            // No results within range
            if (dayList.length === 0) {
                alert("No data in this range.");
                return;
            }

            renderMultiWebsiteChart(dayList, matrix);
        });
}


/**
 * Initializes Top 5 websites usage analysis.
 * -------------------------------------------------------
 * On button click:
 *  - Reads range
 *  - Aggregates totals per website
 *  - Validates existence of at least one record
 *  - Renders chart of top 5 high-usage sites
 *
 * @param {object} data
 */
function initTop5RangeAnalysis(data) {
    document.getElementById("generateTop5Btn")
        .addEventListener("click", () => {

            const from = convertHtmlDateToKey(document.getElementById("top5From").value);
            const to = convertHtmlDateToKey(document.getElementById("top5To").value);

            if (!from || !to) {
                alert("Please select both FROM and TO dates.");
                return;
            }

            const totals = aggregateTop5InRange(data, from, to);

            if (Object.keys(totals).length === 0) {
                alert("No data found in this range.");
                return;
            }

            renderTop5RangeChart(totals);
        });
}


/**
 * Initializes Average Daily Usage per Website analysis.
 * -------------------------------------------------------
 * On button click:
 *  - Reads range
 *  - Computes average minutes spent per day for each site
 *  - Enforces valid date selection
 *  - Charts bar graph with averages
 *
 * @param {object} data
 */
function initAvgWebsiteAnalysis(data) {
    document.getElementById("generateAvgWebBtn")
        .addEventListener("click", () => {

            const from = convertHtmlDateToKey(
                document.getElementById("avgWebFrom").value
            );
            const to = convertHtmlDateToKey(
                document.getElementById("avgWebTo").value
            );

            if (!from || !to) {
                alert("Please select both FROM and TO dates.");
                return;
            }

            const averages = computeAveragePerWebsite(data, from, to);

            if (Object.keys(averages).length === 0) {
                alert("No data found in this range.");
                return;
            }

            renderAvgWebsiteBar(averages);
        });
}

//*********************************************************//
//******************* RENDERING FUNCTIONS *****************//
//*********************************************************//

/**
 * Renders summary cards for today's overview panel.
 * Displays:
 *   - Total time spent (in minutes)
 *   - Top website based on time
 *   - Count of individual sites visited today
 *
 * @param {Array} todayData - Array of today's usage records
 */
function renderSummary(todayData) {
    const totalTime = sumTimes(todayData);
    const top = [...todayData].sort((a, b) => b.time - a.time)[0];

    // Total usage time card
    document.getElementById('total-time-card').innerHTML =
        `<h3>Total Time</h3><p>${Math.round(totalTime / 60)} mins</p>`;

    // Highest usage website
    document.getElementById('top-website-card').innerHTML =
        `<h3>Top Website</h3><p>${top ? top.website : 'N/A'}</p>`;

    // Number of websites visited today
    document.getElementById('sites-visited-card').innerHTML =
        `<h3>Websites Visited</h3><p>${todayData.length}</p>`;
}


/**
 * Renders two charts for today's usage:
 *   - Bar chart showing top 5 highest-used sites
 *   - Pie chart showing distribution across all sites
 *
 * @param {Array} todayData
 */
function renderTodayCharts(todayData) {
    const top5 = [...todayData]
        .sort((a, b) => b.time - a.time)
        .slice(0, 5);

    // ---------- BAR CHART: Top 5 Websites ----------
    new Chart(document.getElementById('todayTop5Chart'), {
        type: 'bar',
        data: {
            labels: ["Usage time:"],
            datasets: top5.map((x, i) => ({
                label: x.website,
                data: [Math.round(x.time / 60)],
                backgroundColor: randomColor(top5.length, i),
                categoryPercentage: 1.0
            }))
        },
        options: {
            responsive: true,
            scales: {
                x: { ticks: { display: false } },
                y: { ticks: { color: "#ffffff" } }
            },
            plugins: {
                legend: {
                    labels: { color: "#ffffffff" },
                    display: true,
                    position: 'bottom',
                    align: 'center',
                }
            }
        }
    });

    // ---------- PIE CHART: Usage share distribution ----------
    new Chart(document.getElementById('todayPieChart'), {
        type: 'pie',
        data: {
            labels: todayData.map(x => x.website),
            datasets: [{
                data: todayData.map(x => Math.round(x.time / 60)),
                backgroundColor: randomColor(todayData.length)
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: "#ffffffff" },
                    display: true,
                    position: 'bottom',
                    align: 'center'
                }
            }
        }
    });
}


/**
 * Renders a sorted table showing websites and time spent for date-range analysis.
 *
 * @param {object} totals - {website: seconds}
 */
function renderRangeTable(totals) {
    const tbody = document.querySelector("#rangeTable tbody");
    tbody.innerHTML = "";

    Object.entries(totals)
        .sort((a, b) => b[1] - a[1])   // Sort descending by time
        .forEach(([site, time]) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${site}</td>
                <td>${Math.round(time / 60)}</td>
            `;
            tbody.appendChild(tr);
        });
}


let rangeChartInstance = null;
/**
 * Renders bar chart for total usage by website across a selected date range.
 *
 * @param {object} totals - website → total time (seconds)
 */
function renderRangeChart(totals) {
    const ctx = document.getElementById("rangeWebsiteChart");
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);

    // Remove old chart instance to prevent memory overlap
    if (rangeChartInstance) rangeChartInstance.destroy();

    rangeChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Total usage time:"],
            datasets: sorted.map((x, i) => ({
                label: x[0],
                data: [Math.round(x[1] / 60)],
                backgroundColor: randomColor(sorted.length, i),
                categoryPercentage: 1.0
            }))
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: { display: false },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: "#ffffff" },
                    grid: { color: "#7b7b7b76" }
                }
            },
            plugins: {
                legend: {
                    labels: { color: "#ffffffff" },
                    display: true,
                    position: 'bottom',
                    align: 'center',
                }
            }
        }
    });
}


let rangeLineChartInstance = null;
/**
 * Renders line chart for total minutes per day in a date range.
 *
 * @param {Array} entries - [{date, mins}]
 */
function renderRangeLineChart(entries) {
    const ctx = document.getElementById("rangeLineChart");

    if (rangeLineChartInstance) rangeLineChartInstance.destroy();

    rangeLineChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: entries.map(e => e.date),
            datasets: [{
                label: "Total Screen Time",
                data: entries.map(e => e.mins),
                borderColor: "#00c8ff",
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: "#00c8ff"
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: { color: "#ffffffff", maxRotation: 90, minRotation: 45 },
                    grid: { color: "#7b7b7b76" }
                },
                y: {
                    ticks: { color: "#ffffffff" },
                    grid: { color: "#7b7b7b76" }
                }
            },
            plugins: {
                legend: {
                    labels: { color: "#ffffffff" },
                    display: true,
                    position: 'bottom',
                    align: 'center',
                }
            }
        }
    });
}


let multiWebsiteChartInstance = null;
/**
 * Renders multi-line comparison chart for multiple website usage trends.
 *
 * @param {string[]} dayList - Ordered dates
 * @param {object} matrix - website → [minutes per day]
 */
function renderMultiWebsiteChart(dayList, matrix) {
    const ctx = document.getElementById("multiWebsiteChart");

    if (multiWebsiteChartInstance) multiWebsiteChartInstance.destroy();

    const datasets = Object.entries(matrix).map(([website, minutesArr], i) => ({
        label: website,
        data: minutesArr,
        borderColor: randomColor(website.length, i),
        tension: 0.3,
        borderWidth: 2,
        fill: false
    }));

    multiWebsiteChartInstance = new Chart(ctx, {
        type: "line",
        data: { labels: dayList, datasets },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: { color: "#ffffffff", maxRotation: 90, minRotation: 45 },
                    grid: { color: "#7b7b7b76" }
                },
                y: {
                    ticks: { color: "#ffffffff" },
                    grid: { color: "#7b7b7b76" }
                }
            },
            plugins: {
                legend: {
                    labels: { color: "#ffffffff" },
                    display: true,
                    position: 'bottom',
                    align: 'center',
                }
            }
        }
    });
}


let top5RangeChartInstance = null;
/**
 * Renders bar chart for the top 5 time-consuming websites across a date range.
 *
 * @param {object} totals - website → seconds
 */
function renderTop5RangeChart(totals) {
    const ctx = document.getElementById("top5RangeChart");

    if (top5RangeChartInstance) top5RangeChartInstance.destroy();

    const sorted = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    top5RangeChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Avg. usage time:"],
            datasets: sorted.map((x, i) => ({
                label: x[0],
                data: [Math.round(x[1] / 60)],
                backgroundColor: randomColor(sorted.length, i),
                categoryPercentage: 1.0
            }))
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    ticks: { color: "#ffffffff" },
                    grid: { color: "#7b7b7b76" }
                },
                x: {
                    ticks: { display: false },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: {
                    labels: { color: "#ffffffff" },
                    display: true,
                    position: 'bottom',
                    align: 'center',
                }
            }
        }
    });
}


let avgWebsiteChartInstance = null;
/**
 * Renders bar chart showing average daily minutes per website.
 *
 * @param {object} averages - website → avg minutes/day
 */
function renderAvgWebsiteBar(averages) {
    const ctx = document.getElementById("avgWebsiteChart");
    if (avgWebsiteChartInstance) avgWebsiteChartInstance.destroy();

    const labels = Object.keys(averages);
    const values = Object.values(averages);

    avgWebsiteChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Avg. usage time:"],
            datasets: values.map((x, i) => ({
                label: labels[i],
                data: [x],
                backgroundColor: randomColor(values.length, i),
                categoryPercentage: 1.0
            }))
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    ticks: { display: false },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: "#ffffffff" },
                    grid: { color: "#7b7b7b76" }
                }
            },
            plugins: {
                legend: {
                    labels: { color: "#ffffffff" },
                    display: true,
                    position: 'bottom',
                    align: 'center',
                }
            }
        }
    });
}
