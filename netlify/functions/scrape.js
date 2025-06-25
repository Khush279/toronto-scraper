// netlify/functions/scrape.js - WITH CLAUDE API ENHANCEMENT
const axios = require('axios');
const cheerio = require('cheerio');

const urls = [
    // Core GTA market sources
    'https://stacktmarket.com/',
    'https://www.blogto.com/eat_drink/2024/05/farmers-markets-toronto-2024/',
    'https://www.timeout.com/toronto/shopping/best-farmers-markets-in-toronto',
    
    // Event Platforms
    'https://www.eventbrite.ca/d/canada--toronto/pop-up/',
    'https://www.eventbrite.ca/d/canada--toronto/vendor/',
    'https://www.eventbrite.ca/d/canada--toronto/craft-fair/',
    'https://www.eventbrite.ca/d/canada--toronto/farmers-market/',
    'https://allevents.in/toronto/pop-ups',
    'https://allevents.in/toronto/craft-fair',
    'https://allevents.in/toronto/market',
    
    // Blog & News Sites
    'https://www.blogto.com/eat_drink/2023/12/holiday-markets-toronto-2023/',
    'https://www.blogto.com/events/',
    'https://curiocity.com/toronto-spring-pop-up-markets-2024/',
    'https://www.narcity.com/toronto/best-farmers-markets-in-toronto',
    'https://www.efosa.ca/',
    
    // Official Market Websites
    'https://www.evergreen.ca/evergreen-brick-works/saturday-farmers-market/',
    'https://stacktmarket.com/events/',
    'https://www.harbourfrontcentre.com/whatson/',
    'https://harbourfrontcentre.com/vendors/',
    'https://www.artscapetoronto.com/wychwood-barns',
    'https://thewelltoronto.com/whats-on/',
    
    // Market Organizers  
    'https://www.torontoartisan.com/apply-here.html',
    'https://fortheloveofmarkets.com/pages/upcoming-events-for-vendors',
    'https://www.torontomarketco.com/become-a-vendor',
    'https://allcanadianevents.com/applications/',
    
    // City & Community Resources (GTA-wide)
    'https://www.toronto.ca/business-economy/industry-sector-support/public-markets/public-markets-in-toronto/',
    'https://www.toronto.ca/explore-enjoy/festivals-events/',
    
    // Mississauga & Surrounding Areas
    'https://www.mississauga.ca/events/',
    'https://www.square-one.com/events/',
    
    // Brampton & York Region
    'https://www.brampton.ca/events/',
    'https://www.york.ca/events/',
    'https://www.markham.ca/events/',
    'https://www.richmond-hill.ca/events/',
    
    // Durham Region
    'https://www.durham.ca/events/',
    'https://www.pickering.ca/events/',
    'https://www.ajax.ca/events/',
    
    // Halton Region
    'https://www.halton.ca/events/',
    'https://www.oakville.ca/events/',
    'https://www.burlington.ca/events/',
];

