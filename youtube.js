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
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.notification
// @grant        GM.registerMenuCommand
// @grant        GM.xmlHttpRequest
// @connect      *
// ==/UserScript==

// credits
// YouTube - Always Theater Mode (r-a-y)
// Simple Sponsor Skipper (mthsk)

(async function () {
    'use strict';

    //
    // Settings
    //
    const config = {
        theaterMode: true,
        skipSponsors: true,
        hideThumbnails: true,
        hideVoiceSearch: true,
        hideCreateButton: true,
        hideNotifications: true,
        hideFilterChips: true,
        hideJoin: true,
        hideSuperThanks: true,
        hideExplore: true,
        hideMoreFromYouTube: true,
        hideReportHistory: false,
        hideSidebarFooter: true,
        blockShorts: true
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
    hide(config.hideExplore, 'ytd-guide-section-renderer:has(a[href="/feed/trending"]), ytd-guide-section-renderer:has(a[href="/gaming"]), ytd-guide-section-renderer:has(a[href="/feed/explore"])');
    hide(config.hideMoreFromYouTube, 'ytd-guide-section-renderer:has(a[href^="https://www.youtube.com/premium"]), ytd-guide-section-renderer:has(a[href="/premium"]), ytd-guide-section-renderer:has(a[href^="https://music.youtube.com"]), ytd-guide-section-renderer:has(a[href^="https://www.youtubekids.com"])');
    hide(config.hideReportHistory, 'ytd-guide-entry-renderer:has(a[href^="/reporthistory"]), ytd-guide-entry-renderer:has(a[href^="https://www.youtube.com/reporthistory"])');
    hide(config.hideSidebarFooter, 'ytd-guide-renderer #footer, ytd-guide-renderer #guide-links-primary, ytd-guide-renderer #guide-links-secondary, ytd-guide-renderer #copyright');
    const shortsLink = 'a:is([href^="/shorts/"], [href^="https://www.youtube.com/shorts/"], [href^="https://m.youtube.com/shorts/"])';
    // spa guide buttons can have a title without an href
    hide(config.blockShorts, 'ytd-reel-shelf-renderer, ytd-reel-item-renderer, ytm-reel-shelf-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, yt-shorts-lockup-view-model, :is(ytd-rich-section-renderer, ytd-rich-shelf-renderer, .ytGridShelfViewModelHost, ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer, yt-lockup-view-model, ytm-media-item, ytm-video-with-context-renderer, ytm-compact-video-renderer):has(' + shortsLink + '), :is(ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer):has(a:is([href^="/shorts"], [href$="/shorts"], [title="Shorts"], [aria-label="Shorts"])), .pivot-shorts, yt-tab-shape:has(a[href$="/shorts"]), [data-nohuto-hidden]');
    if (config.hideExplore || config.hideMoreFromYouTube) rules.push('ytd-guide-section-renderer[data-nohuto-hidden] { display: none !important; }');
    const style = document.createElement('style');
    style.textContent = rules.join('\n');
    if (document.documentElement) (document.head || document.documentElement).appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style), { once: true });

    // native css has no text selector for headings and filter chips
    const textSelector = 'ytd-guide-section-renderer #header, ytd-guide-section-renderer #header-heading, ytd-guide-section-renderer #guide-section-title, yt-chip-cloud-chip-renderer, yt-chip-shape, chip-view-model, yt-tab-shape, tp-yt-paper-tab';
    function cleanText(element) {
        const label = element.textContent.trim().toLowerCase();
        const section = element.closest('ytd-guide-section-renderer');
        if (section && element.matches('#header, #header-heading, #guide-section-title')) {
            if (config.hideExplore && ['explore', 'entdecken'].includes(label) ||
                config.hideMoreFromYouTube && ['more from youtube', 'mehr von youtube'].includes(label)) {
                section.setAttribute('data-nohuto-hidden', '');
            } else if (element.id === 'header-heading' || element.id === 'guide-section-title') section.removeAttribute('data-nohuto-hidden');
        } else if (config.blockShorts) {
            element.toggleAttribute('data-nohuto-hidden', label === 'shorts');
        }
    }

    const defaults = {
        categories: ['preview', 'sponsor', 'outro', 'music_offtopic', 'selfpromo', 'poi_highlight', 'interaction', 'intro'],
        upvotes: -2, notifications: true, disable_hashing: false,
        instance: 'sponsor.ajay.app', darkmode: -1
    };
    const stored = await GM.getValue('s3settings');
    const settings = { ...defaults, ...stored };
    if (Number.isInteger(settings.categories)) {
        const categories = ['sponsor', 'intro', 'outro', 'interaction', 'selfpromo', 'preview', 'music_offtopic', 'filler'];
        settings.categories = categories.filter((category, index) => settings.categories & (1 << index));
        if (settings.notifications) settings.categories.push('poi_highlight');
        await GM.setValue('s3settings', settings);
    }
    if (!Array.isArray(settings.categories)) settings.categories = [...defaults.categories];
    if (!stored) await GM.setValue('s3settings', settings);

    function notify(details) {
        if (settings.notifications && typeof GM.notification === 'function') {
            GM.notification({ silent: true, timeout: 5000, ...details });
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
            if (!item || !Array.isArray(item.segment) || !settings.categories.includes(item.category) ||
                !Number.isFinite(item.votes) || item.votes < settings.upvotes) continue;
            const [start, end] = item.segment;
            if (!Number.isFinite(start) || start < 0) continue;
            if (item.category === 'poi_highlight') {
                if (!highlight || item.votes > highlight.votes) highlight = { ...item, segment: [start, end] };
            } else if ((!item.actionType || item.actionType === 'skip') && Number.isFinite(end) && end > start) {
                segments.push({ ...item, segment: [start, end] });
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

    function showSettings() {
        const categoryLabels = {
            sponsor: 'Sponsors', intro: 'Intros', outro: 'Outros', interaction: 'Interaction reminders',
            selfpromo: 'Self-promotion', preview: 'Previews', music_offtopic: 'Non-music sections', filler: 'Filler'
        };
        document.body.replaceChildren();
        document.title = 'YouTube Theater & Sponsor Skipper settings';
        const style = document.createElement('style');
        style.textContent = 'body { max-width: 36rem; margin: 3rem auto; padding: 0 1rem; font: 16px system-ui; background: white; color: #222; } label { display: block; margin: .8rem 0; } input, select, button { font: inherit; } button { margin-right: 1rem; } .dark-theme { background: #171717; color: #eee; }';
        document.head.appendChild(style);
        const heading = document.createElement('h1');
        heading.textContent = 'YouTube settings';
        document.body.appendChild(heading);
        const form = document.createElement('form');
        document.body.appendChild(form);
        const controls = {};
        function field(id, labelText, type, value) {
            const label = document.createElement('label');
            const input = document.createElement('input');
            input.id = id;
            input.type = type;
            if (type === 'checkbox') input.checked = value;
            else input.value = value;
            label.append(input, document.createTextNode(' ' + labelText));
            form.appendChild(label);
            controls[id] = input;
        }
        for (const [category, label] of Object.entries(categoryLabels)) {
            field(category, 'Skip ' + label.toLowerCase(), 'checkbox', settings.categories.includes(category));
        }
        field('upvotes', 'Minimum segment votes', 'number', settings.upvotes);
        field('notifications', 'Desktop notifications and highlight suggestions', 'checkbox', settings.notifications);
        field('disable_hashing', 'Send video ID instead of a hash prefix', 'checkbox', settings.disable_hashing);
        field('instance', 'SponsorBlock server hostname', 'text', settings.instance);
        const themeLabel = document.createElement('label');
        themeLabel.textContent = 'Theme ';
        const theme = document.createElement('select');
        theme.id = 'darkmode';
        for (const [value, label] of [[-1, 'Auto'], [0, 'Light'], [1, 'Dark']]) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            theme.appendChild(option);
        }
        theme.value = settings.darkmode;
        const updateTheme = () => document.body.classList.toggle('dark-theme', theme.value === '1' || (theme.value === '-1' && matchMedia('(prefers-color-scheme: dark)').matches));
        theme.addEventListener('change', updateTheme);
        updateTheme();
        themeLabel.appendChild(theme);
        form.appendChild(themeLabel);
        const save = document.createElement('button');
        save.id = 'btnsave';
        save.textContent = 'Save settings';
        const close = document.createElement('button');
        close.id = 'btnclose';
        close.type = 'button';
        close.textContent = 'Close';
        close.addEventListener('click', () => location.replace(location.href.split('#')[0]));
        form.append(save, close);
        form.addEventListener('submit', async event => {
            event.preventDefault();
            try {
                const instance = new URL('https://' + controls.instance.value.trim());
                if (instance.username || instance.password || instance.port || instance.pathname !== '/' || instance.search || instance.hash) throw new Error('Enter a server hostname.');
                const upvotes = Number(controls.upvotes.value);
                if (!Number.isInteger(upvotes)) throw new Error('Enter a whole number of votes.');
                settings.categories = Object.keys(categoryLabels).filter(category => controls[category].checked);
                settings.notifications = controls.notifications.checked;
                if (settings.notifications) settings.categories.push('poi_highlight');
                settings.upvotes = upvotes;
                settings.disable_hashing = controls.disable_hashing.checked;
                settings.instance = instance.hostname;
                settings.darkmode = Number(theme.value);
                await GM.setValue('s3settings', settings);
                save.textContent = 'Saved';
            } catch (error) { save.textContent = error.message; }
        });
    }

    function start() {
        if (window.self === window.top && typeof GM.registerMenuCommand === 'function') {
            GM.registerMenuCommand('Configuration', () => {
                location.hash = 's3config';
                location.reload();
            });
        }
        if (location.hash.toLowerCase() === '#s3config') {
            showSettings();
            return;
        }
        if (!config.theaterMode && !config.skipSponsors && !config.blockShorts && !config.hideExplore && !config.hideMoreFromYouTube) return;
        document.querySelectorAll(textSelector).forEach(cleanText);

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
        const cache = new Map();

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
            if (!config.theaterMode || theaterTimer !== null || theaterVideoId === videoId) return;
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
                notify({ title: 'Skipped ' + segment.category + ' segment', text: document.title });
            }
            previousTime = player.currentTime;
            if (!highlightNotified && data.highlight && player.currentTime < data.highlight.segment[0]) {
                highlightNotified = true;
                const currentId = videoId;
                const time = data.highlight.segment[0];
                notify({
                    title: 'Point of interest found', text: 'Highlight at ' + durationString(time) + '\n' + document.title,
                    onclick: () => { if (videoId === currentId && player?.isConnected) player.currentTime = time; }
                });
            }
        }

        function bindPlayer(next) {
            if (player === next) return;
            if (player) for (const type of ['timeupdate', 'seeking', 'play']) player.removeEventListener(type, playback);
            player = next;
            index = 0;
            previousTime = -1;
            if (player) {
                for (const type of ['timeupdate', 'seeking', 'play']) player.addEventListener(type, playback);
                playback({ type: 'play' });
            }
        }

        async function loadSegments(id, revision) {
            try {
                const cached = cache.get(id);
                let result = cached && Date.now() - cached.at < 300000 ? cached.data : null;
                if (!result) {
                    const categories = encodeURIComponent(JSON.stringify(settings.categories));
                    let path;
                    if (settings.disable_hashing) path = '/api/skipSegments?videoID=' + id + '&categories=' + categories;
                    else {
                        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)));
                        const prefix = Array.from(hash.slice(0, 2), byte => byte.toString(16).padStart(2, '0')).join('');
                        path = '/api/skipSegments/' + prefix + '?categories=' + categories;
                    }
                    if (revision !== generation) return;
                    const response = await new Promise((resolve, reject) => {
                        request = GM.xmlHttpRequest({
                            method: 'GET', url: 'https://' + settings.instance + path,
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
                        const segments = settings.disable_hashing ? payload : Array.isArray(payload) ? payload.find(item => item.videoID === id)?.segments : [];
                        result = processSegments(segments);
                    }
                    cache.delete(id);
                    cache.set(id, { at: Date.now(), data: result });
                    if (cache.size > 20) cache.delete(cache.keys().next().value);
                }
                if (revision !== generation || getVideoId() !== id) return;
                data = result;
                index = 0;
                previousTime = -1;
                if (result.segments.length && window.self === window.top) notify({ title: 'Skippable segments found', text: result.count + ' segments, ' + result.segments.length + ' after merging\n' + document.title });
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
            bindPlayer(null);
            videoId = '';
            data = { segments: [], highlight: null, count: 0 };
            theaterVideoId = '';
            highlightNotified = false;
        }

        function navigate() {
            if (blockShortsRoute()) { stopPlayback(); return; }
            const nextId = config.theaterMode || config.skipSponsors ? getVideoId() : '';
            if (nextId !== videoId) {
                stopPlayback();
                videoId = nextId;
                if (videoId && config.skipSponsors) void loadSegments(videoId, generation);
            }
            if (videoId) {
                bindPlayer(document.querySelector(playerSelector));
                scheduleTheater();
            }
        }

        new MutationObserver(mutations => {
            let updateTheater = false;
            let nextPlayer = null;
            for (const mutation of mutations) {
                const textParent = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
                const textElement = textParent?.closest(textSelector);
                if (textElement) cleanText(textElement);
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.matches(textSelector)) cleanText(node);
                    if (node.firstElementChild) node.querySelectorAll(textSelector).forEach(cleanText);
                    if (!videoId) continue;
                    if (node.tagName === 'VIDEO' && node.matches(playerSelector)) nextPlayer = node;
                    else if (node.firstElementChild) nextPlayer ||= node.querySelector(playerSelector);
                    if (theaterVideoId !== videoId && (node.tagName === 'YTD-WATCH-FLEXY' || node.matches('button.ytp-size-button') || node.firstElementChild && node.querySelector('ytd-watch-flexy, button.ytp-size-button'))) updateTheater = true;
                }
            }
            if (player && !player.isConnected) bindPlayer(null);
            if (nextPlayer) bindPlayer(nextPlayer);
            if (updateTheater) scheduleTheater();
        }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

        window.addEventListener('yt-navigate-start', stopPlayback);
        for (const type of ['yt-navigate-finish', 'popstate', 'pageshow']) window.addEventListener(type, navigate);
        document.addEventListener('loadedmetadata', event => {
            if (event.target.matches?.(playerSelector)) navigate();
        }, true);
        navigate();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
