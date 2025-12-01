// Reference to the table body that displays tracked website usage data
const table = document.querySelector("#usage-table tbody");

/**
 * Converts a duration from seconds into a formatted string (H M S).
 *
 * @param {number} totalSeconds - Total time in seconds.
 * @returns {string} - Formatted time string.
 *                     Example: "1H 12M 5S"
 */
function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours}H ${mins}M ${secs}S`;
}

/**
 * Reads today's stored usage data from Chrome storage
 * and updates the usage table UI.
 *
 * - Fetches daily data based on DD-MM-YYYY key.
 * - Displays "No data" message if empty.
 * - Sorts entries by highest tracked time.
 * - Appends results to the table.
 */
async function updateTable() {
  const today = new Date();
  const dateKey = today.toLocaleDateString("en-GB").replace(/\//g, "-");

  // Retrieve stored data array for today or default to empty list
  const data = (await chrome.storage.local.get(dateKey))[dateKey] || [];

  // Reset table content and insert header row
  table.innerHTML = `<tr><th>Website</th><th>Time spent</th></tr>`;

  // If no data stored today, show placeholder message
  if (data.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="2">No data recorded today</td>`;
    table.appendChild(row);
    return;
  }

  // Sort by time descending so highest usage appears first
  data.sort((a, b) => b.time - a.time);

  // Insert each recorded entry into the table
  data.forEach(({ website, time }) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${website}</td><td>${formatTime(time)}</td>`;
    table.appendChild(row);
  });
}

// Render table when script loads
updateTable();
