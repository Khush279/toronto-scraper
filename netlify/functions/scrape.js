// netlify/functions/scrape.js - COMPREHENSIVE URL LIST
const axios = require('axios');
const cheerio = require('cheerio');

// MASSIVE list of URLs that host Toronto markets and pop-ups
const urls = [
    // Event Platforms
    'https://www.eventbrite.ca/d/canada--toronto/pop-up/',
    'https://www.eventbrite.ca/d/canada--toronto/vendor/',
    'https://www.eventbrite.ca/d/canada--toronto/craft-fair/',
    'https://www.eventbrite.ca/d/canada--toronto/farmers-market/',
    'https://allevents.in/toronto/pop-ups',
    'https://allevents.in/toronto/craft-fair',
    'https://allevents.in/toronto/market',
    
    // Blog & News Sites
    'https://www.blogto.com/eat_drink/2024/05/farmers-markets-toronto-2024/',
    'https://www.blogto.com/eat_drink/2023/12/holiday-markets-toronto-2023/',
    'https://www.blogto.com/events/',
    'https://curiocity.com/toronto-spring-pop-up-markets-2024/',
    'https://www.timeout.com/toronto/shopping/best-farmers-markets-in-toronto',
    'https://www.narcity.com/toronto/best-farmers-markets-in-toronto',
    'https://www.efosa.ca/',
    
    // Official Market Websites
    'https://www.stlawrencemarket.com/',
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
    
    // City & Community Resources
    'https://www.toronto.ca/business-economy/industry-sector-support/public-markets/public-markets-in-toronto/',
    'https://www.toronto.ca/explore-enjoy/festivals-events/',
    
    // Venue Websites
    'https://www.cne.ca/en/vendors',
    'https://www.harbourfront.com/events/',
    'https://www.ontarioplace.com/en/events/',
    'https://casaloma.ca/events/',
    
    // Market Networks & Communities
    'https://www.facebook.com/groups/torontovbnetwork/',
    'https://www.meetup.com/cities/ca/on/toronto/markets/',
    
    // Shopping & Retail
    'https://www.thedistillerydistrict.com/whats-on/',
    'https://kensingtonmarket.to/events/',
    'https://www.cfshops.com/don-mills/en/events.html',
    
    // Specialty Market Sites
    'https://www.sarassoapsandcandles.ca/pages/markets-and-pop-ups',
    'https://www.oneofakindshow.com/toronto/',
    'https://www.royalwinter.com/',
    'https://www.canguild.ca/craft-shows/',
    
    // Food & Drink Focused
    'https://www.torontofoodevents.ca/',
    'https://www.foodnetwork.ca/shows/eat-st/blog/toronto-food-markets/',
    
    // Arts & Culture
    'https://www.artcrawltoronto.com/',
    'https://www.torontofringe.ca/events/',
    'https://www.nuitblanche.ca/',
    
    // Seasonal & Holiday Markets
    'https://www.christmasmarket.ca/',
    'https://www.torontochristmasmarket.com/',
    'https://www.harbourfront.com/festivals/',
    
    // Community Centers & Parks
    'https://www.toronto.ca/data/parks/prd/facilities/complex/711/index.html',
    'https://www.toronto.ca/explore-enjoy/parks-recreation/',
    
    // Pop-up Rental Platforms
    'https://www.storefront.com/markets/toronto',
    'https://www.sharedsquare.com/toronto',
    'https://www.popuprepublic.com/toronto',
    
    // Wedding & Special Events
    'https://www.torontoweddingshow.com/',
    'https://www.bridalshow.com/toronto/',
    
    // Craft & Maker Focused
    'https://www.craftontario.com/craft-sales/',
    'https://www.canadianartisans.ca/events/',
    'https://www.handmademarkets.ca/toronto/',
    
    // University & Campus Events
    'https://www.utsu.ca/events/',
    'https://www.ryerson.ca/events/',
    'https://www.yorku.ca/events/',
    
    // Mall & Shopping Center Events
    'https://www.cadillacfairview.com/shopping-centres/cf-fairview-mall/events/',
    'https://www.cadillacfairview.com/shopping-centres/cf-sherway-gardens/events/',
    'https://www.cfshops.com/yorkdale/en/events.html',
    'https://www.square-one.com/events/',
    
    // Additional Community Resources
    'https://www.blogto.com/fashion_style/2024/01/pop-up-shops-toronto-2024/',
    'https://www.thestar.com/life/food_wine/toronto-farmers-markets/',
    'https://nowtoronto.com/food-and-drink/farmers-markets-toronto/',
    'https://www.cbc.ca/news/canada/toronto/farmers-markets-toronto',
    
    // International & Cultural Events
    'https://www.greektowntoronto.com/events/',
    'https://www.littleitaly.ca/events/',
    'https://www.chinatowntoronto.com/events/',
    'https://www.koreantowntoronto.com/events/',
    
    // BIA (Business Improvement Area) Sites
    'https://www.bloorwest.com/events/',
    'https://www.queenwestbia.ca/events/',
    'https://www.thebeachestoronto.com/events/',
    'https://www.leslieville.com/events/',
    'https://www.roncesvaillagebia.com/events/',
    
    // Food Halls & Markets
    'https://www.assemblychef.com/events/',
    'https://www.thestop.org/programs-services/markets/',
    'https://www.foodshare.net/program/markets/',
    
    // Tech & Innovation Venues
    'https://www.marsdd.com/events/',
    'https://www.torontoenterprisefund.ca/events/',
    'https://www.oneeleven.com/events/'
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
        console.log(`Starting comprehensive scraper with ${urls.length} URLs...`);
        const allMarkets = [];
        let processedCount = 0;
        
        // Process URLs in batches to avoid timeout
        const batchSize = 15; // Process 15 URLs max to stay under timeout
        const urlsToProcess = urls.slice(0, batchSize);
        
        for (const url of urlsToProcess) {
            try {
                processedCount++;
                console.log(`Processing ${processedCount}/${urlsToProcess.length}: ${url}`);
                
                const response = await axios.get(url, {
                    headers: { 
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    },
                    timeout: 10000,
                    maxRedirects: 3
                });
                
                const $ = cheerio.load(response.data);
                const markets = extractMarkets($, url);
                
                if (markets.length > 0) {
                    allMarkets.push(...markets);
                    console.log(`Found ${markets.length} markets from ${url}`);
                }
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 500));
                
            } catch (error) {
                console.log(`Error with ${url}: ${error.message}`);
                continue;
            }
        }
        
        // Remove duplicates and clean data
        const uniqueMarkets = removeDuplicates(allMarkets);
        
        console.log(`Processed ${processedCount} URLs, found ${uniqueMarkets.length} unique markets`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                markets: uniqueMarkets,
                count: uniqueMarkets.length,
                processed_urls: processedCount,
                total_urls: urls.length
            })
        };
        
    } catch (error) {
        console.error('Main scraper error:', error);
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

function extractMarkets($, url) {
    const markets = [];
    
    // Strategy 1: Event listings (Eventbrite, AllEvents)
    if (url.includes('eventbrite') || url.includes('allevents')) {
        $('.event-card, .event-item, [class*="event"]').each((i, elem) => {
            if (i >= 10) return false;
            
            const $elem = $(elem);
            const title = $elem.find('h1, h2, h3, h4, .event-title, [class*="title"]').first().text().trim();
            const description = $elem.text().trim();
            
            if (title && isValidMarketName(title)) {
                markets.push(createMarket(title, description, url));
            }
        });
    }
    
    // Strategy 2: Blog articles (BlogTO, Narcity, etc.)
    else if (url.includes('blogto') || url.includes('narcity') || url.includes('timeout') || url.includes('curiocity')) {
        $('h2, h3, h4').each((i, elem) => {
            if (i >= 15) return false;
            
            const $elem = $(elem);
            const title = $elem.text().trim();
            
            if (isValidMarketName(title)) {
                const context = getContextText($elem);
                markets.push(createMarket(title, context, url));
            }
        });
        
        // Also check list items in articles
        $('li').each((i, elem) => {
            if (i >= 20) return false;
            
            const text = $(elem).text().trim();
            if (text.length > 30 && isValidMarketName(text)) {
                const name = extractMarketName(text);
                if (name) {
                    markets.push(createMarket(name, text, url));
                }
            }
        });
    }
    
    // Strategy 3: Official venue sites
    else if (url.includes('stackt') || url.includes('harbourfront') || url.includes('stlawrence') || url.includes('evergreen')) {
        $('.event, .market, .program, article').each((i, elem) => {
            if (i >= 8) return false;
            
            const $elem = $(elem);
            const title = $elem.find('h1, h2, h3, h4').first().text().trim();
            const description = $elem.text().trim();
            
            if (title && (title.length > 5)) {
                markets.push(createMarket(title, description, url));
            }
        });
    }
    
    // Strategy 4: Vendor application pages
    else if (url.includes('apply') || url.includes('vendor') || url.includes('become')) {
        $('h1, h2, h3').each((i, elem) => {
            if (i >= 5) return false;
            
            const title = $(elem).text().trim();
            const context = getContextText($(elem));
            
            if (title.length > 5 && context.length > 50) {
                markets.push(createMarket(title, context, url));
            }
        });
    }
    
    // Strategy 5: General scraping
    else {
        $('h1, h2, h3, h4').each((i, elem) => {
            if (i >= 10) return false;
            
            const title = $(elem).text().trim();
            if (isValidMarketName(title)) {
                const context = getContextText($(elem));
                markets.push(createMarket(title, context, url));
            }
        });
    }
    
    return markets;
}

function isValidMarketName(text) {
    if (!text || text.length < 5 || text.length > 150) return false;
    
    const marketKeywords = [
        'market', 'farmers', 'artisan', 'craft', 'vendor', 'bazaar', 'fair', 
        'festival', 'pop-up', 'popup', 'night market', 'holiday market',
        'christmas market', 'farmers market', 'craft fair', 'art show',
        'maker', 'handmade', 'local', 'community market', 'street festival'
    ];
    
    const excludeWords = [
        'about', 'contact', 'home', 'search', 'menu', 'login', 'register',
        'privacy', 'terms', 'copyright', 'subscribe', 'follow', 'share',
        'click', 'here', 'more', 'read', 'view', 'see', 'find', 'get'
    ];
    
    const lowerText = text.toLowerCase();
    const hasKeyword = marketKeywords.some(keyword => lowerText.includes(keyword));
    const hasExclude = excludeWords.some(word => lowerText.includes(word));
    
    return hasKeyword && !hasExclude;
}

function extractMarketName(text) {
    // Extract clean market name from longer text
    const sentences = text.split(/[.!?]+/);
    
    for (const sentence of sentences) {
        const cleaned = sentence.trim();
        if (cleaned.length > 10 && cleaned.length < 80 && isValidMarketName(cleaned)) {
            return cleaned;
        }
    }
    
    // Try first meaningful part
    const parts = text.split(/[:,\-–—]/);
    for (const part of parts) {
        const cleaned = part.trim();
        if (cleaned.length > 10 && cleaned.length < 80 && isValidMarketName(cleaned)) {
            return cleaned;
        }
    }
    
    return text.substring(0, 60).trim();
}

function getContextText($elem) {
    let context = '';
    
    // Get text from next siblings
    let next = $elem.next();
    while (next.length && context.length < 300) {
        if (next.is('p, div, span, li')) {
            context += ' ' + next.text();
        }
        next = next.next();
    }
    
    // If not enough, get from parent
    if (context.length < 100) {
        context = $elem.parent().text();
    }
    
    return context.trim().substring(0, 400);
}

function createMarket(name, description, url) {
    return {
        name: cleanText(name),
        description: cleanText(description).substring(0, 300),
        location: extractLocation(description),
        dates: extractDates(description),
        website: extractWebsite(description) || getBaseUrl(url),
        vendor_info: extractVendorInfo(description, url),
        source_url: url,
        scraped_date: new Date().toISOString().split('T')[0]
    };
}

function extractLocation(text) {
    const patterns = [
        /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Place|Court)\b[^.!?]*/i,
        /\b[A-Za-z\s]+(?:Park|Square|Centre|Center|Market|Mall|Plaza|Building|Hall)\b/i,
        /\b(?:Downtown|Midtown|East|West|North|South)\s+Toronto\b/i,
        /\b(?:Kensington|Leslieville|Queen West|King West|Distillery|Harbourfront|Junction|Beaches|Corktown|Liberty Village|High Park|Christie Pits|Trinity Bellwoods|Riverdale)\b/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            return cleanText(match[0]);
        }
    }
    
    return 'Toronto, ON';
}