// Claude API configuration
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY; // Set this in Netlify environment variables

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
        
        // Process URLs in batches to avoid timeout (10 URLs max to leave time for AI processing)
        const urlsToProcess = urls.slice(0, 10);
        
        for (const url of urlsToProcess) {
            try {
                console.log(`Scraping: ${url}`);
                
                const response = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 6000
                });
                
                const $ = cheerio.load(response.data);
                
                // Look for headings and content
                $('h1, h2, h3, h4').each((i, elem) => {
                    if (i >= 8) return false; // Reduced limit to save time for AI processing
                    
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
                            description: context.substring(0, 300),
                            location: extractLocation(context),
                            dates: extractDates(context),
                            website: website,
                            vendor_info: vendorInfo,
                            source_url: url,
                            raw_context: context.substring(0, 600) // Keep raw text for AI processing
                        });
                    }
                });
                
                // Also check list items for markets
                $('li').each((i, elem) => {
                    if (i >= 12) return false;
                    
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
                                source_url: url,
                                raw_context: text.substring(0, 500)
                            });
                        }
                    }
                });
                
            } catch (error) {
                console.log(`Error scraping ${url}:`, error.message);
            }
        }
        
        // Remove basic duplicates first
        const unique = [];
        const seen = new Set();
        
        for (const market of allMarkets) {
            const key = market.name.toLowerCase().replace(/[^\w]/g, '');
            if (!seen.has(key) && key.length > 3) {
                seen.add(key);
                unique.push(market);
            }
        }
        
        console.log(`Found ${unique.length} raw markets, enhancing with Claude...`);
        
        // Enhance with Claude (process in batches)
        const enhancedMarkets = [];
        const batchSize = 5; // Process 5 markets at a time
        
        for (let i = 0; i < unique.length && i < 15; i += batchSize) {
            const batch = unique.slice(i, i + batchSize);
            const enhanced = await enhanceMarketsWithClaude(batch);
            enhancedMarkets.push(...enhanced);
        }
        
        console.log(`Enhanced ${enhancedMarkets.length} markets with Claude`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                markets: enhancedMarkets,
                count: enhancedMarkets.length
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

async function enhanceMarketsWithClaude(markets) {
    if (!CLAUDE_API_KEY) {
        console.log('No Claude API key, returning original markets');
        return markets.map(m => ({ ...m, ai_enhanced: false }));
    }
    
    try {
        const prompt = `I need you to clean up and enhance this Toronto market data for a vendor marketplace platform. Please analyze each market and provide enhanced information.

For each market, please provide:
1. A clean, proper market name (remove HTML artifacts, fix capitalization, make it professional)
2. A clear, helpful description (2-3 sentences that would help vendors understand what this market is about)
3. The most specific location/address you can extract
4. Clean and standardized dates/schedule information
5. Enhanced vendor application information
6. Market category (Farmers Market, Artisan Market, Pop-up Market, Craft Fair, Holiday Market, etc.)
7. Whether vendor applications appear to be available

Raw market data:
${JSON.stringify(markets.map(m => ({
    name: m.name,
    description: m.description,
    raw_context: m.raw_context,
    location: m.location,
    dates: m.dates,
    website: m.website,
    vendor_info: m.vendor_info
})), null, 2)}

Please respond with ONLY a JSON array containing enhanced market objects with these exact fields:
- name (cleaned and professional)
- description (enhanced, 2-3 sentences, helpful for vendors)
- location (most specific address/location found)
- dates (cleaned schedule)
- website (keep original)
- vendor_info (enhanced with clear application details)
- category (market type)
- vendor_application_available (true/false)

Respond with only the JSON array, no other text.`;

        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-3-haiku-20240307',
            max_tokens: 2000,
            temperature: 0.2,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${CLAUDE_API_KEY}`,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            timeout: 20000
        });
        
        const aiResponse = response.data.content[0].text;
        
        // Extract JSON from response (in case Claude adds extra text)
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
        
        const enhancedData = JSON.parse(jsonString);
        
        // Merge Claude enhancements with original data
        return enhancedData.map((enhanced, index) => ({
            ...markets[index],
            name: enhanced.name || markets[index].name,
            description: enhanced.description || markets[index].description,
            location: enhanced.location || markets[index].location,
            dates: enhanced.dates || markets[index].dates,
            vendor_info: enhanced.vendor_info || markets[index].vendor_info,
            category: enhanced.category || 'General Market',
            vendor_application_available: enhanced.vendor_application_available || false,
            ai_enhanced: true,
            scraped_date: new Date().toISOString().split('T')[0]
        }));
        
    } catch (error) {
        console.log('Claude enhancement error:', error.message);
        // Return original data if AI fails
        return markets.map(m => ({ 
            ...m, 
            ai_enhanced: false,
            category: 'General Market',
            vendor_application_available: m.vendor_info !== 'N/A' && m.vendor_info !== 'Contact organizer',
            scraped_date: new Date().toISOString().split('T')[0]
        }));
    }
}

// Keep all your original functions exactly the same
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
    
    // Check for GTA neighborhoods and cities
    const gtaAreas = [
        'Kensington', 'Leslieville', 'Distillery', 'Harbourfront', 'Junction',
        'Mississauga', 'Brampton', 'Markham', 'Richmond Hill', 'Vaughan',
        'Oakville', 'Burlington', 'Pickering', 'Ajax', 'Whitby', 'Oshawa',
        'Newmarket', 'Aurora', 'King City', 'Etobicoke', 'Scarborough', 'North York'
    ];
    for (const area of gtaAreas) {
        if (text.toLowerCase().includes(area.toLowerCase())) {
            return area + ', ON';
        }
    }
    
    return 'Greater Toronto Area, ON';
}

function extractDates(text) {
    const dateMatch = text.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)[^.!?]*\b/i);
    return dateMatch ? dateMatch[0] : 'TBD';
}