require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

const app = express();
const PORT = 5500;

// ===================== MIDDLEWARE =====================
app.use(cors({
    origin: 'http://localhost:5500',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// CSP headers - only for HTML pages
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/' || req.path.includes('dashboard')) {
        res.setHeader('Content-Security-Policy', 
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' http://localhost:5500 https://api.groq.com; " +
            "font-src 'self' https: data:;"
        );
    }
    next();
});

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ===================== DATA PATHS =====================
const dataDir = path.join(__dirname, 'data');
const ordersPath = path.join(dataDir, 'orders.json');
const feedbackPath = path.join(dataDir, 'feedback.json');
const summaryPath = path.join(dataDir, 'analytics_summary.json');
const weeklyPath = path.join(dataDir, 'weekly_insights.json');
const reportPath = path.join(dataDir, 'restaurant_analytics_report.html');
const analyticsScript = path.join(__dirname, 'analytics.py');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`✅ Created data directory: ${dataDir}`);
}

// ===================== HELPER FUNCTIONS =====================
function readOrders() {
    try {
        if (!fs.existsSync(ordersPath)) {
            console.log(`📁 Orders file not found, creating: ${ordersPath}`);
            fs.writeFileSync(ordersPath, JSON.stringify([], null, 2));
            return [];
        }
        
        const data = fs.readFileSync(ordersPath, 'utf8');
        return data.trim() ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading orders:', error);
        return [];
    }
}

function writeOrders(orders) {
    try {
        fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
        console.log(`✅ Saved ${orders.length} orders to database`);
        return true;
    } catch (error) {
        console.error('Error writing orders:', error);
        return false;
    }
}

function readFeedback() {
    try {
        if (!fs.existsSync(feedbackPath)) {
            console.log(`📁 Feedback file not found, creating: ${feedbackPath}`);
            fs.writeFileSync(feedbackPath, JSON.stringify([], null, 2));
            return [];
        }
        
        const data = fs.readFileSync(feedbackPath, 'utf8');
        return data.trim() ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error reading feedback:', error);
        return [];
    }
}

function writeFeedback(feedbackArray) {
    try {
        fs.writeFileSync(feedbackPath, JSON.stringify(feedbackArray, null, 2));
        console.log(`✅ Saved ${feedbackArray.length} feedback entries`);
        return true;
    } catch (error) {
        console.error('Error writing feedback:', error);
        return false;
    }
}

// ===================== INIT FILES =====================
function initFiles() {
    if (!fs.existsSync(summaryPath)) {
        fs.writeFileSync(summaryPath, JSON.stringify({
            total_orders: 0,
            total_revenue: 0,
            average_order_value: 0,
            total_items_sold: 0,
            last_updated: new Date().toISOString(),
            message: 'Analytics not run yet'
        }, null, 2));
    }
    
    if (!fs.existsSync(weeklyPath)) {
        fs.writeFileSync(weeklyPath, JSON.stringify({
            message: 'Weekly insights not available',
            last_updated: new Date().toISOString()
        }, null, 2));
    }
    
    // Initialize feedback file if it doesn't exist
    if (!fs.existsSync(feedbackPath)) {
        fs.writeFileSync(feedbackPath, JSON.stringify([], null, 2));
        console.log(`✅ Created feedback file: ${feedbackPath}`);
    }
}
initFiles();

