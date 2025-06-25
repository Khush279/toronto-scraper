// netlify/functions/scrape.js - IMPROVED VERSION
const axios = require('axios');
const cheerio = require('cheerio');

// More comprehensive list of URLs
const urls = [
    'https://www.stlawrencemarket.com/',
    'https://www.evergreen.ca/',
    'https://thewelcomemarket.ca/',
    'https://www.torontoartisan.com/',
    'https://artsmarket.ca/',
    'https://stacktmarket.com/',
    'https://www.menageriemarket.com/',
    'https://themommarketco.com/',
    'https://www.soraurenmarket.com/',
    'https://www.leslievillemarket.com/',
    'https://www.toronto.ca/business-economy/industry-sector-support/public-markets/public-markets-in-toronto/'
];

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        const allMarkets = [];
        
        for (const url of urls) {
            console.log(`Scraping: ${url}`);
            
            try {
                const response = await axios.get(url, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 15000
                });
                
                const $ = cheerio.load(response.text);
                let markets = [];
                
                // Site-specific scraping
                if (url.includes('toronto.ca')) {
                    markets = scrapeTorontoCA($, url);
                } else if (url.includes('stlawrencemarket.com')) {
                    markets = scrapeStLawrence($, url);
                } else if (url.includes('evergreen.ca')) {
                    markets = scrapeEvergreen($, url);
                } else if (url.includes('stacktmarket.com')) {
                    markets = scrapeStackt($, url);
                } else {
                    markets = scrapeGeneric($, url);
                }
                
                allMarkets.push(...markets);
                console.log(`Found ${markets.length} markets from ${url}`);
                
                // Delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.log(`Error scraping ${url}:`, error.message);
                continue;
            }
        }
        
        // Remove duplicates and clean data
        const cleanedMarkets = cleanAndDedupeMarkets(allMarkets);
        
        console.log(`Total unique markets found: ${cleanedMarkets.length}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                markets: cleanedMarkets,
                count: cleanedMarkets.length,
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Scraping error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};

function scrapeTorontoCA($, url) {
    const markets = [];
    
    // Look for tables with market information
    $('table tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
            const name = cleanText($(cells[0]).text());
            const details = cleanText($(cells[1]).text());
            
            if (name && name.length > 5 && !name.toLowerCase().includes('market name')) {
                markets.push({
                    name: name,
                    description: details,
                    location: extractLocation(details) || 'Toronto, ON',
                    dates: extractDates(details),
                    website: url,
                    vendor_info: 'Contact City of Toronto Parks & Recreation',
                    source_url: url,
                    category: 'Public Market'
                });
            }
        }
    });
    
    // Also look for list items
    $('li').each((i, item) => {
        const text = $(item).text();
        if (text.includes('Market') && text.length > 10 && text.length < 200) {
            const name = extractMarketName(text);
            if (name) {
                markets.push({
                    name: name,
                    description: text,
                    location: extractLocation(text) || 'Toronto, ON',
                    dates: extractDates(text),
                    website: url,
                    vendor_info: 'Contact City of Toronto',
                    source_url: url,
                    category: 'Public Market'
                });
            }
        }
    });
    
    return markets;
}

function scrapeStLawrence($, url) {
    const markets = [];
    
    // Look for specific market information
    markets.push({
        name: 'St. Lawrence Market South',
        description: 'Historic indoor market with vendors selling fresh produce, meats, baked goods, and specialty items.',
        location: '92-95 Front St E, Toronto, ON M5E 1C3',
        dates: 'Tuesday to Sunday, varies by season',
        website: url,
        vendor_info: 'Contact market office for vendor applications',
        source_url: url,
        category: 'Indoor Market'
    });
    
    markets.push({
        name: 'St. Lawrence Farmers Market',
        description: 'Saturday farmers market with local produce and artisan goods.',
        location: '92 Front St E, Toronto, ON',
        dates: 'Saturdays year-round',
        website: url,
        vendor_info: 'Apply through market management',
        source_url: url,
        category: 'Farmers Market'
    });
    
    // Look for any additional vendor or event info
    $('a').each((i, link) => {
        const href = $(link).attr('href');
        const text = $(link).text();
        if (text.toLowerCase().includes('vendor') || text.toLowerCase().includes('apply')) {
            // Update vendor info for existing markets
            markets.forEach(market => {
                if (market.vendor_info.includes('Contact market office')) {
                    market.vendor_info = href.startsWith('http') ? href : new URL(href, url).href;
                }
            });
        }
    });
    
    return markets;
}

function scrapeEvergreen($, url) {
    const markets = [];
    
    markets.push({
        name: 'Evergreen Brick Works Saturday Market',
        description: 'Weekly farmers market featuring local vendors, artisans, and food producers in a beautiful ravine setting.',
        location: '550 Bayview Ave, Toronto, ON M4W 3X8',
        dates: 'Saturdays year-round, 8am-1pm',
        website: url,
        vendor_info: 'Check Evergreen website for vendor applications',
        source_url: url,
        category: 'Farmers Market'
    });
    
    // Look for specific vendor application links
    $('a').each((i, link) => {
        const href = $(link).attr('href');
        const text = $(link).text().toLowerCase();
        if (text.includes('vendor') || text.includes('market') || text.includes('apply')) {
            const fullUrl = href && href.startsWith('http') ? href : (href ? new URL(href, url).href : '');
            if (fullUrl) {
                markets[0].vendor_info = fullUrl;
            }
        }
    });
    
    return markets;
}

function scrapeStackt($, url) {
    const markets = [];
    
    markets.push({
        name: 'STACKT Market',
        description: 'Pop-up retail experience with rotating vendors and events in shipping container format.',
        location: '28 Bathurst St, Toronto, ON M5V 2P1',
        dates: 'Various pop-up events throughout the year',
        website: url,
        vendor_info: 'Apply for pop-up opportunities through STACKT',
        source_url: url,
        category: 'Pop-up Market'
    });
    
    // Look for event listings
    $('.event, .market, article').each((i, elem) => {
        const title = $(elem).find('h1, h2, h3, h4').first().text();
        const description = $(elem).text();
        
        if (title && title.length > 5 && description.includes('vendor')) {
            markets.push({
                name: cleanText(title),
                description: cleanText(description).substring(0, 300),
                location: 'STACKT Market, 28 Bathurst St, Toronto',
                dates: extractDates(description),
                website: url,
                vendor_info: 'Contact STACKT for vendor opportunities',
                source_url: url,
                category: 'Pop-up Event'
            });
        }
    });
    
    return markets;
}

function scrapeGeneric($, url) {
    const markets = [];
    
    // Look for market-related content
    $('h1, h2, h3, h4').each((i, elem) => {
        if (i >= 10) return false; // Limit per site
        
        const title = cleanText($(elem).text());
        if (!isValidMarketName(title)) return;
        
        // Get context around the heading
        const context = getElementContext($(elem));
        
        // Find relevant links
        const links = findRelevantLinks($(elem), url);
        
        markets.push({
            name: title,
            description: context.substring(0, 300),
            location: extractLocation(context) || guessLocationFromUrl(url),
            dates: extractDates(context),
            website: links.website || url,
            vendor_info: links.vendorInfo || 'Contact organizer for vendor information',
            source_url: url,
            category: categorizeMarket(title, context)
        });
    });
    
    return markets;
}

function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
}

function isValidMarketName(name) {
    if (!name || name.length < 5 || name.length > 150) return false;
    
    const marketKeywords = ['market', 'bazaar', 'fair', 'festival', 'pop-up', 'vendor', 'artisan', 'craft', 'farmers'];
    const hasKeyword = marketKeywords.some(keyword => name.toLowerCase().includes(keyword));
    
    const excludeWords = ['about', 'contact', 'home', 'menu', 'search', 'login', 'copyright'];
    const hasExclude = excludeWords.some(word => name.toLowerCase().includes(word));
    
    return hasKeyword && !hasExclude;
}

function getElementContext(elem) {
    let context = '';
    
    // Get text from parent
    context += ' ' + elem.parent().text();
    
    // Get text from next siblings
    let next = elem.next();
    for (let i = 0; i < 3 && next.length; i++) {
        context += ' ' + next.text();
        next = next.next();
    }
    
    return cleanText(context);
}

function findRelevantLinks(elem, baseUrl) {
    const links = { website: '', vendorInfo: '' };
    
    // Look in the element and its parent
    const allLinks = elem.parent().find('a').add(elem.find('a'));
    
    allLinks.each((i, link) => {
        const href = $(link).attr('href');
        if (!href) return;
        
        const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
        const linkText = cleanText($(link).text()).toLowerCase();
        
        if (linkText.includes('vendor') || linkText.includes('apply') || linkText.includes('sign up') || linkText.includes('registration')) {
            links.vendorInfo = fullUrl;
        } else if (linkText.includes('website') || linkText.includes('more info') || linkText.includes('visit')) {
            links.website = fullUrl;
        } else if (!links.website && href.startsWith('http')) {
            links.website = fullUrl;
        }
    });
    
    return links;
}

function extractLocation(text) {
    if (!text) return '';
    
    // Enhanced location patterns
    const patterns = [
        // Full address
        /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl|Court|Ct)[^.!?]*(?:Toronto|ON|Ontario)[^.!?]*/i,
        // Street address
        /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Pl|Court|Ct)\b/i,
        // Venue names
        /\b[A-Za-z\s]+(?:Market|Centre|Center|Park|Square|Mall|Plaza|Building|Hall|Arena|Stadium)\b/i,
        // Neighborhood
        /\b(?:Downtown|Midtown|Uptown|East|West|North|South)\s+Toronto\b/i,
        // Toronto areas
        /\b(?:Kensington|Leslieville|Queen West|King West|Distillery|Harbourfront|Junction|Beaches|Corktown|Liberty Village)\b/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return cleanText(match[0]);
        }
    }
    
    return '';
}

function extractDates(text) {
    if (!text) return 'TBD';
    
    const patterns = [
        // Full dates
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi,
        // Date ranges
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\s*[-–—]\s*\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}\b/gi,
        // Weekdays
        /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?\b/gi,
        // Recurring patterns
        /\b(?:daily|weekly|monthly|seasonal|year-round|every\s+\w+)\b/gi,
        // Time patterns
        /\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\s*[-–—]\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)\b/gi,
        // Seasonal
        /\b(?:spring|summer|fall|autumn|winter)\s+\d{4}\b/gi
    ];
    
    let foundDates = [];
    patterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) foundDates.push(...matches);
    });
    
    // Remove duplicates and limit
    foundDates = [...new Set(foundDates)].slice(0, 5);
    
    return foundDates.length > 0 ? foundDates.join('; ') : 'TBD';
}

function extractMarketName(text) {
    // Try to extract a proper market name from text
    const patterns = [
        /^([^.!?]*(?:Market|Fair|Festival|Bazaar|Pop-up)[^.!?]*)/i,
        /^([A-Za-z\s]+(?:Market|Fair|Festival|Bazaar))/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return cleanText(match[1]);
        }
    }
    
    return null;
}

function guessLocationFromUrl(url) {
    if (url.includes('toronto')) return 'Toronto, ON';
    if (url.includes('mississauga')) return 'Mississauga, ON';
    if (url.includes('markham')) return 'Markham, ON';
    return 'Greater Toronto Area, ON';
}

function categorizeMarket(name, description) {
    const text = (name + ' ' + description).toLowerCase();
    
    if (text.includes('farmer') || text.includes('produce')) return 'Farmers Market';
    if (text.includes('artisan') || text.includes('craft')) return 'Artisan Market';
    if (text.includes('pop-up') || text.includes('popup')) return 'Pop-up Market';
    if (text.includes('vintage') || text.includes('antique')) return 'Vintage Market';
    if (text.includes('holiday') || text.includes('christmas')) return 'Holiday Market';
    if (text.includes('night')) return 'Night Market';
    if (text.includes('food')) return 'Food Market';
    
    return 'General Market';
}

function cleanAndDedupeMarkets(markets) {
    const seen = new Set();
    const cleaned = [];
    
    for (const market of markets) {
        // Create a normalized key for deduplication
        const normalizedName = market.name.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (normalizedName.length < 3 || seen.has(normalizedName)) {
            continue;
        }
        
        seen.add(normalizedName);
        
        // Clean up the market data
        cleaned.push({
            name: market.name,
            description: market.description || 'Market information available on website',
            location: market.location || 'Toronto, ON',
            dates: market.dates || 'TBD',
            website: market.website || 'N/A',
            vendor_info: market.vendor_info || 'Contact organizer',
            category: market.category || 'General Market',
            source_url: market.source_url,
            scraped_date: new Date().toISOString().split('T')[0]
        });
    }
    
    return cleaned;
}