// netlify/functions/scrape.js
const axios = require('axios');
const cheerio = require('cheerio');

const urls = [
    'https://www.stlawrencemarket.com/',
    'https://www.evergreen.ca/',
    'https://thewelcomemarket.ca/',
    'https://www.torontoartisan.com/',
    'https://artsmarket.ca/'
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
                const response = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 8000
                });
                
                const $ = cheerio.load(response.data);
                
                // Simple scraping - look for headings and content
                $('h1, h2, h3, h4').each((i, elem) => {
                    if (i >= 5) return false; // Limit per site
                    
                    const name = $(elem).text().trim();
                    if (name.length > 5 && name.length < 100) {
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

function extractLocation(text) {
    const addressMatch = text.match(/\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd)\b/i);
    if (addressMatch) return addressMatch[0];
    
    const venueMatch = text.match(/\b[A-Za-z\s]+(?:Market|Centre|Park)\b/i);
    if (venueMatch) return venueMatch[0];
    
    return 'Toronto, ON';
}

function extractDates(text) {
    const dateMatch = text.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)[^.!?]*\b/i);
    return dateMatch ? dateMatch[0] : 'TBD';
}
