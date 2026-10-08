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

//
// credits
//
// YouTube - Always Theater Mode (r-a-y)
// Simple Sponsor Skipper (mthsk)

(function () {
    'use strict';

    //
    // Settings
    //
    const config = {
        theaterMode: true, // bool (desktop watch pages)
        skipSponsors: true, // bool
        sponsorCategories: ['preview', 'sponsor', 'outro', 'music_offtopic', 'selfpromo', 'poi_highlight', 'interaction', 'intro'], // string[] (category ids to skip/highlight, [] = none)
        sponsorMinVotes: -2, // number (minimum segment votes, negatives allowed)
        sponsorNotifications: true, // bool (notices inside the player)
        sponsorHashing: true, // bool (true sends a hash prefix, false sends the video id)
        sponsorServer: 'sponsor.ajay.app', // string (api hostname without scheme/path)
        hideThumbnails: false, // bool
        hideVoiceSearch: true, // bool
        hideCreateButton: true, // bool
        hideNotifications: true, // bool
        hideFilterChips: true, // bool (content filter bars)
        hideJoin: true, // bool (membership buttons)
        hideSuperThanks: true, // bool (thanks donation buttons)
        hideComments: true, // bool
        hideDescription: false, // bool (description box with views and upload date)
        hideRelatedVideos: true, // bool (recommended videos beside/below the player)
        hideMostRelevant: true, // bool (most relevant in subscriptions)
        hideExplore: true, // bool (entire explore sidebar section)
        hideMoreFromYouTube: true, // bool (entire more from youtube section)
        hideReportHistory: false, // bool
        hideSidebarFooter: true, // bool
        blockShorts: true // bool
    };

    function blockShortsRoute() {
        if (!config.blockShorts || !/\/shorts(?:\/|$)/.test(location.pathname)) return false;
        location.replace(location.origin + '/');
        return true;
    }
    if (blockShortsRoute()) return;

    const rules = [];
    function hide(enabled, selectors) {
        if (enabled) rules.push(selectors + ' { display: none !important; }');
    }
    hide(config.hideThumbnails, 'ytd-thumbnail:not(.player-container-background-image), yt-thumbnail-view-model, yt-collection-thumbnail-view-model, .ytLockupViewModelContentImage, ytd-playlist-thumbnail, ytd-moving-thumbnail-renderer, ytd-video-preview, ytm-media-item .media-item-thumbnail-container, ytm-video-with-context-renderer .video-thumbnail-container-large, ytm-compact-video-renderer .video-thumbnail-container-compact');
    if (config.hideThumbnails) rules.push('.ytLockupViewModelMetadata { width: 100% !important; margin-left: 0 !important; }');
    hide(config.hideVoiceSearch, '#voice-search-button, ytm-masthead .voice-search-button');
    hide(config.hideCreateButton, 'yt-create-button-view-model, ytd-masthead ytd-button-renderer:has([aria-label="Create"]), ytd-masthead ytd-topbar-menu-button-renderer:has([aria-label="Create"]), ytd-masthead ytd-button-renderer:has([aria-label="Erstellen"]), ytd-masthead ytd-topbar-menu-button-renderer:has([aria-label="Erstellen"]), ytd-masthead a[href^="https://studio.youtube.com/channel/"][href$="/videos/upload"]');
    hide(config.hideNotifications, 'ytd-notification-topbar-button-renderer, yt-notification-topbar-button-view-model, ytd-masthead :is(ytd-topbar-menu-button-renderer, button-view-model):has([aria-label^="Notifications"]), ytd-masthead :is(ytd-topbar-menu-button-renderer, button-view-model):has([aria-label^="Benachrichtigungen"])');
    hide(config.hideFilterChips, 'ytd-feed-filter-chip-bar-renderer, chip-bar-view-model, yt-chip-cloud-renderer, ytd-chip-cloud-renderer, yt-chip-cloud-view-model, ytm-chip-cloud-renderer, #chips-wrapper.ytd-watch-next-secondary-results-renderer');
    // the shared header background still reserves the chip bar height
    if (config.hideFilterChips) rules.push('ytd-app #frosted-glass { height: var(--ytd-masthead-height, 56px) !important; }');
    hide(config.hideJoin, '#sponsor-button, #join-button, :is(ytd-button-renderer, button-view-model, yt-button-view-model, yt-button-shape, .ytFlexibleActionsViewModelAction):has(button:is([aria-label="Join"], [aria-label^="Join this channel"], [aria-label="Mitglied werden"], [aria-label="Beitreten"]))');
    hide(config.hideSuperThanks, ':is(ytd-button-renderer, button-view-model, yt-button-view-model, yt-button-shape, .ytFlexibleActionsViewModelAction):has(button:is([aria-label="Thanks"], [aria-label*="Super Thanks"], [aria-label="Danke"], [aria-label*="Super-Dank"]))');
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
    hide(config.hideSidebarFooter, 'ytd-guide-renderer #footer, ytd-guide-renderer #guide-links-primary, ytd-guide-renderer #guide-links-secondary, ytd-guide-renderer #copyright');
    const shortsLink = 'a:is([href^="/shorts/"], [href^="https://www.youtube.com/shorts/"], [href^="https://m.youtube.com/shorts/"])';
    // spa guide buttons can have a title without an href
    hide(config.blockShorts, 'ytd-reel-shelf-renderer, ytd-reel-item-renderer, ytm-reel-shelf-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, yt-shorts-lockup-view-model, :is(ytd-rich-section-renderer, ytd-rich-shelf-renderer, .ytGridShelfViewModelHost, ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer, yt-lockup-view-model, ytm-media-item, ytm-video-with-context-renderer, ytm-compact-video-renderer):has(' + shortsLink + '), :is(ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer):has(a:is([href^="/shorts"], [href$="/shorts"], [title="Shorts"], [aria-label="Shorts"])), .pivot-shorts, yt-tab-shape:has(a[href$="/shorts"])');
    hide(config.blockShorts || config.hideExplore || config.hideMoreFromYouTube || config.hideMostRelevant, '[data-userscript-hidden]');
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

    function start() {
        const theaterMode = config.theaterMode && location.hostname !== 'm.youtube.com' && !/^\/(?:embed|v)\//.test(location.pathname);
        const skipSponsors = config.skipSponsors && config.sponsorCategories.length > 0;
        if (!theaterMode && !skipSponsors && !textSelector && !config.blockShorts) return;
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
                        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)));
                        const prefix = Array.from(hash.slice(0, 2), byte => byte.toString(16).padStart(2, '0')).join('');
                        path = '/api/skipSegments/' + prefix + '?categories=' + categories;
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
            const nextId = theaterMode || skipSponsors ? getVideoId() : '';
            if (nextId !== videoId) {
                stopPlayback();
                videoId = nextId;
                if (videoId && skipSponsors) void loadSegments(videoId, generation);
            }
            if (videoId) {
                if (skipSponsors) bindPlayer(document.querySelector(playerSelector));
                scheduleTheater();
            }
        }

        new MutationObserver(mutations => {
            let updateTheater = false;
            let nextPlayer = null;
            for (const mutation of mutations) {
                const textParent = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
                const textElement = textSelector && textParent?.closest(textSelector);
                if (textElement) cleanText(textElement);
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
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
        }).observe(document.documentElement, { childList: true, subtree: true, characterData: !!textSelector });

        window.addEventListener('yt-navigate-start', stopPlayback);
        for (const type of ['yt-navigate-finish', 'popstate', 'pageshow']) window.addEventListener(type, navigate);
        if (theaterMode || skipSponsors) document.addEventListener('loadedmetadata', event => {
            if (event.target.matches?.(playerSelector)) navigate();
        }, true);
        navigate();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