function extractDates(text) {
    const patterns = [
        /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[^.!?]*/gi,
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}[^.!?]*/gi,
        /\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)[^.!?]*/gi,
        /\b(?:daily|weekly|monthly|seasonal|year-round|spring|summer|fall|winter)[^.!?]*/gi
    ];
    
    let dates = [];
    for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
            dates.push(...matches.slice(0, 2));
        }
    }
    
    return dates.length > 0 ? dates.slice(0, 3).join('; ') : 'Check website for schedule';
}

function extractWebsite(text) {
    const urlPattern = /https?:\/\/[^\s<>"']*/gi;
    const matches = text.match(urlPattern);
    return matches ? matches[0] : null;
}

function extractVendorInfo(text, sourceUrl) {
    const vendorKeywords = ['vendor', 'apply', 'application', 'registration', 'sign up', 'join'];
    const lowerText = text.toLowerCase();
    
    if (vendorKeywords.some(keyword => lowerText.includes(keyword))) {
        if (sourceUrl.includes('apply') || sourceUrl.includes('vendor')) {
            return 'Vendor applications available - check this website';
        }
        return 'Vendor opportunities mentioned - contact organizer';
    }
    
    return 'Contact organizer for vendor information';
}

function getBaseUrl(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.hostname}`;
    } catch {
        return url;
    }
}

function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s\-.,;:()&]/g, '')
        .trim();
}

function removeDuplicates(markets) {
    const seen = new Set();
    const unique = [];
    
    for (const market of markets) {
        const key = market.name.toLowerCase()
            .replace(/[^\w]/g, '')
            .substring(0, 25);
        
        if (!seen.has(key) && key.length > 5) {
            seen.add(key);
            unique.push(market);
        }
    }
    
    return unique;
}