// ===================== ANALYTICS =====================
function runAnalytics() {
    console.log('📊 Running restaurant analytics...');
    
    // Read data
    const orders = readOrders();
    const feedback = readFeedback();
    
    if (feedback.length > 0) {
        console.log(`⭐ Found ${feedback.length} feedback entries`);
    }
    
    if (!fs.existsSync(analyticsScript)) {
        console.log('📈 Using basic analytics');
        
        let totalItemsSold = 0;
        orders.forEach(order => {
            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    totalItemsSold += item.quantity || 1;
                });
            }
        });
        
        const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);
        const totalOrders = orders.length;
        
        // Calculate feedback stats
        let feedbackStats = null;
        if (feedback.length > 0) {
            const totalRating = feedback.reduce((sum, f) => sum + f.rating, 0);
            const avgRating = totalRating / feedback.length;
            
            feedbackStats = {
                total_feedback: feedback.length,
                average_rating: parseFloat(avgRating.toFixed(2)),
                five_stars: feedback.filter(f => f.rating === 5).length,
                four_stars: feedback.filter(f => f.rating === 4).length,
                three_stars: feedback.filter(f => f.rating === 3).length,
                two_stars: feedback.filter(f => f.rating === 2).length,
                one_star: feedback.filter(f => f.rating === 1).length
            };
        }
        
        const summaryData = {
            total_orders: totalOrders,
            total_revenue: totalRevenue,
            average_order_value: totalOrders > 0 ? totalRevenue / totalOrders : 0,
            total_items_sold: totalItemsSold,
            feedback_stats: feedbackStats,
            last_updated: new Date().toISOString(),
            message: 'Basic analytics with feedback'
        };
        
        fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
        console.log('✅ Basic analytics completed');
        return;
    }
    
    exec(`python "${analyticsScript}"`, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }, 
        (error, stdout) => {
            if (error) {
                console.log('❌ Python analytics failed');
            } else if (stdout) {
                console.log('✅ Analytics completed');
            }
        }
    );
}

setTimeout(runAnalytics, 2000);

// ===================== ROUTES =====================

// Health check
app.get('/api/health', (req, res) => {
    const orders = readOrders();
    const feedback = readFeedback();
    
    res.json({
        status: "OK",
        server: "SmartBit Restaurant",
        port: PORT,
        timestamp: new Date().toISOString(),
        stats: {
            orders: orders.length,
            feedback: feedback.length
        },
        endpoints: [
            '/api/health',
            '/api/orders',
            '/api/feedback',
            '/api/feedback/stats',
            '/api/feedback/order/:billNo',
            '/api/stats',
            '/api/analytics/summary',
            '/api/analytics/weekly',
            '/api/analytics/report',
            '/api/analytics/run',
            '/api/chat'
        ]
    });
});

// ===================== ORDERS ROUTES =====================
app.get('/api/orders', (req, res) => {
    res.json(readOrders());
});

app.post('/api/orders', (req, res) => {
    try {
        const orders = readOrders();
        const newOrder = req.body;
        
        newOrder.billNo = 'SB' + Date.now();
        newOrder.date = new Date().toLocaleString();
        if (!Array.isArray(newOrder.items)) newOrder.items = [];
        newOrder.total = newOrder.items.reduce((sum, item) => 
            sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1), 0);
        
        orders.push(newOrder);
        writeOrders(orders);
        setTimeout(runAnalytics, 1000);
        
        res.json({ 
            success: true,
            message: "Order saved successfully", 
            order: newOrder 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: "Failed to save order" 
        });
    }
});

// ===================== FEEDBACK ROUTES =====================

