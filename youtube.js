// ==UserScript==
// @name         YouTube Script
// @namespace    nohuto/userscripts
// @version      0.0.1.0
// @description  Make YouTube usable
// @author       nohuto
// @license      AGPL-3.0-or-later
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @match        https://www.youtube-nocookie.com/embed/*
// @run-at       document-start
// @grant        GM.xmlHttpRequest
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    //
    // Settings
    //
    const config = {
        //
        // Theater mode
        //
        theaterMode: true, // bool

        //
        // Preferred video quality
        //
        preferredQuality: 2160, // number (video height: 4320, 2160, 1440, 1080, 720, 480, 360, 240, 144, uses the next lower available one, 0 = youtube default)

        //
        // SponsorBlock, skips community submitted segments
        //
        sponsorBlock: true, // bool
            sponsorCategories: ['preview', 'sponsor', 'outro', 'music_offtopic', 'selfpromo', 'poi_highlight', 'interaction', 'intro'], // string[] (sponsor, selfpromo, interaction, intro, outro, preview, hook, filler, music_offtopic, poi_highlight, [] = none)
            sponsorMinVotes: -2, // number (minimum segment votes, negatives allowed)
            sponsorNotifications: true, // bool (notices inside the player)
            sponsorHashing: true, // bool (true sends a hash prefix, false sends the video id, also used by deArrow)
            sponsorServer: 'sponsor.ajay.app', // string (api hostname without scheme/path, also used by deArrow)

        //
        // DeArrow, community titles & thumbnails on video cards
        //
        deArrow: true, // bool
            replaceTitles: true, // bool (titles)
            replaceThumbnails: true, // bool (thumbnails)

        //
        // Video filters, hide video cards
        //
        filterVideos: true, // bool
            hideMembersOnly: true, // bool (members only & members first videos, yt uses the same badge for both)
            hideBuyOrRent: true, // bool (buy/rent movies & videos)
            filterTitles: [], // string[] (case insensitive regex sources matched against titles, e.g. ['giveaway', 'reaction'])
            filterChannels: [], // string[] (channel names or @handles, case insensitive)
            filterMinDuration: 0, // number (seconds, hides shorter videos, 0 = off)

        //
        // Shorts, redirects shorts pages and hides shorts everywhere
        //
        blockShorts: true, // bool

        //
        // Masthead (top bar)
        //
        masthead: true, // bool
            hideVoiceSearch: true, // bool
            hideCreateButton: true, // bool
            hideNotifications: true, // bool

        //
        // Guide (sidebar)
        //
        guide: true, // bool
            hideExplore: true, // bool (entire explore section)
            hideMoreFromYouTube: true, // bool (entire more from youtube section)
            hideReportHistory: false, // bool
            hideGuideFooter: true, // bool (about, press, copyright, terms & other links)

        //
        // Feeds & search
        //
        feeds: true, // bool
            hideFilterChips: true, // bool (content filter bars)
            hideSearchShelves: true, // bool (latest from, people also watched, for you & related search shelves in search results)
            hideMostRelevant: true, // bool (most relevant in subscriptions)
            hideThumbnails: false, // bool

        //
        // Watch page
        //
        watchPage: true, // bool
            hideJoin: true, // bool (membership buttons)
            hideSuperThanks: true, // bool (thanks donation buttons)
            hideComments: true, // bool
            hideDescription: false, // bool (description box with views and upload date)
            hideRelatedVideos: true, // bool (recommended videos beside/below the player)

        //
        // Videos per row in video grids (~250px per video)
        //
        gridItemsPerRow: 6, // number (0 = youtube default)

        //
        // Inline playback
        //
        disableInlinePlayback: true, // bool

        //
        // Page transitions & animations outside the player (adds ~50ms style work on feed loads)
        //
        disableAnimations: false // bool
    };

    // main setting disables its whole group
    const groups = {
        deArrow: ['replaceTitles', 'replaceThumbnails'],
        filterVideos: ['hideMembersOnly', 'hideBuyOrRent', 'filterTitles', 'filterChannels', 'filterMinDuration'],
        masthead: ['hideVoiceSearch', 'hideCreateButton', 'hideNotifications'],
        guide: ['hideExplore', 'hideMoreFromYouTube', 'hideReportHistory', 'hideGuideFooter'],
        feeds: ['hideFilterChips', 'hideSearchShelves', 'hideMostRelevant', 'hideThumbnails'],
        watchPage: ['hideJoin', 'hideSuperThanks', 'hideComments', 'hideDescription', 'hideRelatedVideos']
    };
    for (const [main, subs] of Object.entries(groups)) if (!config[main]) for (const sub of subs) config[sub] = Array.isArray(config[sub]) ? [] : typeof config[sub] === 'number' ? 0 : false;

    function blockShortsRoute() {
        if (!config.blockShorts || !/\/shorts(?:\/|$)/.test(location.pathname)) return false;
        location.replace(location.origin + '/');
        return true;
    }
    if (blockShortsRoute()) return;

    // yt reads this sticky quality on player start, so the first stream request already uses it
    if (config.preferredQuality > 0) try {
        const now = Date.now();
        localStorage.setItem('yt-player-quality', JSON.stringify({ data: JSON.stringify({ quality: config.preferredQuality, previousQuality: config.preferredQuality }), expiration: now + 31104000000, creation: now }));
    } catch { }

    // yts own inline playback setting (pref flag 186), previews then never load and thumbnails stay static
    if (config.disableInlinePlayback) try {
        const pref = document.cookie.match(/(?:^|;\s*)PREF=([^;]*)/)?.[1] || '';
        const flags = parseInt(pref.match(/(?:^|&)f7=([\da-f]+)/i)?.[1] || '0', 16);
        if (!(flags & 1)) {
            const value = (flags | 1).toString(16);
            const next = /(?:^|&)f7=/.test(pref) ? pref.replace(/((?:^|&)f7=)[^&]*/, '$1' + value) : (pref ? pref + '&' : '') + 'f7=' + value;
            document.cookie = 'PREF=' + next + '; domain=.youtube.com; path=/; max-age=63072000; secure';
        }
    } catch { }

    const rules = [];
    function hide(enabled, selectors) {
        if (enabled) rules.push(selectors + ' { display: none !important; }');
    }
    const each = (elements, suffix) => elements.map(element => element + suffix).join(', ');
    hide(config.hideThumbnails, 'ytd-thumbnail:not(.player-container-background-image), yt-thumbnail-view-model, yt-collection-thumbnail-view-model, .ytLockupViewModelContentImage, ytd-playlist-thumbnail, ytd-moving-thumbnail-renderer, ytd-video-preview, ytm-media-item .media-item-thumbnail-container, ytm-video-with-context-renderer .video-thumbnail-container-large, ytm-compact-video-renderer .video-thumbnail-container-compact');
    if (config.hideThumbnails) rules.push('.ytLockupViewModelMetadata { width: 100% !important; margin-left: 0 !important; }');
    hide(config.hideVoiceSearch, '#voice-search-button, ytm-masthead .voice-search-button');
    hide(config.hideCreateButton, 'yt-create-button-view-model, ytd-masthead ytd-button-renderer:has([aria-label="Create"]), ytd-masthead ytd-topbar-menu-button-renderer:has([aria-label="Create"]), ytd-masthead ytd-button-renderer:has([aria-label="Erstellen"]), ytd-masthead ytd-topbar-menu-button-renderer:has([aria-label="Erstellen"]), ytd-masthead a[href^="https://studio.youtube.com/channel/"][href$="/videos/upload"]');
    hide(config.hideNotifications, 'ytd-notification-topbar-button-renderer, yt-notification-topbar-button-view-model, ' + each(['ytd-masthead ytd-topbar-menu-button-renderer', 'ytd-masthead button-view-model'], ':has([aria-label^="Notifications"], [aria-label^="Benachrichtigungen"])'));
    hide(config.hideFilterChips, 'ytd-feed-filter-chip-bar-renderer, chip-bar-view-model, yt-chip-cloud-renderer, ytd-chip-cloud-renderer, yt-chip-cloud-view-model, ytm-chip-cloud-renderer, #chips-wrapper.ytd-watch-next-secondary-results-renderer');
    // the shared header background still reserves the chip bar height
    if (config.hideFilterChips) rules.push('ytd-app #frosted-glass { height: var(--ytd-masthead-height, 56px) !important; }');
    hide(config.hideSearchShelves, 'ytd-search ytd-item-section-renderer > #contents > ytd-shelf-renderer, ytd-search ytd-item-section-renderer > #contents > ytd-horizontal-card-list-renderer');
    const lockups = ['ytd-rich-item-renderer', 'yt-lockup-view-model'];
    const renderers = ['ytd-video-renderer', 'ytd-grid-video-renderer', 'ytd-compact-video-renderer', 'ytd-playlist-video-renderer', 'ytd-movie-renderer', 'ytd-grid-movie-renderer'];
    hide(config.hideMembersOnly, each(lockups, ':has(.ytBadgeShapeCommerce)') + ', ' + each(renderers, ':has(.ytBadgeShapeMembership, .badge-style-type-members-only)'));
    hide(config.hideBuyOrRent, each(renderers, ':has(.ytBadgeShapeCommerce, .badge-style-type-ypc)') + ', ytd-movie-renderer:has(#offer-buttons ytd-button-renderer)');
    if (config.gridItemsPerRow > 0) {
        rules.push('ytd-rich-grid-renderer > #contents { container-type: inline-size; }');
        for (let items = 1; items <= config.gridItemsPerRow; items++) rules.push('@container (min-width: ' + items * 266 + 'px) { ytd-rich-grid-renderer > #contents > ytd-rich-item-renderer { --ytd-rich-grid-items-per-row: ' + items + ' !important; } }');
    }
    const buttons = ['ytd-button-renderer', 'button-view-model', 'yt-button-view-model', 'yt-button-shape', '.ytFlexibleActionsViewModelAction'];
    hide(config.hideJoin, '#sponsor-button, #join-button, ' + each(buttons, ':has(button:is([aria-label="Join"], [aria-label^="Join this channel"], [aria-label="Mitglied werden"], [aria-label="Beitreten"]))'));
    hide(config.hideSuperThanks, each(buttons, ':has(button:is([aria-label="Thanks"], [aria-label*="Super Thanks"], [aria-label="Danke"], [aria-label*="Super-Dank"]))'));
    hide(config.hideComments, 'ytd-comments, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"], ytm-comment-section-renderer, ytm-comments-entry-point-header-renderer, ytm-item-section-renderer[section-identifier="comments-entry-point"]');
    hide(config.hideDescription, 'ytd-watch-metadata #description, ytd-video-secondary-info-renderer #description, ytm-watch .slim-video-metadata-info');
    if (config.hideRelatedVideos) {
        hide(true, 'ytd-watch-flexy #related, ytm-item-section-renderer[section-identifier="related-items"]');
        // collapse the video column while keeping chat, playlists and open panels available
        const panels = 'ytd-live-chat-frame, ytd-playlist-panel-renderer:not([hidden]), ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"]' + (config.hideComments ? ':not([target-id="engagement-panel-comments-section"])' : '');
        hide(true, 'ytd-watch-flexy #secondary:not(:has(' + panels + '))');
    }
    hide(config.hideExplore, 'ytd-guide-section-renderer:has(a[href="/feed/trending"]), ytd-guide-section-renderer:has(a[href="/gaming"]), ytd-guide-section-renderer:has(a[href="/feed/explore"])');
    hide(config.hideMoreFromYouTube, 'ytd-guide-section-renderer:has(a[href^="https://www.youtube.com/premium"]), ytd-guide-section-renderer:has(a[href="/premium"]), ytd-guide-section-renderer:has(a[href^="https://music.youtube.com"]), ytd-guide-section-renderer:has(a[href^="https://www.youtubekids.com"])');
    hide(config.hideReportHistory, 'ytd-guide-entry-renderer:has(a[href^="/reporthistory"]), ytd-guide-entry-renderer:has(a[href^="https://www.youtube.com/reporthistory"])');
    hide(config.hideGuideFooter, 'ytd-guide-renderer #footer, ytd-guide-renderer #guide-links-primary, ytd-guide-renderer #guide-links-secondary, ytd-guide-renderer #copyright');
    const shortsLink = 'a:is([href^="/shorts/"], [href^="https://www.youtube.com/shorts/"], [href^="https://m.youtube.com/shorts/"])';
    // spa guide buttons can have a title without an href
    hide(config.blockShorts, 'ytd-reel-shelf-renderer, ytd-reel-item-renderer, ytm-reel-shelf-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, yt-shorts-lockup-view-model, ' + each(['ytd-rich-section-renderer', 'ytd-rich-shelf-renderer', '.ytGridShelfViewModelHost', 'ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-grid-video-renderer', 'ytd-compact-video-renderer', 'ytd-playlist-video-renderer', 'ytd-playlist-panel-video-renderer', 'yt-lockup-view-model', 'ytm-media-item', 'ytm-video-with-context-renderer', 'ytm-compact-video-renderer'], ':has(' + shortsLink + ')') + ', ' + each(['ytd-guide-entry-renderer', 'ytd-mini-guide-entry-renderer'], ':has(a:is([href^="/shorts"], [href$="/shorts"], [title="Shorts"], [aria-label="Shorts"]))') + ', .pivot-shorts, yt-tab-shape:has(a[href$="/shorts"])');
    if (config.disableAnimations) {
        const motion = ['ytd-masthead', 'tp-yt-app-drawer', 'ytd-browse', 'ytd-search', 'ytd-watch-flexy #below', 'ytd-watch-flexy #secondary', 'ytd-popup-container'].map(root => root + ' *').join(', ');
        rules.push(motion + ' { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important; }');
    }
    const titlePatterns = config.filterTitles.flatMap(source => {
        try {
            return [new RegExp(source, 'i')];
        } catch (error) {
            console.warn('[YouTube Filter] invalid title pattern', source, error.message);
            return [];
        }
    });
    const blockedChannels = new Set(config.filterChannels.map(name => name.trim().toLowerCase()));
    const filterCards = titlePatterns.length > 0 || blockedChannels.size > 0 || config.filterMinDuration > 0;
    const brandCards = config.replaceTitles || config.replaceThumbnails;
    hide(config.blockShorts || config.hideExplore || config.hideMoreFromYouTube || config.hideMostRelevant || filterCards, '[data-userscript-hidden]');
    if (config.gridItemsPerRow > 0 || config.blockShorts || config.hideMembersOnly || config.hideBuyOrRent || filterCards) rules.push('ytd-rich-grid-renderer > #contents > ytd-rich-item-renderer[rendered-from-rich-grid] { margin-left: calc(var(--ytd-rich-grid-item-margin) / 2) !important; margin-right: calc(var(--ytd-rich-grid-item-margin) / 2) !important; }');
    if (rules.length) {
        const style = document.createElement('style');
        style.textContent = rules.join('\n');
        if (document.documentElement) (document.head || document.documentElement).appendChild(style);
        else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style), { once: true });
    }

    // native css has no text selector for headings and filter chips
    const textSelector = [
        config.hideExplore || config.hideMoreFromYouTube ? 'ytd-guide-section-renderer #header, ytd-guide-section-renderer #header-heading, ytd-guide-section-renderer #guide-section-title' : '',
        config.hideMostRelevant ? ':is(ytd-rich-shelf-renderer, ytm-rich-shelf-renderer) :is(#title, h2)' : '',
        config.blockShorts ? 'yt-chip-cloud-chip-renderer, yt-chip-shape, chip-view-model, yt-tab-shape, tp-yt-paper-tab' : ''
    ].filter(Boolean).join(', ');
    function cleanText(element) {
        const label = element.textContent.trim().toLowerCase();
        const section = element.closest('ytd-guide-section-renderer');
        if (section && element.matches('#header, #header-heading, #guide-section-title')) {
            if (config.hideExplore && ['explore', 'entdecken'].includes(label) ||
                config.hideMoreFromYouTube && ['more from youtube', 'mehr von youtube'].includes(label)) {
                section.setAttribute('data-userscript-hidden', '');
            } else if (element.id === 'header-heading' || element.id === 'guide-section-title') section.removeAttribute('data-userscript-hidden');
        } else if (config.hideMostRelevant && element.matches('#title, h2')) {
            const shelf = element.closest('ytd-rich-section-renderer, ytm-rich-shelf-renderer');
            if (shelf) shelf.toggleAttribute('data-userscript-hidden',
                !!(location.pathname === '/feed/subscriptions' || shelf.closest('ytd-browse[page-subtype="subscriptions"]')) &&
                ['most relevant', 'am relevantesten'].includes(label));
        } else if (config.blockShorts) {
            element.toggleAttribute('data-userscript-hidden', label === 'shorts');
        }
    }

    function durationString(seconds) {
        const total = Math.max(0, Math.floor(seconds));
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor(total % 3600 / 60);
        return (hours ? hours + ':' + String(minutes).padStart(2, '0') : minutes) + ':' + String(total % 60).padStart(2, '0');
    }

    function processSegments(input) {
        const segments = [];
        let highlight = null;
        if (!Array.isArray(input)) return { segments, highlight, count: 0 };
        for (const item of input) {
            if (!item || !Array.isArray(item.segment) || !config.sponsorCategories.includes(item.category) ||
                !Number.isFinite(item.votes) || item.votes < config.sponsorMinVotes) continue;
            const [start, end] = item.segment;
            if (!Number.isFinite(start) || start < 0) continue;
            if (item.category === 'poi_highlight') {
                if (!highlight || item.votes > highlight.votes) highlight = { votes: item.votes, segment: [start, end] };
            } else if ((!item.actionType || item.actionType === 'skip') && Number.isFinite(end) && end > start) {
                segments.push({ category: item.category, segment: [start, end] });
            }
        }
        segments.sort((a, b) => a.segment[0] - b.segment[0]);
        const merged = [];
        for (const segment of segments) {
            const previous = merged[merged.length - 1];
            if (previous && segment.segment[0] <= previous.segment[1]) {
                previous.segment[1] = Math.max(previous.segment[1], segment.segment[1]);
                previous.category = 'combined';
            } else merged.push(segment);
        }
        return { segments: merged, highlight, count: segments.length };
    }

    async function hashPrefix(id) {
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)));
        return Array.from(hash.slice(0, 2), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    function start() {
        const theaterMode = config.theaterMode && location.hostname !== 'm.youtube.com' && !/^\/(?:embed|v)\//.test(location.pathname);
        const skipSponsors = config.sponsorBlock && config.sponsorCategories.length > 0;
        const quality = config.preferredQuality > 0;
        const trackVideo = theaterMode || skipSponsors || quality;
        if (!trackVideo && !textSelector && !config.blockShorts && !filterCards && !brandCards) return;
        if (textSelector) document.querySelectorAll(textSelector).forEach(cleanText);

        const playerSelector = '#movie_player video, #shorts-player video, video.html5-main-video';
        let videoId = '';
        let generation = 0;
        let request = null;
        let player = null;
        let data = { segments: [], highlight: null, count: 0 };
        let index = 0;
        let previousTime = -1;
        let theaterVideoId = '';
        let theaterTimer = null;
        let qualityVideoId = '';
        let highlightNotified = false;
        let notice = null;
        let noticeData = null;
        let noticeTimer = null;
        const cache = new Map();
        const categories = skipSponsors ? encodeURIComponent(JSON.stringify(config.sponsorCategories)) : '';

        function notify(details) {
            if (!config.sponsorNotifications) return;
            noticeData = details;
            const root = player?.closest('#movie_player, #shorts-player, .html5-video-player') || player?.parentElement;
            if (!root) return;
            if (!notice) {
                notice = document.createElement('div');
                notice.className = 'userscript-sponsor-notice';
                notice.setAttribute('role', 'status');
                notice.style.cssText = 'position:absolute;top:0;left:0;z-index:70;padding:5px;color:white;background:rgba(0,0,0,.8);font:14px/1.4 sans-serif;max-width:calc(100% - 10px);pointer-events:none;';
            }
            if (notice.parentElement !== root) {
                if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
                root.appendChild(notice);
            }
            notice.replaceChildren();
            let label = notice;
            if (details.onclick) {
                label = document.createElement('button');
                label.type = 'button';
                label.style.cssText = 'border:0;padding:0;color:inherit;background:none;font:inherit;text-align:left;cursor:pointer;pointer-events:auto;';
                label.onclick = event => { event.stopPropagation(); details.onclick(); };
                label.onkeydown = event => event.stopPropagation();
                notice.appendChild(label);
            }
            label.textContent = details.title;
            clearTimeout(noticeTimer);
            noticeTimer = setTimeout(() => {
                notice.remove();
                noticeData = null;
                noticeTimer = null;
            }, 5000);
        }

        function getVideoId() {
            const id = new URLSearchParams(location.search).get('v') || location.pathname.match(/^\/(?:embed|v|shorts|live)\/([\w-]{11})(?:\/|$)/)?.[1];
            return /^[\w-]{11}$/.test(id || '') ? id : '';
        }

        function applyTheater() {
            if (!videoId || theaterVideoId === videoId || document.fullscreenElement) return;
            const watch = document.querySelector('ytd-watch-flexy');
            if (!watch) return;
            if (watch.hasAttribute('full-bleed-player')) theaterVideoId = videoId;
            else {
                const button = watch.querySelector('button.ytp-size-button');
                if (button) {
                    button.click();
                    if (watch.hasAttribute('full-bleed-player')) theaterVideoId = videoId;
                }
            }
        }

        function scheduleTheater() {
            if (!theaterMode || theaterTimer !== null || theaterVideoId === videoId) return;
            // yt can reset the layout while initializing its player controls
            theaterTimer = setTimeout(() => {
                theaterTimer = null;
                applyTheater();
            }, 600);
        }

        const qualityHeights = { highres: 4320, hd2160: 2160, hd1440: 1440, hd1080: 1080, hd720: 720, large: 480, medium: 360, small: 240, tiny: 144 };
        function applyQuality() {
            if (!quality || qualityVideoId === videoId) return;
            const root = document.querySelector('#movie_player');
            // player methods are page objects, firefox content scripts only see them through wrappedJSObject
            const api = root?.wrappedJSObject || root;
            if (!api?.setPlaybackQualityRange || root.classList.contains('ad-showing') || api.getVideoData?.()?.video_id !== videoId) return;
            const levels = (api.getAvailableQualityLevels?.() || []).filter(level => qualityHeights[level]);
            if (!levels.length) return;
            // once per video so a manual quality change isnt reverted
            qualityVideoId = videoId;
            const sorted = levels.sort((a, b) => qualityHeights[b] - qualityHeights[a]);
            const choice = sorted.find(level => qualityHeights[level] <= config.preferredQuality) || sorted[sorted.length - 1];
            if (api.getPlaybackQuality?.() !== choice) api.setPlaybackQualityRange(choice, choice);
        }

        // inner cards hold the data, rich items are the grid cells that must be hidden
        const cardSelector = 'ytd-video-renderer, ytd-rich-grid-media, ytd-grid-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model';
        const cards = new WeakMap();
        const brandings = new Map();
        const brandingQueue = [];
        let brandingRequests = 0;
        let dirtyCards = new Set();

        function brandingRequest(path) {
            return new Promise(resolve => {
                const finish = text => {
                    brandingRequests--;
                    brandingQueue.shift()?.();
                    try {
                        resolve(text ? JSON.parse(text) : null);
                    } catch {
                        resolve(null);
                    }
                };
                const run = () => {
                    brandingRequests++;
                    try {
                        GM.xmlHttpRequest({
                            method: 'GET', url: 'https://' + config.sponsorServer + path, timeout: 10000, headers: { Accept: 'application/json' },
                            onload: response => finish(response.status === 200 ? response.responseText : ''),
                            onerror: () => finish(''), ontimeout: () => finish(''), onabort: () => finish('')
                        })?.catch?.(() => { });
                    } catch {
                        finish('');
                    }
                };
                // feeds can add dozens of cards at once
                if (brandingRequests < 4) run();
                else brandingQueue.push(run);
            });
        }

        function loadBranding(id) {
            let task = brandings.get(id);
            if (!task) {
                task = config.sponsorHashing
                    ? hashPrefix(id).then(prefix => brandingRequest('/api/branding/' + prefix)).then(result => result?.[id] || null)
                    : brandingRequest('/api/branding?videoID=' + id);
                brandings.set(id, task);
                if (brandings.size > 500) brandings.delete(brandings.keys().next().value);
            }
            return task;
        }

        function cardId(card) {
            return card.querySelector('a[href*="/watch?v="]')?.href.match(/[?&]v=([\w-]{11})/)?.[1] || '';
        }

        function titleNode(card) {
            const title = card.querySelector('#video-title, .ytLockupMetadataViewModelTitle');
            if (!title) return null;
            const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) if (walker.currentNode.data.trim()) return walker.currentNode;
            return null;
        }

        function applyBranding(card, id, branding) {
            const state = cards.get(card);
            // yt can recycle a card by changing only its link, so check the dom instead of the cached id
            if (!branding || state?.id !== id || !card.isConnected || cardId(card) !== id) return;
            const title = branding.titles?.[0];
            // the top submission is the original when the community kept the real title
            if (config.replaceTitles && title && !title.original && (title.locked || title.votes >= 0) && title.title) {
                const text = title.title.replace(/(^|\s)>(\S)/g, '$1$2');
                const node = titleNode(card);
                state.applied = text;
                // edit yt's own text node so its later updates still replace the title
                if (node && node.data !== text) node.data = text;
            }
            const thumbnail = branding.thumbnails?.[0];
            const replaceThumbnail = config.replaceThumbnails && thumbnail && !thumbnail.original && (thumbnail.locked || thumbnail.votes >= 0) && Number.isFinite(thumbnail.timestamp);
            const img = replaceThumbnail && card.querySelector('ytd-thumbnail img, yt-thumbnail-view-model img');
            if (!img) {
                if (replaceThumbnail) state.done = false;
                return;
            }
            const url = 'https://dearrow-thumb.ajay.app/api/v1/getThumbnail?videoID=' + id + '&time=' + thumbnail.timestamp;
            const swap = () => {
                if (cardId(card) !== id || img.getAttribute('src') === url) return;
                img.removeAttribute('srcset');
                img.src = url;
            };
            // the service answers 204 until a thumbnail was generated, keep the original then
            const test = new Image();
            // yt only sets src once the card is visible and would overwrite an earlier swap
            test.onload = () => img.getAttribute('src') ? swap() : img.addEventListener('load', swap, { once: true });
            test.src = url;
        }

        function processCard(card) {
            const id = cardId(card);
            if (!id) return;
            const text = titleNode(card)?.data.trim() || '';
            let state = cards.get(card);
            const changed = state?.id !== id;
            if (changed) cards.set(card, state = { id, original: text, applied: '', done: false });
            else if (text && text !== state.applied && text !== state.original) {
                state.original = text;
                state.applied = '';
                state.done = false;
            } else if (state.applied && text === state.original) state.done = false;
            else if (!filterCards) return;
            let hidden = false;
            if (filterCards) {
                const channel = card.querySelector('ytd-channel-name a, #channel-name a, .ytContentMetadataViewModelMetadataRow:first-child .ytContentMetadataViewModelMetadataText');
                const handle = card.querySelector('a[href^="/@"]')?.getAttribute('href').slice(1).split('/')[0];
                const duration = card.querySelector('ytd-thumbnail-overlay-time-status-renderer #text, yt-thumbnail-badge-view-model .ytBadgeShapeText')?.textContent.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
                hidden = titlePatterns.some(pattern => pattern.test(state.original)) ||
                    !!channel && blockedChannels.has(channel.textContent.trim().toLowerCase()) ||
                    !!handle && blockedChannels.has(decodeURIComponent(handle).toLowerCase()) ||
                    !!duration && (duration[1] || 0) * 3600 + duration[2] * 60 + +duration[3] < config.filterMinDuration;
                (card.closest('ytd-rich-item-renderer') || card).toggleAttribute('data-userscript-hidden', hidden);
            }
            // once per video and title
            if (brandCards && !hidden && !state.done) {
                state.done = true;
                void loadBranding(id).then(branding => applyBranding(card, id, branding));
            }
        }

        function flushCards() {
            const pending = dirtyCards;
            dirtyCards = new Set();
            pending.forEach(processCard);
        }

        function playback(event) {
            if (!player || player.paused || player.ended) return;
            const time = player.currentTime;
            if (time < previousTime || event.type === 'seeking') index = 0;
            while (index < data.segments.length && time >= data.segments[index].segment[1]) index++;
            const segment = data.segments[index];
            if (segment && time >= segment.segment[0]) {
                index++;
                player.currentTime = Math.min(segment.segment[1], Number.isFinite(player.duration) ? player.duration : Infinity);
                notify({ title: 'Skipped ' + segment.category + ' segment' });
            }
            previousTime = player.currentTime;
            if (!highlightNotified && data.highlight && player.currentTime < data.highlight.segment[0]) {
                highlightNotified = true;
                const currentId = videoId;
                const time = data.highlight.segment[0];
                notify({
                    title: 'Highlight at ' + durationString(time) + ' (jump)',
                    onclick: () => { if (videoId === currentId && player?.isConnected) player.currentTime = time; }
                });
            }
        }

        function bindPlayer(next) {
            if (player === next) return;
            if (player) for (const type of ['timeupdate', 'seeking', 'play']) player.removeEventListener(type, playback);
            player = next;
            notice?.remove();
            index = 0;
            previousTime = -1;
            if (player) {
                // requests can finish before youtube attaches the video
                if (noticeData) notify(noticeData);
                if (data.segments.length || data.highlight) for (const type of ['timeupdate', 'seeking', 'play']) player.addEventListener(type, playback);
                playback({ type: 'play' });
            }
        }

        async function loadSegments(id, revision) {
            try {
                const cached = cache.get(id);
                let result = cached && Date.now() - cached.at < 300000 ? cached.data : null;
                if (!result) {
                    let path;
                    if (!config.sponsorHashing) path = '/api/skipSegments?videoID=' + id + '&categories=' + categories;
                    else {
                        path = '/api/skipSegments/' + await hashPrefix(id) + '?categories=' + categories;
                    }
                    if (revision !== generation) return;
                    const response = await new Promise((resolve, reject) => {
                        request = GM.xmlHttpRequest({
                            method: 'GET', url: 'https://' + config.sponsorServer + path,
                            timeout: 10000, headers: { Accept: 'application/json' },
                            onload: resolve, onerror: () => reject(new Error('SponsorBlock request failed')),
                            ontimeout: () => reject(new Error('SponsorBlock request timed out')),
                            onabort: () => reject(new Error('SponsorBlock request cancelled'))
                        });
                        request?.catch?.(reject);
                    });
                    if (revision !== generation) return;
                    request = null;
                    if (response.status === 404) result = processSegments([]);
                    else {
                        if (response.status !== 200) throw new Error('SponsorBlock returned HTTP ' + response.status);
                        const payload = JSON.parse(response.responseText);
                        const segments = !config.sponsorHashing ? payload : Array.isArray(payload) ? payload.find(item => item.videoID === id)?.segments : [];
                        result = processSegments(segments);
                    }
                    cache.delete(id);
                    cache.set(id, { at: Date.now(), data: result });
                    if (cache.size > 20) cache.delete(cache.keys().next().value);
                }
                if (revision !== generation || getVideoId() !== id) return;
                data = result;
                // empty responses do not need playback event handlers
                if (player && (data.segments.length || data.highlight)) for (const type of ['timeupdate', 'seeking', 'play']) player.addEventListener(type, playback);
                index = 0;
                previousTime = -1;
                if (result.segments.length) notify({ title: 'Skippable segments found (' + result.count + ')' });
                playback({ type: 'play' });
            } catch (error) {
                if (revision === generation) {
                    request = null;
                    console.warn('[YouTube Skipper]', error.message);
                }
            }
        }

        function stopPlayback() {
            generation++;
            clearTimeout(theaterTimer);
            theaterTimer = null;
            request?.abort?.();
            request = null;
            clearTimeout(noticeTimer);
            noticeTimer = null;
            noticeData = null;
            bindPlayer(null);
            videoId = '';
            data = { segments: [], highlight: null, count: 0 };
            theaterVideoId = '';
            highlightNotified = false;
        }

        function navigate() {
            if (blockShortsRoute()) { stopPlayback(); return; }
            const nextId = trackVideo ? getVideoId() : '';
            if (nextId !== videoId) {
                stopPlayback();
                videoId = nextId;
                if (videoId && skipSponsors) void loadSegments(videoId, generation);
            }
            if (videoId) {
                if (skipSponsors) bindPlayer(document.querySelector(playerSelector));
                scheduleTheater();
                applyQuality();
            }
        }

        const cardWork = filterCards || brandCards;
        new MutationObserver(mutations => {
            let updateTheater = false;
            let nextPlayer = null;
            for (const mutation of mutations) {
                const textParent = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
                const textElement = textSelector && textParent?.closest(textSelector);
                if (textElement) cleanText(textElement);
                if (cardWork) {
                    const card = textParent?.closest(cardSelector);
                    if (card) dirtyCards.add(card);
                }
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (cardWork) {
                        if (node.matches(cardSelector)) dirtyCards.add(node);
                        if (node.firstElementChild) for (const card of node.querySelectorAll(cardSelector)) dirtyCards.add(card);
                    }
                    if (textSelector) {
                        if (node.matches(textSelector)) cleanText(node);
                        if (node.firstElementChild) node.querySelectorAll(textSelector).forEach(cleanText);
                    }
                    if (!videoId) continue;
                    if (skipSponsors) {
                        if (node.tagName === 'VIDEO' && node.matches(playerSelector)) nextPlayer = node;
                        else if (node.firstElementChild) nextPlayer ||= node.querySelector(playerSelector);
                    }
                    if (theaterMode && theaterVideoId !== videoId && (node.tagName === 'YTD-WATCH-FLEXY' || node.matches('button.ytp-size-button') || node.firstElementChild && node.querySelector('ytd-watch-flexy, button.ytp-size-button'))) updateTheater = true;
                }
            }
            if (player && !player.isConnected) bindPlayer(null);
            if (nextPlayer) bindPlayer(nextPlayer);
            if (updateTheater) scheduleTheater();
            if (dirtyCards.size) flushCards();
        }).observe(document.documentElement, { childList: true, subtree: true, characterData: !!textSelector || cardWork });
        if (cardWork) {
            document.querySelectorAll(cardSelector).forEach(card => dirtyCards.add(card));
            flushCards();
        }

        window.addEventListener('yt-navigate-start', stopPlayback);
        for (const type of ['yt-navigate-finish', 'popstate', 'pageshow']) window.addEventListener(type, navigate);
        if (trackVideo) document.addEventListener('loadedmetadata', event => {
            if (event.target.matches?.(playerSelector)) navigate();
        }, true);
        navigate();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
