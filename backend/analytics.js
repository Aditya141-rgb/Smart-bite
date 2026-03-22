const fs = require('fs');
const path = require('path');

class RestaurantAnalytics {
    constructor(jsonFile = null) {
        const currentDir = __dirname;
        
        if (jsonFile === null) {
            jsonFile = path.join(currentDir, 'data', 'orders.json');
        }
        
        this.jsonFile = jsonFile;
        this.outputDir = path.join(currentDir, 'data');
        this.data = this.loadData();
        this.df = this.processData();
    }
    
    loadData() {
        try {
            if (!fs.existsSync(this.jsonFile)) {
                console.log("[INFO] Data file not found, using empty dataset");
                return [];
            }
            
            const fileContent = fs.readFileSync(this.jsonFile, 'utf-8');
            const data = JSON.parse(fileContent);
            
            console.log(`[INFO] Loaded ${data.length} orders`);
            return data;
        } catch (error) {
            console.log(`[ERROR] Error loading data: ${error.message}`);
            return [];
        }
    }
    
    processData() {
        if (!this.data || this.data.length === 0) {
            return [];
        }
        
        const records = [];
        
        for (const order of this.data) {
            const items = order.items || [];
            
            for (const item of items) {
                let dateObj = new Date();
                
                try {
                    const dateStr = order.date || '';
                    if (dateStr) {
                        // Try parsing different date formats
                        let parsedDate;
                        
                        // Check if it's DD/MM/YYYY, HH:MM:SS AM/PM format
                        if (dateStr.match(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2} [AP]M/)) {
                            const [datePart, timePart] = dateStr.split(', ');
                            const [day, month, year] = datePart.split('/');
                            const timeWithPeriod = timePart;
                            const [time, period] = [timeWithPeriod.slice(0, -3), timeWithPeriod.slice(-2)];
                            const [hours, minutes, seconds] = time.split(':');
                            
                            let hour = parseInt(hours);
                            if (period === 'PM' && hour !== 12) hour += 12;
                            if (period === 'AM' && hour === 12) hour = 0;
                            
                            parsedDate = new Date(year, month - 1, day, hour, parseInt(minutes), parseInt(seconds));
                        } 
                        // Check if it's YYYY-MM-DD HH:MM:SS format
                        else if (dateStr.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
                            parsedDate = new Date(dateStr.replace(' ', 'T'));
                        }
                        
                        if (parsedDate && !isNaN(parsedDate.getTime())) {
                            dateObj = parsedDate;
                        }
                    }
                } catch (error) {
                    // Use current date if parsing fails
                    dateObj = new Date();
                }
                
                records.push({
                    bill_no: order.billNo || '',
                    table_no: order.tableNo || '',
                    customer: order.userName || 'Guest',
                    item_name: (item.name || '').toString().trim().replace(/\b\w/g, l => l.toUpperCase()),
                    item_price: parseFloat(item.price || 0),
                    quantity: parseInt(item.quantity || 1),
                    item_total: parseFloat(item.totalPrice || 0),
                    order_total: parseFloat(order.total || 0),
                    payment_mode: order.paymentMode || 'Cash',
                    date: dateObj
                });
            }
        }
        
        if (records.length === 0) {
            return [];
        }
        
        // Add derived columns
        const df = records.map(record => ({
            ...record,
            day: record.date.toISOString().split('T')[0],
            hour: record.date.getHours(),
            day_of_week: this.getDayName(record.date.getDay()),
            week_number: this.getWeekNumber(record.date),
            month: record.date.getMonth() + 1,
            year: record.date.getFullYear()
        }));
        
