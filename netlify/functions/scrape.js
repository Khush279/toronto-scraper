// netlify/functions/scrape.js - FIXED ORIGINAL
const axios = require('axios');
const cheerio = require('cheerio');

const urls = [
    'https://www.stlawrencemarket.com/',
    'https://www.evergreen.ca/',
    'https://thewelcomemarket.ca/',
    'https://www.torontoartisan.com/',
    'https://artsmarket.ca/',
    'https://stacktmarket.com/',
    'https://www.blogto.com/eat_drink/2024/05/farmers-markets-toronto-2024/',
    'https://www.timeout.com/toronto/shopping/best-farmers-markets-in-toronto'
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
            try {
                console.log(`Scraping: ${url}`);
                
                const response = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 8000
                });
                
                const $ = cheerio.load(response.data);
                
                // Look for headings and content
                $('h1, h2, h3, h4').each((i, elem) => {
                    if (i >= 10) return false; // Increased limit
                    
                    const name = $(elem).text().trim();
                    
                    // Filter for market-related names
                    if (isMarketName(name)) {
                        const context = $(elem).parent().text().trim();
                        
                        // Find links
                        let website = 'N/A';
                        let vendorInfo = 'N/A';
                        
                        $(elem).parent().find('a').each((j, link) => {
                            const href = $(link).attr('href');
                            if (href) {
                                const fullUrl = href.startsWith('http') ? href : new URL(href, url).href;
                                const linkText = $(link).text().toLowerCase();
                                
                                if (linkText.includes('vendor') || linkText.includes('apply')) {
                                    vendorInfo = fullUrl;
                                } else if (website === 'N/A') {
                                    website = fullUrl;
                                }
                            }
                        });
                        
                        allMarkets.push({
                            name: name,
                            description: context.substring(0, 200),
                            location: extractLocation(context),
                            dates: extractDates(context),
                            website: website,
                            vendor_info: vendorInfo,
                            source_url: url
                        });
                    }
                });
                
                // Also check list items for markets
                $('li').each((i, elem) => {
                    if (i >= 15) return false;
                    
                    const text = $(elem).text().trim();
                    
                    if (text.length > 20 && isMarketName(text)) {
                        const name = extractMarketName(text);
                        
                        if (name) {
                            allMarkets.push({
                                name: name,
                                description: text.substring(0, 200),
                                location: extractLocation(text),
                                dates: extractDates(text),
                                website: url,
                                vendor_info: 'Contact organizer',
                                source_url: url
                            });
                        }
                    }
                });
                
                console.log(`Found ${allMarkets.length} total markets so far`);
                
            } catch (error) {
                console.log(`Error scraping ${url}:`, error.message);
            }
        }
        
        // Remove basic duplicates
        const unique = [];
        const seen = new Set();
        
        for (const market of allMarkets) {
            const key = market.name.toLowerCase().replace(/[^\w]/g, '');
            if (!seen.has(key) && key.length > 3) {
                seen.add(key);
                unique.push(market);
            }
        }
        
        console.log(`Final unique markets: ${unique.length}`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                markets: unique,
                count: unique.length
            })
        };
        
    } catch (error) {
        console.log('Main error:', error);
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

function isMarketName(text) {
    if (!text || text.length < 5 || text.length > 150) return false;
    
    const marketKeywords = [
        'market', 'farmers', 'artisan', 'craft', 'vendor', 'bazaar', 
        'fair', 'festival', 'pop-up', 'popup', 'night market'
    ];
    
    const excludeWords = [
        'about', 'contact', 'home', 'search', 'menu', 'login', 
        'privacy', 'terms', 'copyright'
    ];
    
    const lowerText = text.toLowerCase();
    
    const hasKeyword = marketKeywords.some(keyword => lowerText.includes(keyword));
    const hasExclude = excludeWords.some(word => lowerText.includes(word));
    
    return hasKeyword && !hasExclude;
}

function extractMarketName(text) {
    // Try to extract a clean market name from longer text
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 5 && trimmed.length < 100 && isMarketName(trimmed)) {
            return trimmed;
        }
    }
    
    // Fallback to first part
    return text.substring(0, 60).trim();
}

function extractLocation(text) {
    const addressMatch = text.match(/\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/i);
    if (addressMatch) return addressMatch[0];
    
    const venueMatch = text.match(/\b[A-Za-z\s]+(?:Market|Centre|Center|Park|Square)\b/i);
    if (venueMatch) return venueMatch[0];
    
    // Check for Toronto neighborhoods
    const neighborhoods = ['Kensington', 'Leslieville', 'Distillery', 'Harbourfront', 'Junction'];
    for (const hood of neighborhoods) {
        if (text.toLowerCase().includes(hood.toLowerCase())) {
            return hood + ', Toronto';
        }
    }
    
    return 'Toronto, ON';
}

function extractDates(text) {
    const dateMatch = text.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)[^.!?]*\b/i);
    return dateMatch ? dateMatch[0] : 'TBD';
}