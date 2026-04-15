let activeCharts = {};

document.addEventListener('DOMContentLoaded', () => {
    const pChart = document.getElementById('productsChart');
    if (!pChart) return;
    
    fetchDashboardData();
    fetchAlerts();
});

// Update chart themes immediately when toggled
window.updateChartColors = () => {
    fetchDashboardData(); // Redraws all charts with new theme colors appropriately
}

function getGridColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
}

function getTextColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? '#8b949e' : '#64748B';
}

async function fetchDashboardData() {
    try {
        const res = await fetch('/api/dashboard_data');
        const data = await res.json();

        const top3 = data.products_sold.slice(0, 3).map((p, i) => `🔥 ${p.name}`).join('\n');
        const topProductEl = document.getElementById('top-product');
        topProductEl.style.fontSize = '24px'; // Slightly smaller font to fit multiple items
        topProductEl.style.whiteSpace = 'pre-line';
        topProductEl.innerText = top3 || 'None';

        const gridColor = getGridColor();
        const textColor = getTextColor();
        const fontFam = "'Space Grotesk', sans-serif";

        Chart.defaults.color = textColor;
        Chart.defaults.font.family = fontFam;

        // Destroy existing
        if(activeCharts.bar) activeCharts.bar.destroy();
        if(activeCharts.line) activeCharts.line.destroy();
        if(activeCharts.radar) activeCharts.radar.destroy();

        /* BAR CHART (Products Sold) */
        const barCtx = document.getElementById('productsChart').getContext('2d');
        const pNames = data.products_sold.map(p => p.name);
        const pQtys = data.products_sold.map(p => p.qty);

        // Create Gradient
        let barGradient = barCtx.createLinearGradient(0, 0, 0, 400);
        barGradient.addColorStop(0, '#8B5CF6'); // Purple
        barGradient.addColorStop(1, '#F472B6'); // Pink

        activeCharts.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: pNames.length ? pNames : ['No Data'],
                datasets: [{
                    label: 'Quantity Sold',
                    data: pQtys.length ? pQtys : [0],
                    backgroundColor: barGradient,
                    borderRadius: 8,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: gridColor, drawBorder: false } },
                    y: { grid: { color: gridColor, drawBorder: false } }
                }
            }
        });

        /* LINE CHART (Revenue) */
        const lineCtx = document.getElementById('revenueChart').getContext('2d');
        const rDates = data.daily_revenue.map(r => r.date);
        const rTotals = data.daily_revenue.map(r => r.total);
        
        let lineGradient = lineCtx.createLinearGradient(0, 0, 0, 400);
        lineGradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
        lineGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

        activeCharts.line = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: rDates.length ? rDates : ['No Data'],
                datasets: [{
                    label: 'Revenue (₹)',
                    data: rTotals.length ? rTotals : [0],
                    borderColor: '#10B981',
                    backgroundColor: lineGradient,
                    borderWidth: 4,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#10B981',
                    pointBorderColor: '#fff',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: gridColor, drawBorder: false } },
                    y: { grid: { color: gridColor, drawBorder: false }, beginAtZero: true }
                }
            }
        });

        /* RADAR CHART (Sales Velocity) */
        const velocityCtx = document.getElementById('velocityChart').getContext('2d');
        const vNames = data.velocity_data.map(p => p.name);
        const vScores = data.velocity_data.map(p => p.velocity);

        activeCharts.radar = new Chart(velocityCtx, {
            type: 'polarArea',
            data: {
                labels: vNames.length ? vNames : ['No Data'],
                datasets: [{
                    label: 'Items sold per day',
                    data: vScores.length ? vScores : [0],
                    backgroundColor: [
                        'rgba(244, 114, 182, 0.6)', // Pink
                        'rgba(139, 92, 246, 0.6)', // Purple
                        'rgba(59, 130, 246, 0.6)', // Blue
                        'rgba(16, 185, 129, 0.6)', // Green
                        'rgba(245, 158, 11, 0.6)'  // Yellow
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    r: {
                        ticks: { display: false },
                        grid: { color: gridColor }
                    }
                },
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });

    } catch (e) {
        console.error("Failed to load dashboard charts", e);
    }
}

async function fetchAlerts() {
    const list = document.getElementById('alerts-container');
    if(!list) return;

    list.innerHTML = '';
    try {
        const res = await fetch('/api/alerts');
        const data = await res.json();

        if (data.alerts.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted);">No active alerts. All good!</p>';
            return;
        }

        data.alerts.forEach((alert, i) => {
            const div = document.createElement('div');
            // Adding a stagger animation specifically for alerts
            div.style.animation = `slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) ${i * 0.1}s backwards`;
            div.className = `alert-item status-${alert.severity === 'danger' ? 'out' : alert.severity === 'warning' ? 'low' : 'good'}`;
            div.style.padding = '12px';
            div.style.marginBottom = '10px';
            div.innerHTML = `<strong>${alert.type.replace(/_/g, ' ')}:</strong> ${alert.message}`;
            list.appendChild(div);
        });
    } catch (e) {
        list.innerHTML = '<p style="color: red;">Failed to load alerts.</p>';
    }
}
