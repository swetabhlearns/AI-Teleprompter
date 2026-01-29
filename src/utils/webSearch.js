/**
 * Web Search Utility
 * Uses public SearXNG instances to fetch current web data
 * No API key required - completely free
 */

// List of public SearXNG instances (fallback order)
const SEARXNG_INSTANCES = [
    'https://searx.be',
    'https://search.sapti.me',
    'https://searx.tiekoetter.com',
    'https://search.ononoki.org',
    'https://searx.work',
    'https://search.mdosch.de',
    'https://op.nx.is', // OpenPatents
    'https://northboot.xyz' // Another reliable one
];

/**
 * Search Wikipedia for context (Reliable CORS-friendly fallback)
 */
async function searchWikipedia(query) {
    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.query || !data.query.search || data.query.search.length === 0) {
            return { success: false };
        }

        const results = data.query.search.slice(0, 3).map(r => ({
            title: r.title,
            snippet: r.snippet.replace(/<[^>]*>/g, ''), // Strip HTML tags
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
            source: 'Wikipedia'
        }));

        console.log('✅ Wikipedia search successful');
        return { success: true, results };

    } catch (err) {
        console.warn('Wikipedia search failed:', err);
        return { success: false };
    }
}

/**
 * Search the web for current information on a topic
 * @param {string} query - Search query
 * @param {number} numResults - Number of results to return (default: 5)
 * @returns {Promise<{success: boolean, results: Array, error?: string}>}
 */
export async function searchWeb(query, numResults = 5) {
    // 1. Try public SearXNG instances first
    for (const instance of SEARXNG_INSTANCES) {
        try {
            // Add relatively short timeout to fail fast
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const searchUrl = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=en`;

            const response = await fetch(searchUrl, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) continue;

            const data = await response.json();

            if (!data.results || data.results.length === 0) continue;

            const results = data.results.slice(0, numResults).map(result => ({
                title: result.title || '',
                snippet: result.content || '',
                url: result.url || '',
                publishedDate: result.publishedDate || null,
                source: 'Web'
            }));

            console.log(`✅ SearXNG search successful via ${instance}`);
            return { success: true, results };

        } catch (err) {
            // Silent fail for individual instances
            continue;
        }
    }

    // 2. Fallback to Wikipedia (Rock solid reliability)
    console.warn('⚠️ All SearXNG instances failed/timed out. Falling back to Wikipedia.');
    const wikiResult = await searchWikipedia(query);
    if (wikiResult.success) {
        return wikiResult;
    }

    // 3. Total failure
    console.warn('❌ All search methods failed');
    return {
        success: false,
        results: [],
        error: 'Could not fetch external data. Using internal knowledge.'
    };
}

/**
 * Format search results into context for LLM
 * @param {Array} results - Search results from searchWeb
 * @returns {string} Formatted context string
 */
export function formatSearchContext(results) {
    if (!results || results.length === 0) return '';

    const context = results.map((r, i) =>
        `[${i + 1}] ${r.title}\n${r.snippet}`
    ).join('\n\n');

    return `CURRENT WEB INFORMATION (use this for up-to-date facts):\n${context}`;
}

export default { searchWeb, formatSearchContext };