// Save feedback
app.post('/api/feedback', (req, res) => {
    try {
        console.log('📝 Received feedback request:', req.body);
        
        const { userName, tableNo, billNo, rating, feedback } = req.body;
        
        // Validation
        if (!userName || !tableNo || !billNo || !rating || !feedback) {
            return res.status(400).json({ 
                success: false,
                error: "All fields are required",
                received: req.body 
            });
        }
        
        // Validate rating
        const ratingNum = parseInt(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ 
                success: false,
                error: "Rating must be between 1 and 5" 
            });
        }
        
        // Validate feedback length
        if (feedback.length < 10) {
            return res.status(400).json({ 
                success: false,
                error: "Feedback must be at least 10 characters long" 
            });
        }
        
        // Read existing feedback
        const feedbackArray = readFeedback();
        
        // Create feedback object
        const feedbackEntry = {
            id: 'FB' + Date.now(),
            userName: userName,
            tableNo: tableNo,
            billNo: billNo,
            rating: ratingNum,
            feedback: feedback,
            date: new Date().toLocaleString(),
            timestamp: new Date().toISOString()
        };
        
        // Add to array
        feedbackArray.push(feedbackEntry);
        
        // Save to file
        const saved = writeFeedback(feedbackArray);
        
        if (saved) {
            console.log(`✅ Feedback saved successfully: ${feedbackEntry.id}`);
            
            // Also update the corresponding order with feedback ID
            const orders = readOrders();
            const orderIndex = orders.findIndex(order => order.billNo === billNo);
            
            if (orderIndex !== -1) {
                if (!orders[orderIndex].feedback) {
                    orders[orderIndex].feedback = [];
                }
                orders[orderIndex].feedback.push({
                    feedbackId: feedbackEntry.id,
                    rating: ratingNum,
                    date: feedbackEntry.date
                });
                writeOrders(orders);
                console.log(`✅ Linked feedback to order: ${billNo}`);
            }
            
            // Run analytics to update feedback stats
            setTimeout(runAnalytics, 500);
            
            res.json({ 
                success: true,
                message: "Feedback saved successfully", 
                feedback: feedbackEntry,
                feedbackId: feedbackEntry.id
            });
        } else {
            res.status(500).json({ 
                success: false,
                error: "Failed to save feedback" 
            });
        }
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ 
            success: false,
            error: "Server error",
            details: error.message 
        });
    }
});

// Get all feedback
app.get('/api/feedback', (req, res) => {
    try {
        const feedback = readFeedback();
        
        // Sort by most recent first
        feedback.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({ 
            success: true,
            count: feedback.length,
            feedback: feedback 
        });
    } catch (error) {
        console.error('Error reading feedback:', error);
        res.status(500).json({ 
            success: false,
            error: "Failed to read feedback" 
        });
    }
});

// Get feedback statistics
app.get('/api/feedback/stats', (req, res) => {
    try {
        const feedback = readFeedback();
        
        if (feedback.length === 0) {
            return res.json({
                success: true,
                stats: {
                    total_feedback: 0,
                    average_rating: 0,
                    five_stars: 0,
                    four_stars: 0,
                    three_stars: 0,
                    two_stars: 0,
                    one_star: 0,
                    last_updated: new Date().toISOString(),
                    message: 'No feedback data available'
                }
            });
        }
        
        // Calculate statistics
        const total = feedback.length;
        const totalRating = feedback.reduce((sum, item) => sum + item.rating, 0);
        const averageRating = totalRating / total;
        
        const stats = {
            total_feedback: total,
            average_rating: parseFloat(averageRating.toFixed(2)),
            five_stars: feedback.filter(f => f.rating === 5).length,
            four_stars: feedback.filter(f => f.rating === 4).length,
            three_stars: feedback.filter(f => f.rating === 3).length,
            two_stars: feedback.filter(f => f.rating === 2).length,
            one_star: feedback.filter(f => f.rating === 1).length,
            last_updated: new Date().toISOString(),
            message: 'Feedback statistics generated'
        };
        
        res.json({ 
            success: true,
            stats: stats 
        });
    } catch (error) {
        console.error('Error calculating feedback stats:', error);
        res.status(500).json({ 
            success: false,
            error: "Failed to calculate statistics" 
        });
    }
});

// Get feedback for a specific order
app.get('/api/feedback/order/:billNo', (req, res) => {
    try {
        const { billNo } = req.params;
        const feedback = readFeedback();
        
        const orderFeedback = feedback.filter(f => f.billNo === billNo);
        
        res.json({ 
            success: true,
            count: orderFeedback.length,
            feedback: orderFeedback 
        });
    } catch (error) {
        console.error('Error getting order feedback:', error);
        res.status(500).json({ 
            success: false,
            error: "Failed to get order feedback" 
        });
    }
});

