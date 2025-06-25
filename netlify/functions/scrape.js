// netlify/functions/scrape.js - DEBUG VERSION
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
    'https://www.richmond-hill.ca/events/'
];

// Claude API configuration
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

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
        console.log('API Key present:', !!CLAUDE_API_KEY);
        console.log('API Key length:', CLAUDE_API_KEY ? CLAUDE_API_KEY.length : 0);
        
        const allMarkets = [];
        
        // Process fewer URLs to leave time for debugging
        const urlsToProcess = urls.slice(0, 8);
        
        for (const url of urlsToProcess) {
            try {
                console.log(`Scraping: ${url}`);
                
                const response = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 5000
                });
                
                const $ = cheerio.load(response.data);
                
                // Look for headings and content
                $('h1, h2, h3, h4').each((i, elem) => {
                    if (i >= 6) return false;
                    
                    const name = $(elem).text().trim();
                    
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
                            source_url: url,
                            raw_context: context.substring(0, 400)
                        });
                    }
                });
                
                // Also check list items
                $('li').each((i, elem) => {
                    if (i >= 10) return false;
                    
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
                                raw_context: text.substring(0, 400)
                            });
                        }
                    }
                });
                
            } catch (error) {
                console.log(`Error scraping ${url}:`, error.message);
            }
        }
        
        // Remove duplicates
        const unique = [];
        const seen = new Set();
        
        for (const market of allMarkets) {
            const key = market.name.toLowerCase().replace(/[^\w]/g, '');
            if (!seen.has(key) && key.length > 3) {
                seen.add(key);
                unique.push(market);
            }
        }
        
        console.log(`Found ${unique.length} raw markets`);
        
        // Test Claude API with a simple request first
        let enhancedMarkets = [];
        
        if (CLAUDE_API_KEY && unique.length > 0) {
            console.log('Attempting Claude API call...');
            
            try {
                // Test with just first market
                const testMarket = unique[0];
                
                const testResponse = await axios.post('https://api.anthropic.com/v1/messages', {
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 500,
                    messages: [
                        {
                            role: 'user',
                            content: `Clean up this market name: "${testMarket.name}". Just respond with the cleaned name, nothing else.`
                        }
                    ]
                }, {
                    headers: {
                        'Authorization': `Bearer ${CLAUDE_API_KEY}`,
                        'Content-Type': 'application/json',
                        'anthropic-version': '2023-06-01'
                    },
                    timeout: 10000
                });
                
                console.log('Claude API test successful!');
                console.log('Response:', testResponse.data.content[0].text);
                
                // If test works, enhance all markets
                enhancedMarkets = await enhanceMarketsWithClaude(unique.slice(0, 10)); // Limit to 10
                
            } catch (claudeError) {
                console.log('Claude API error:', claudeError.message);
                console.log('Claude error details:', claudeError.response?.data);
                
                // Return original data with debug info
                enhancedMarkets = unique.map(m => ({ 
                    ...m, 
                    ai_enhanced: false,
                    ai_error: claudeError.message,
                    category: 'General Market',
                    vendor_application_available: m.vendor_info !== 'N/A' && m.vendor_info !== 'Contact organizer',
                    scraped_date: new Date().toISOString().split('T')[0]
                }));
            }
        } else {
            console.log('No Claude API key or no markets found');
            enhancedMarkets = unique.map(m => ({ 
                ...m, 
                ai_enhanced: false,
                ai_error: CLAUDE_API_KEY ? 'No markets to enhance' : 'No API key',
                category: 'General Market',
                vendor_application_available: m.vendor_info !== 'N/A' && m.vendor_info !== 'Contact organizer',
                scraped_date: new Date().toISOString().split('T')[0]
            }));
        }
        
        console.log(`Returning ${enhancedMarkets.length} markets`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                markets: enhancedMarkets,
                count: enhancedMarkets.length,
                debug: {
                    api_key_present: !!CLAUDE_API_KEY,
                    raw_markets_found: unique.length,
                    enhanced_markets: enhancedMarkets.length
                }
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
    try {
        console.log(`Enhancing ${markets.length} markets with Claude...`);
        
        const prompt = `Please clean up these Toronto market names and provide basic info. Respond with ONLY a JSON array.

Markets to clean:
${JSON.stringify(markets.map(m => ({ name: m.name, description: m.description })), null, 2)}

Return JSON array with: name (cleaned), description (2 sentences), category (market type), location (specific if found, otherwise "Greater Toronto Area, ON")`;

        const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-3-haiku-20240307',
            max_tokens: 1500,
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
            timeout: 15000
        });
        
        console.log('Claude response received');
        
        const aiResponse = response.data.content[0].text;
        console.log('AI Response preview:', aiResponse.substring(0, 200));
        
        // Try to extract JSON
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
        
        const enhancedData = JSON.parse(jsonString);
        
        return enhancedData.map((enhanced, index) => ({
            ...markets[index],
            name: enhanced.name || markets[index].name,
            description: enhanced.description || markets[index].description,
            location: enhanced.location || markets[index].location,
            category: enhanced.category || 'General Market',
            ai_enhanced: true,
            vendor_application_available: markets[index].vendor_info !== 'N/A' && markets[index].vendor_info !== 'Contact organizer',
            scraped_date: new Date().toISOString().split('T')[0]
        }));
        
    } catch (error) {
        console.log('Enhancement error:', error.message);
        return markets.map(m => ({ 
            ...m, 
            ai_enhanced: false,
            ai_error: error.message,
            category: 'General Market',
            vendor_application_available: m.vendor_info !== 'N/A' && m.vendor_info !== 'Contact organizer',
            scraped_date: new Date().toISOString().split('T')[0]
        }));
    }
}

// Keep all original functions
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
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 5 && trimmed.length < 100 && isMarketName(trimmed)) {
            return trimmed;
        }
    }
    
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