        return df;
    }
    
    getDayName(dayIndex) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayIndex];
    }
    
    getWeekNumber(date) {
        const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
        const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
        return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    }
    
    generateSummary() {
        if (this.df.length === 0) {
            return {
                total_orders: 0,
                total_revenue: 0,
                average_order_value: 0,
                total_items_sold: 0,
                unique_items: 0,
                last_updated: new Date().toISOString(),
                message: 'No data available for analytics'
            };
        }
        
        // Get unique orders (by bill number)
        const uniqueOrdersMap = new Map();
        for (const record of this.df) {
            if (!uniqueOrdersMap.has(record.bill_no)) {
                uniqueOrdersMap.set(record.bill_no, record.order_total);
            }
        }
        
        const uniqueOrders = Array.from(uniqueOrdersMap.values());
        const totalOrders = uniqueOrders.length;
        const totalRevenue = uniqueOrders.reduce((sum, val) => sum + val, 0);
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const totalItemsSold = this.df.reduce((sum, record) => sum + record.quantity, 0);
        
        // Unique items
        const uniqueItemsSet = new Set(this.df.map(record => record.item_name));
        const uniqueItems = uniqueItemsSet.size;
        
        // Top item analysis
        const itemStats = new Map();
        for (const record of this.df) {
            if (!itemStats.has(record.item_name)) {
                itemStats.set(record.item_name, { quantity: 0, total: 0 });
            }
            const stats = itemStats.get(record.item_name);
            stats.quantity += record.quantity;
            stats.total += record.item_total;
        }
        
        let topItem = null;
        let topItemRevenue = 0;
        let maxRevenue = -1;
        
        for (const [itemName, stats] of itemStats.entries()) {
            if (stats.total > maxRevenue) {
                maxRevenue = stats.total;
                topItem = itemName;
                topItemRevenue = totalRevenue > 0 ? (stats.total / totalRevenue) * 100 : 0;
            }
        }
        
        // Time-based analysis
        const currentDate = new Date();
        const lastWeekDate = new Date(currentDate);
        lastWeekDate.setDate(currentDate.getDate() - 7);
        
        const previousWeekStart = new Date(lastWeekDate);
        previousWeekStart.setDate(lastWeekDate.getDate() - 7);
        
        let currentWeekRevenue = 0;
        let previousWeekRevenue = 0;
        
        // Current week data
        const currentWeekOrders = new Set();
        for (const record of this.df) {
            if (record.date >= lastWeekDate) {
                if (!currentWeekOrders.has(record.bill_no)) {
                    currentWeekRevenue += record.order_total;
                    currentWeekOrders.add(record.bill_no);
                }
            }
        }
        
        // Previous week data
        const previousWeekOrders = new Set();
        for (const record of this.df) {
            if (record.date >= previousWeekStart && record.date < lastWeekDate) {
                if (!previousWeekOrders.has(record.bill_no)) {
                    previousWeekRevenue += record.order_total;
                    previousWeekOrders.add(record.bill_no);
                }
            }
        }
        
        let revenueGrowth = 0;
        if (previousWeekRevenue > 0) {
            revenueGrowth = ((currentWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100;
        }
        
        // Peak hour analysis
        const hourlySales = new Map();
        for (const record of this.df) {
            hourlySales.set(record.hour, (hourlySales.get(record.hour) || 0) + record.order_total);
        }
        
        let peakHour = null;
        let maxHourlySales = -1;
        for (const [hour, sales] of hourlySales.entries()) {
            if (sales > maxHourlySales) {
                maxHourlySales = sales;
                peakHour = hour;
            }
        }
        
        // Data range
        const dates = this.df.map(record => record.date);
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const daysDiff = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
        
        return {
            total_orders: totalOrders,
            total_revenue: parseFloat(totalRevenue.toFixed(2)),
            average_order_value: parseFloat(avgOrderValue.toFixed(2)),
            total_items_sold: totalItemsSold,
            unique_items: uniqueItems,
            top_item: topItem,
            top_item_revenue: parseFloat(topItemRevenue.toFixed(2)),
            current_week_revenue: parseFloat(currentWeekRevenue.toFixed(2)),
            revenue_growth: parseFloat(revenueGrowth.toFixed(2)),
            peak_hour: peakHour,
            last_updated: new Date().toISOString(),
            data_range: {
                start: minDate.toISOString().split('T')[0],
                end: maxDate.toISOString().split('T')[0],
                days: daysDiff
            }
        };
    }
    
    generateWeeklyInsights() {
        if (this.df.length === 0) {
            return {
                message: 'No data available for weekly insights',
                last_updated: new Date().toISOString()
            };
        }
        
        const currentDate = new Date();
        const currentWeek = this.getWeekNumber(currentDate);
        let previousWeek = currentWeek - 1;
        if (previousWeek < 1) previousWeek = 52;
        
        // Current week data
        const currentWeekData = this.df.filter(record => record.week_number === currentWeek);
        const previousWeekData = this.df.filter(record => record.week_number === previousWeek);
        
        // Calculate metrics
        let currentWeekRevenue = 0;
        let previousWeekRevenue = 0;
        
        const currentWeekOrders = new Set();
        for (const record of currentWeekData) {
            if (!currentWeekOrders.has(record.bill_no)) {
                currentWeekRevenue += record.order_total;
                currentWeekOrders.add(record.bill_no);
            }
        }
        
        const previousWeekOrders = new Set();
        for (const record of previousWeekData) {
            if (!previousWeekOrders.has(record.bill_no)) {
                previousWeekRevenue += record.order_total;
                previousWeekOrders.add(record.bill_no);
            }
        }
        
        let growthPercent = 0;
        if (previousWeekRevenue > 0) {
            growthPercent = ((currentWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100;
        }
        
        // Best day and peak hour
        let bestDay = null;
        let peakHour = null;
        
        if (currentWeekData.length > 0) {
            const daySales = new Map();
            for (const record of currentWeekData) {
                daySales.set(record.day_of_week, (daySales.get(record.day_of_week) || 0) + record.order_total);
            }
            
            let maxDaySales = -1;
            for (const [day, sales] of daySales.entries()) {
                if (sales > maxDaySales) {
                    maxDaySales = sales;
                    bestDay = day;
                }
            }
            
            const hourSales = new Map();
            for (const record of currentWeekData) {
                hourSales.set(record.hour, (hourSales.get(record.hour) || 0) + record.order_total);
            }
            
            let maxHourSales = -1;
            for (const [hour, sales] of hourSales.entries()) {
                if (sales > maxHourSales) {
                    maxHourSales = sales;
                    peakHour = hour;
                }
            }
        }
        
        // Top items this week
        const itemStats = new Map();
        for (const record of currentWeekData) {
            if (!itemStats.has(record.item_name)) {
                itemStats.set(record.item_name, { quantity: 0, total: 0 });
            }
            const stats = itemStats.get(record.item_name);
            stats.quantity += record.quantity;
            stats.total += record.item_total;
        }
        
        const topItems = Array.from(itemStats.entries())
            .map(([name, stats]) => ({
                name: name,
                quantity: stats.quantity,
                revenue: parseFloat(stats.total.toFixed(2))
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
        
        return {
            current_week: currentWeek,
            current_week_revenue: parseFloat(currentWeekRevenue.toFixed(2)),
            previous_week_revenue: parseFloat(previousWeekRevenue.toFixed(2)),
            growth_percent: parseFloat(growthPercent.toFixed(2)),
            best_day: bestDay,
            peak_hour: peakHour,
            top_items: topItems,
            last_updated: new Date().toISOString()
        };
    }
}

function main() {
    console.log("=".repeat(60));
    console.log("STARTING RESTAURANT ANALYTICS");
    console.log("=".repeat(60));
    
    // Initialize analytics
    const analytics = new RestaurantAnalytics();
    
    // Generate summary
    const summary = analytics.generateSummary();
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(analytics.outputDir)) {
        fs.mkdirSync(analytics.outputDir, { recursive: true });
    }
    
    // Save summary to JSON file
    const summaryPath = path.join(analytics.outputDir, 'analytics_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
    console.log(`[SUCCESS] Saved summary to ${summaryPath}`);
    
    // Generate weekly insights
    const weeklyInsights = analytics.generateWeeklyInsights();
    const weeklyPath = path.join(analytics.outputDir, 'weekly_insights.json');
    fs.writeFileSync(weeklyPath, JSON.stringify(weeklyInsights, null, 2), 'utf-8');
    console.log(`[SUCCESS] Saved weekly insights to ${weeklyPath}`);
    
    // Print summary to console
    console.log("\n" + "=".repeat(60));
    console.log("ANALYTICS SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total Orders: ${summary.total_orders || 0}`);
    console.log(`Total Revenue: Rs.${(summary.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`Average Order Value: Rs.${(summary.average_order_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`Items Sold: ${summary.total_items_sold || 0}`);
    
    if (summary.top_item) {
        console.log(`Top Item: ${summary.top_item} (${summary.top_item_revenue || 0}% of revenue)`);
    }
    
    if (summary.data_range) {
        console.log(`Data Range: ${summary.data_range.start} to ${summary.data_range.end}`);
    }
    
    console.log("=".repeat(60));
    console.log("ANALYTICS COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
}

// Run main function if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = RestaurantAnalytics;