// ===================== STATS ROUTES =====================
app.get('/api/stats', (req, res) => {
    const orders = readOrders();
    const stats = {};
    
    orders.forEach(order => {
        if (Array.isArray(order.items)) {
            order.items.forEach(item => {
                if (item && item.name) {
                    const itemName = item.name.trim();
                    stats[itemName] = (stats[itemName] || 0) + (parseInt(item.quantity) || 1);
                }
            });
        }
    });
    
    res.json(stats);
});

// ===================== ANALYTICS ROUTES =====================

// Analytics summary
app.get('/api/analytics/summary', (req, res) => {
    if (fs.existsSync(summaryPath)) {
        res.json(JSON.parse(fs.readFileSync(summaryPath, 'utf8')));
    } else {
        res.json({ 
            message: 'Analytics summary not available',
            last_updated: new Date().toISOString()
        });
    }
});

// Weekly insights
app.get('/api/analytics/weekly', (req, res) => {
    if (fs.existsSync(weeklyPath)) {
        res.json(JSON.parse(fs.readFileSync(weeklyPath, 'utf8')));
    } else {
        res.json({ 
            message: 'Weekly insights not available',
            last_updated: new Date().toISOString()
        });
    }
});

// Analytics report
app.get('/api/analytics/report', (req, res) => {
    try {
        if (fs.existsSync(reportPath)) {
            console.log('📄 Serving existing analytics report');
            res.sendFile(reportPath);
        } else {
            // Generate a comprehensive report on the fly
            const orders = readOrders();
            const feedback = readFeedback();
            const summary = fs.existsSync(summaryPath) 
                ? JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
                : { 
                    total_orders: 0, 
                    total_revenue: 0, 
                    average_order_value: 0, 
                    total_items_sold: 0,
                    feedback_stats: null
                };
            
            // Helper function to format items
            const formatItems = (items) => {
                if (!Array.isArray(items)) return 'No items';
                return items.map(item => `${item.name} (${item.quantity || 1}x)`).join(', ');
            };
            
            // Generate table rows for orders
            let tableRows = '';
            if (orders.length > 0) {
                // Show last 10 orders, newest first
                const recentOrders = orders.slice(-10).reverse();
                tableRows = recentOrders.map(order => `
                    <tr>
                        <td><strong>${order.billNo || 'N/A'}</strong></td>
                        <td>${order.tableNo || '-'}</td>
                        <td>${order.userName || 'Guest'}</td>
                        <td>${formatItems(order.items)}</td>
                        <td><strong>₹${order.total || 0}</strong></td>
                        <td>${order.date || ''}</td>
                        <td>${order.paymentMode || 'Cash'}</td>
                        <td>${order.feedback ? `${order.feedback.length} feedback` : '-'}</td>
                    </tr>
                `).join('');
            } else {
                tableRows = '<tr><td colspan="8" style="text-align: center; padding: 40px;">No orders yet</td></tr>';
            }
            
            // Generate feedback rows
            let feedbackRows = '';
            if (feedback.length > 0) {
                const recentFeedback = feedback.slice(-5).reverse();
                feedbackRows = recentFeedback.map(f => `
                    <tr>
                        <td>${f.id || 'N/A'}</td>
                        <td>${f.userName || 'Guest'}</td>
                        <td>${f.billNo || '-'}</td>
                        <td>
                            ${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}
                            <br><small>${f.rating}/5</small>
                        </td>
                        <td style="max-width: 300px;">${f.feedback || 'No comment'}</td>
                        <td>${f.date || '-'}</td>
                    </tr>
                `).join('');
            } else {
                feedbackRows = '<tr><td colspan="6" style="text-align: center; padding: 40px;">No feedback received yet</td></tr>';
            }
            
            // Calculate feedback stats for display
            let feedbackStatsHTML = '';
            if (summary.feedback_stats) {
                const fs = summary.feedback_stats;
                feedbackStatsHTML = `
                <h2>⭐ Customer Feedback Summary</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Feedback</div>
                        <div class="stat-value">${fs.total_feedback}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Average Rating</div>
                        <div class="stat-value">${fs.average_rating}/5</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">5-Star Ratings</div>
                        <div class="stat-value">${fs.five_stars}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Customer Satisfaction</div>
                        <div class="stat-value">${((fs.five_stars + fs.four_stars) / fs.total_feedback * 100).toFixed(1)}%</div>
                    </div>
                </div>
                `;
            }
            
            const htmlReport = `
<!DOCTYPE html>
<html>
<head>
    <title>SmartBit Analytics Report</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 40px; 
            background: #f5f7ff;
            color: #333;
        }
        .header { 
            background: linear-gradient(45deg, #405de6, #833ab4); 
            color: white; 
            padding: 40px; 
            border-radius: 20px; 
            margin-bottom: 40px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }
        .header h1 { margin: 0; font-size: 2.5rem; }
        .header p { margin: 10px 0 0; opacity: 0.9; }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 25px; 
            margin: 40px 0; 
        }
        .stat-card { 
            background: white; 
            padding: 30px; 
            border-radius: 15px; 
            box-shadow: 0 5px 20px rgba(0,0,0,0.1); 
            text-align: center; 
            border: 2px solid #f0f0f0;
            transition: all 0.3s;
        }
        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 35px rgba(0,0,0,0.15);
        }
        .stat-value { 
            font-size: 2.5rem; 
            font-weight: bold; 
            color: #405de6; 
            margin: 15px 0; 
        }
        .stat-label { 
            color: #666; 
            font-size: 1rem; 
            text-transform: uppercase; 
            letter-spacing: 1px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 40px 0; 
            background: white; 
            border-radius: 15px; 
            overflow: hidden; 
            box-shadow: 0 5px 20px rgba(0,0,0,0.1);
        }
        th, td { 
            border: 1px solid #eee; 
            padding: 20px; 
            text-align: left; 
        }
        th { 
            background: #f8f9fa; 
            font-weight: 600; 
            color: #405de6;
            font-size: 1.1rem;
        }
        tr:nth-child(even) { background: #f9f9f9; }
        tr:hover { background: #f0f2ff; }
        .section-title {
            color: #405de6;
            margin: 50px 0 25px;
            padding-bottom: 15px;
            border-bottom: 3px solid #833ab4;
        }
        .feedback-rating {
            color: #ffd700;
            font-size: 1.2rem;
        }
        .footer { 
            text-align: center; 
            margin-top: 60px; 
            padding-top: 30px; 
            border-top: 2px solid #ddd; 
            color: #666; 
            font-size: 0.9rem;
        }
        @media print {
            body { margin: 0; }
            .header { border-radius: 0; }
            .stat-card { box-shadow: none; border: 1px solid #ddd; }
            table { box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 SmartBit Restaurant Analytics Report</h1>
        <p>Comprehensive business intelligence report - Generated on: ${new Date().toLocaleString()}</p>
        <p>Data Range: ${orders.length} orders, ${feedback.length} feedback entries</p>
    </div>
    
    <h2 class="section-title">📈 Key Performance Indicators</h2>
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">Total Orders</div>
            <div class="stat-value">${summary.total_orders || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Revenue</div>
            <div class="stat-value">₹${summary.total_revenue || 0}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Avg Order Value</div>
            <div class="stat-value">₹${summary.average_order_value ? summary.average_order_value.toFixed(2) : '0.00'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Items Sold</div>
            <div class="stat-value">${summary.total_items_sold || 0}</div>
        </div>
    </div>
    
    ${feedbackStatsHTML}
    
    <h2 class="section-title">📋 Recent Orders (${orders.length} total)</h2>
    <table>
        <thead>
            <tr>
                <th>Bill No</th>
                <th>Table</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Date</th>
                <th>Payment</th>
                <th>Feedback</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>
    
    <h2 class="section-title">⭐ Recent Customer Feedback</h2>
    <table>
        <thead>
            <tr>
                <th>Feedback ID</th>
                <th>Customer</th>
                <th>Bill No</th>
                <th>Rating</th>
                <th>Comments</th>
                <th>Date</th>
            </tr>
        </thead>
        <tbody>
            ${feedbackRows}
        </tbody>
    </table>
    
    <div class="footer">
        <p>Report generated automatically by SmartBit Restaurant Analytics System</p>
        <p>For more detailed analytics, visit the dashboard at: http://localhost:${PORT}/owner-dashboard.html</p>
        <p>Feedback admin: http://localhost:${PORT}/feedback-admin.html</p>
    </div>
    
    <script>
        // Auto-print on page load (optional)
        window.onload = function() {
            // Uncomment to auto-print
            // window.print();
        };
    </script>
</body>
</html>`;
            
            res.setHeader('Content-Type', 'text/html');
            res.send(htmlReport);
        }
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ 
            error: 'Failed to generate report',
            details: error.message 
        });
    }
});

