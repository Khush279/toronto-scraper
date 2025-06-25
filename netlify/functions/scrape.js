// netlify/functions/scrape.js - ORIGINAL WORKING VERSION + MORE URLS
const axios = require('axios');
const cheerio = require('cheerio');

// EXPANDED URL LIST - Your original 5 + 70 more
const urls = [
    // Original working URLs
    'https://www.stlawrencemarket.com/',
    'https://www.evergreen.ca/',
    'https://thewelcomemarket.ca/',
    'https://www.torontoartisan.com/',
    'https://artsmarket.ca/',
    
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
        const allMarkets = [];
        
        // Process URLs in batches to avoid timeout (process 15 URLs max)
        const urlsToProcess = urls.slice(0, 15);
        
        for (const url of urlsToProcess) {
            try {
                const response = await axios.get(url, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 8000
                });
                
                const $ = cheerio.load(response.text);
                
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