// Run analytics manually
app.post('/api/analytics/run', (req, res) => {
    runAnalytics();
    res.json({ 
        success: true, 
        message: 'Analytics started successfully',
        timestamp: new Date().toISOString()
    });
});

// ===================== CHAT ROUTE =====================
app.post('/api/chat', async (req, res) => {
    const userMessage = req.body.message;
    
    if (!userMessage) {
        return res.json({ reply: "Please enter a message" });
    }
    
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama-3.1-8b-instant",
                messages: [
                    { 
                        role: "system", 
                        content: `You are SmartBit Restaurant AI assistant. 
                        The restaurant has received ${readOrders().length} orders 
                        and ${readFeedback().length} feedback entries. 
                        Be helpful, friendly, and provide accurate information.` 
                    },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 200,
                temperature: 0.7
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );
        
        res.json({ reply: response.data.choices[0].message.content });
    } catch (error) {
        console.error('Chat error:', error);
        res.json({ 
            reply: "I'm currently unavailable. For feedback or orders, please use the restaurant system directly." 
        });
    }
});

// ===================== MAIN PAGES =====================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/owner-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/owner-dashboard.html'));
});

app.get('/feedback-admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/feedback-admin.html'));
});

app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// ===================== 404 HANDLER =====================
app.use('/api/*', (req, res) => {
    res.status(404).json({ 
        success: false,
        error: 'API endpoint not found',
        path: req.originalUrl,
        available_endpoints: [
            '/api/health',
            '/api/orders',
            '/api/feedback',
            '/api/feedback/stats',
            '/api/feedback/order/:billNo',
            '/api/stats',
            '/api/analytics/summary',
            '/api/analytics/weekly',
            '/api/analytics/report',
            '/api/analytics/run',
            '/api/chat'
        ]
    });
});

// ===================== START SERVER =====================
app.listen(PORT, () => {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 SMARTBITE RESTAURANT SYSTEM');
    console.log('='.repeat(70));
    console.log(`🌐 Main Restaurant: http://localhost:${PORT}`);
    /*console.log(`📊 Owner Dashboard: http://localhost:${PORT}/owner-dashboard.html`);
    console.log(`⭐ Feedback Admin: http://localhost:${PORT}/feedback-admin.html`);
    console.log(`🔑 Login Page: http://localhost:${PORT}/login.html`);*/
    console.log('─'.repeat(70));
   /* console.log(`📈 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Order Stats: http://localhost:${PORT}/api/stats`);
    console.log(`⭐ Feedback Stats: http://localhost:${PORT}/api/feedback/stats`);
    console.log(`📄 Analytics Report: http://localhost:${PORT}/api/analytics/report`);*/
    console.log('─'.repeat(70));
    
    const orders = readOrders();
    const feedback = readFeedback();
    console.log(`📁 Orders in database: ${orders.length}`);
    console.log(`⭐ Customer feedback: ${feedback.length}`);
    
    if (feedback.length > 0) {
        const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
        console.log(`⭐ Average rating: ${avgRating.toFixed(2)}/5`);
    }
    
    console.log('='.repeat(70) + '\n');
});