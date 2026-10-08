// ==UserScript==
// @name         Twitch Script
// @namespace    nohuto/userscripts
// @version      0.0.1.0
// @description  Make Twitch usable
// @author       nohuto
// @license      MIT
// @match        https://www.twitch.tv/*
// @match        https://player.twitch.tv/*
// @match        https://embed.twitch.tv/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

//
// credits
//
// Twitch UI Cleaner (salaminha)
// Carousel Removal (liquidjesus)
// Twitch - Keep Tab Active (vikindor)
// TwitchAdSolutions (ryanbr)
// VideoAdBlockForTwitch (cleanlock & contributors)

(function () {
    'use strict';

    //
    // Settings
    //
    const config = {
        hideStories: true, // bool
        hideRecommendedCategories: true, // bool (hides suggested games, keeps channels)
        removeCarousel: true, // bool
        hidePromoButtons: true, // bool (bits & prime promotions)
        hideExtensionBanner: true, // bool
        hideWhispers: true, // bool
        hideNotifications: true, // bool
        hideShareButton: true, // bool (channel share button)
        hideDropsHighlights: true, // bool (drops reward cards above chat)
        hideGiftedSubHighlights: true, // bool (gifted sub cards above chat)
        hideHypeTrain: true, // bool
        hideSubscribe: true, // bool
        hideGiftSub: true, // bool
        hideGoals: true, // bool (channel goals heading & cards)
        hideChannelPanels: true, // bool (custom panels below about box)
        hideLeaderboard: true, // bool (entire bar above chat)
        blockAds: true, // bool
        keepTabActive: true // bool (keep playback active in background tabs)
    };

    config.blockAds && function () {
        const nativeHiddenGetter = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')?.get;
        // only player frames need interception and clip pages do not use live playlists
        if (window.self !== window.top && location.hostname === 'www.twitch.tv' && !location.pathname.startsWith('/embed/')) return;
        if (/^\/[^/]+\/clip\/[^/]+/.test(location.pathname)) return;
        // serialize helpers and defaults because workers have a separate global scope
        function declareOptions(scope) {
            scope.AdSignifiers = ['stitched-ad', 'EXT-X-CUE-OUT', 'twitch-stitched', 'EXT-X-DATERANGE:CLASS="twitch-maf-ad"', 'EXT-X-DATERANGE:CLASS="twitch-trigger"'];
            scope.AdSegmentURLPatterns = ['/adsquared/', '/_404/', '/processing'];
            scope.TwitchAdUrlRewriteRegex = /(X-TV-TWITCH-AD(?:-[A-Z]+)*-URLS?=")[^"]*(")/g;
            scope.UriAttributeRegex = /URI="([^"]+)"/;
            scope.ClientID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
            scope.BackupPlayerTypes = ['site', 'popout', 'mobile_web', 'embed'];
            scope.FallbackPlayerType = 'site';
            scope.ForceAccessTokenPlayerType = 'popout';
            scope.ReloadCooldownSeconds = 30;
            scope.DriftCorrectionRate = 1.1;
            scope.EarlyReloadPollThreshold = 3;
            scope.PlayerReloadMinimalRequestsTime = 1500;
            scope.PlayerReloadMinimalRequestsPlayerIndex = 2;
            scope.HasTriggeredPlayerReload = false;
            scope.StreamInfos = Object.create(null);
            scope.StreamInfosByUrl = Object.create(null);
            scope.GQLDeviceID = null;
            scope.ClientVersion = null;
            scope.ClientSession = null;
            scope.ClientIntegrityHeader = null;
            scope.AuthorizationHeader = void 0;
            scope.PlayerBufferingDelay = 600;
            scope.PlayerBufferingSameStateCount = 3;
            scope.PlayerBufferingDangerZone = .5;
            scope.PlayerBufferingMinRepeatDelay = 8e3;
            scope.V2API = false;
            scope.AdSegmentCache = new Map;
            scope.StreamInfoMaxAgeMs = 30 * 60 * 1e3;
        }
        function pruneStreamInfos() {
            // channel navigation leaves old playlist mappings behind in a long lived worker
            const now = Date.now();
            for (const channelName in StreamInfos) {
                const streamInfo = StreamInfos[channelName];
                if (!streamInfo || !streamInfo.LastSeenAt || now - streamInfo.LastSeenAt > StreamInfoMaxAgeMs) {
                    if (streamInfo && streamInfo.Urls) for (const url in streamInfo.Urls) delete StreamInfosByUrl[url];
                    delete StreamInfos[channelName];
                }
            }
        }
        function createStreamInfo(channelName, encodingsM3u8, usherParams) {
            return {
                ChannelName: channelName,
                LastSeenAt: Date.now(),
                EncodingsM3U8: encodingsM3u8,
                UsherParams: usherParams,
                Urls: Object.create(null),
                ResolutionList: [],
                RequestedAds: new Set,
                ModifiedM3U8: null,
                IsUsingModifiedM3U8: false,
                IsShowingAd: false,
                IsMidroll: false,
                PodLength: 1,
                CleanPlaylistCount: 0,
                PendingAdEndAt: 0,
                IsStrippingAdSegments: false,
                NumStrippedAdSegments: 0,
                RecoverySegments: [],
                RecoveryStartSeq: void 0,
                ConsecutiveAllStrippedPolls: 0,
                TotalAllStrippedPolls: 0,
                LastCleanNativeM3U8: null,
                LastCleanNativePlaylistAt: 0,
                BackupEncodingsM3U8Cache: Object.create(null),
                ActiveBackupPlayerType: null,
                PinnedBackupPlayerType: null,
                LastCommittedBackupPlayerType: null,
                FailedBackupPlayerTypes: new Map,
                ContaminatedBackupPlayerTypes: null,
                CycleRescuedThisBreak: false,
                EarlyReloadCount: 0,
                EarlyReloadTriggered: false,
                EarlyReloadAwaitingResult: false,
                LastBreakUsedEscapeHatch: false,
                FastAutoplayConsecutive: 0,
                LastPlayerReload: 0,
                ReloadTimestamps: []
            };
        }
        function maskAsNative(fn, name) {
            fn.toString = () => 'function ' + name + '() { [native code] }';
            return fn;
        }
        let isActivelyStrippingAds = false;
        let nativeFetch;
        let twitchWorker = null;
        let cachedRootNode = null;
        let cachedPlayerRootDiv = null;
        let cachedPlayerAndState = null;
        let cachedPlayerVideo = null;
        let cachedPlayerPath = '';

        let injectedBlobUrl = null;
        let originalRevokeObjectURL = null;
        function hookWindowWorker() {
            if (!URL.revokeObjectURL.__tasMasked) {
                originalRevokeObjectURL = URL.revokeObjectURL;
                URL.revokeObjectURL = maskAsNative(function (url) {
                    // twitch must not revoke the active injected worker blob before it starts
                    if (url === injectedBlobUrl) return;
                    return originalRevokeObjectURL.call(this, url);
                }, 'revokeObjectURL');
                URL.revokeObjectURL.__tasMasked = true;
            }
            // inherit existing worker hooks without editing their prototype chains
            const NativeWorker = window.Worker;
            const newWorker = class extends NativeWorker {
                constructor(twitchBlobUrl, options) {
                    let isTwitchWorker = false;
                    try {
                        isTwitchWorker = new URL(twitchBlobUrl).origin.endsWith('.twitch.tv');
                    } catch { }
                    if (!isTwitchWorker) {
                        super(twitchBlobUrl, options);
                        return;
                    }
                    // fall back to the original worker if its source cannot be loaded
                    let prefetchedWorkerJs = null;
                    try {
                        prefetchedWorkerJs = getWasmWorkerJs(twitchBlobUrl);
                    } catch { }
                    if (!prefetchedWorkerJs) {
                        super(twitchBlobUrl, options);
                        return;
                    }
                    const alreadyHooked = prefetchedWorkerJs.includes('hookWorkerFetch');
                    const newBlobStr = alreadyHooked ? null : `
    const pendingFetchRequests = new Map();
    ${hasAdTags.toString()}
    ${stripAdSegments.toString()}
    ${videoCodecFamily.toString()}
    ${getStreamUrlForResolution.toString()}
    ${processM3U8.toString()}
    ${hookWorkerFetch.toString()}
    ${declareOptions.toString()}
    ${getAccessToken.toString()}
    ${gqlRequest.toString()}
    ${parseAttributes.toString()}
    ${getServerTimeFromM3u8.toString()}
    ${replaceServerTimeInM3u8.toString()}
    ${pruneStreamInfos.toString()}
    ${createStreamInfo.toString()}
    // reuse the source fetched by the constructor instead of issuing another synchronous request
    const workerString = ${JSON.stringify(prefetchedWorkerJs)};
    declareOptions(self);
    GQLDeviceID = ${JSON.stringify(GQLDeviceID)};
    AuthorizationHeader = ${JSON.stringify(AuthorizationHeader)};
    ClientIntegrityHeader = ${JSON.stringify(ClientIntegrityHeader)};
    ClientVersion = ${JSON.stringify(ClientVersion)};
    ClientSession = ${JSON.stringify(ClientSession)};
    self.addEventListener('message', function(e) {
        if (e.data.key == 'UpdateClientVersion') {
            ClientVersion = e.data.value;
        } else if (e.data.key == 'UpdateClientSession') {
            ClientSession = e.data.value;
        } else if (e.data.key == 'UpdateDeviceId') {
            GQLDeviceID = e.data.value;
        } else if (e.data.key == 'UpdateClientIntegrityHeader') {
            ClientIntegrityHeader = e.data.value;
        } else if (e.data.key == 'UpdateAuthorizationHeader') {
            AuthorizationHeader = e.data.value;
        } else if (e.data.key == 'FetchResponse') {
            const responseData = e.data.value;
            const pending = pendingFetchRequests.get(responseData.id);
            if (pending) {
                const { resolve, reject, timeoutId } = pending;
                clearTimeout(timeoutId);
                pendingFetchRequests.delete(responseData.id);
                if (responseData.error) {
                    reject(new Error(responseData.error));
                } else try {
                    const body = [204, 205, 304].includes(responseData.status) ? null : responseData.body;
                    const response = new Response(body, {
                        status: responseData.status,
                        statusText: responseData.statusText,
                        headers: responseData.headers
                    });
                    Object.defineProperties(response, {
                        url: { value: responseData.url || '', configurable: true },
                        redirected: { value: !!responseData.redirected, configurable: true },
                        type: { value: responseData.type || 'basic', configurable: true }
                    });
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            }
        } else if (e.data.key == 'TriggeredPlayerReload') {
            HasTriggeredPlayerReload = true;
        } else if (e.data.key == 'ReloadSkipped') {
            for (const channel in StreamInfos) {
                const si = StreamInfos[channel];
                if (si && si.EarlyReloadTriggered) {
                    si.EarlyReloadTriggered = false;
                    si.EarlyReloadAwaitingResult = false;
                    si.EarlyReloadCount = Math.max(0, (si.EarlyReloadCount || 0) - 1);
                }
            }
        }
    });
    hookWorkerFetch();
    try { eval(workerString); } catch (e) { console.error('[AD DEBUG] Worker eval failed — Twitch player logic not loaded:', e); }
`;
                    if (alreadyHooked) super(twitchBlobUrl, options); else {
                        // release the previous blob when react replaces its player worker
                        if (injectedBlobUrl && originalRevokeObjectURL) try {
                            originalRevokeObjectURL.call(URL, injectedBlobUrl);
                        } catch { }
                        injectedBlobUrl = URL.createObjectURL(new Blob([newBlobStr]));
                        super(injectedBlobUrl, options);
                    }
                    twitchWorker = this;
                    this.addEventListener('message', e => {
                        if (e.data.key == 'UpdateAdBlockBanner') {
                            updateAdblockBanner(e.data);
                            if (e.data.hasAds !== !!playerBufferState.inAdBreak) {
                                playerBufferState.lastBackupSwitchAt = Date.now();
                                e.data.hasAds || (playerBufferState.position = 0);
                            }
                            playerBufferState.inAdBreak = !!e.data.hasAds;
                            if (e.data.hasAds && (driftCatchUpInterval || driftCatchUpTimeout)) {
                                if (driftCatchUpInterval) {
                                    clearInterval(driftCatchUpInterval);
                                    driftCatchUpInterval = null;
                                }
                                if (driftCatchUpTimeout) {
                                    clearTimeout(driftCatchUpTimeout);
                                    driftCatchUpTimeout = null;
                                }
                                try {
                                    getPlayerVideoElement().playbackRate = 1;
                                } catch { }
                            }
                        } else e.data.key == 'PauseResumePlayer' ? doTwitchPlayerTask(true, false) : e.data.key == 'ReloadPlayer' && doTwitchPlayerTask(false, true, e.data.kind);
                    });
                    this.addEventListener('message', async event => {
                        if (event.data.key == 'FetchRequest') {
                            const fetchRequest = event.data.value;
                            const responseData = await handleWorkerFetchRequest(fetchRequest);
                            this.postMessage({
                                key: 'FetchResponse',
                                value: responseData
                            });
                        }
                    });
                    let crashed = false;
                    this.addEventListener('error', e => {
                        if (crashed) return;
                        crashed = true;
                        try {
                            doTwitchPlayerTask(false, true, 'early');
                        } catch (err) { }
                    });
                }
            };
            window.Worker = newWorker;
        }
        function getWasmWorkerJs(twitchBlobUrl) {
            // constructors are synchronous and only the latest worker source needs caching
            if (getWasmWorkerJs.url === twitchBlobUrl) return getWasmWorkerJs.source;
            const req = new XMLHttpRequest;
            req.open('GET', twitchBlobUrl, false);
            req.overrideMimeType('text/javascript');
            req.send();
            getWasmWorkerJs.url = twitchBlobUrl;
            return getWasmWorkerJs.source = req.responseText;
        }
        function hookWorkerFetch() {
            // a valid empty mp4 keeps the decoder alive when a cached ad segment is requested
            const BLANK_MP4 = new Blob([Uint8Array.from(atob('AAAAKGZ0eXBtcDQyAAAAAWlzb21tcDQyZGFzaGF2YzFpc282aGxzZgAABEltb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAYagAAAAAAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAABqHRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAURtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAALuAAAAAAFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAADvbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAACzc3RibAAAAGdzdHNkAAAAAAAAAAEAAABXbXA0YQAAAAAAAAABAAAAAAAAAAAAAgAQAAAAALuAAAAAAAAzZXNkcwAAAAADgICAIgABAASAgIAUQBUAAAAAAAAAAAAAAAWAgIACEZAGgICAAQIAAAAQc3R0cwAAAAAAAAAAAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAAAAAAAAAAAEHN0Y28AAAAAAAAAAAAAAeV0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAoAAAAFoAAAAAAGBbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAA9CQAAAAABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABLG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAOxzdGJsAAAAoHN0c2QAAAAAAAAAAQAAAJBhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAoABaABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAOmF2Y0MBTUAe/+EAI2dNQB6WUoFAX/LgLUBAQFAAAD6AAA6mDgAAHoQAA9CW7y4KAQAEaOuPIAAAABBzdHRzAAAAAAAAAAAAAAAQc3RzYwAAAAAAAAAAAAAAFHN0c3oAAAAAAAAAAAAAAAAAAAAQc3RjbwAAAAAAAAAAAAAASG12ZXgAAAAgdHJleAAAAAAAAAABAAAAAQAAAC4AAAAAAoAAAAAAACB0cmV4AAAAAAAAAAIAAAABAACCNQAAAAACQAAA'), c => c.charCodeAt(0))], {
                type: 'video/mp4'
            });
            const realFetch = fetch;
            fetch = async function (url, options) {
                if (typeof url === 'string') {
                    if (AdSegmentCache.has(url)) return new Response(BLANK_MP4);
                    url = url.trimEnd();
                    // raw v2 variant urls have no extension so the master playlist supplies their identity
                    if (!url.includes('/channel/hls/') && (StreamInfosByUrl[url] || url.endsWith('.m3u8') || url.includes('.m3u8?'))) {
                        const response = await realFetch(url, options);
                        return response.status === 200 ? new Response(await processM3U8(url, await response.text(), realFetch)) : response;
                    }
                    if (url.includes('/channel/hls/') && !url.includes('picture-by-picture')) {
                        // prune on stream requests instead of waking an idle worker
                        pruneStreamInfos();
                        V2API = url.includes('/api/v2/');
                        const parsedUrl = new URL(url);
                        const channelName = parsedUrl.pathname.match(/([^\/]+)(?=\.\w+$)/)?.[0];
                        if (ForceAccessTokenPlayerType) {
                            parsedUrl.searchParams.delete('parent_domains');
                            url = parsedUrl.toString();
                        }
                        const response = await realFetch(url, options);
                        if (response.status == 200) {
                            const encodingsM3u8 = await response.text();
                            const serverTime = getServerTimeFromM3u8(encodingsM3u8);
                            let streamInfo = StreamInfos[channelName];
                            const cachedVariantUrl = streamInfo?.ResolutionList[0]?.Url;
                            cachedVariantUrl && (await realFetch(cachedVariantUrl)).status !== 200 && (streamInfo = null);
                            if (streamInfo == null || streamInfo.EncodingsM3U8 == null) {
                                HasTriggeredPlayerReload = false;
                                StreamInfos[channelName] = streamInfo = createStreamInfo(channelName, encodingsM3u8, parsedUrl.search);
                                const lines = encodingsM3u8.split(/\r?\n/);
                                for (let i = 0; i < lines.length - 1; i++) if (lines[i].startsWith('#EXT-X-STREAM-INF') && /^https?:\/\//.test(lines[i + 1])) {
                                    const attributes = parseAttributes(lines[i]);
                                    const resolution = attributes['RESOLUTION'];
                                    if (resolution) {
                                        const resolutionInfo = {
                                            Resolution: resolution,
                                            FrameRate: attributes['FRAME-RATE'],
                                            Codecs: attributes['CODECS'] || '',
                                            Audio: attributes['AUDIO'] || '',
                                            Video: attributes['VIDEO'] || '',
                                            Subtitles: attributes['SUBTITLES'] || '',
                                            Url: lines[i + 1]
                                        };
                                        streamInfo.Urls[lines[i + 1]] = resolutionInfo;
                                        streamInfo.ResolutionList.push(resolutionInfo);
                                    }
                                    StreamInfosByUrl[lines[i + 1]] = streamInfo;
                                }
                                // modified playlists need an avc fallback for browsers that cannot decode enhanced codecs
                                const decodableResolutionList = streamInfo.ResolutionList.filter(element => videoCodecFamily(element.Codecs) === 'avc');
                                if (decodableResolutionList.length > 0 && streamInfo.ResolutionList.some(element => {
                                    const f = videoCodecFamily(element.Codecs);
                                    return f === 'hevc' || f === 'av1';
                                })) {
                                    const replaceOrAppendStreamInfAttr = (line, key, value) => {
                                        if (typeof value !== 'string' || !value) return line;
                                        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                                        const next = key + '="' + escaped + '"';
                                        const pattern = new RegExp('(^|,)' + key + '=("[^"]*"|[^,]*)');
                                        return pattern.test(line) ? line.replace(pattern, '$1' + next) : line + ',' + next;
                                    };
                                    if (decodableResolutionList.length > 0) for (let i = 0; i < lines.length - 1; i++) if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                                        const resSettings = parseAttributes(lines[i].substring(lines[i].indexOf(':') + 1));
                                        const codecsKey = 'CODECS';
                                        const lineFamily = videoCodecFamily(resSettings[codecsKey]);
                                        if (lineFamily === 'hevc' || lineFamily === 'av1') {
                                            const oldResolution = resSettings['RESOLUTION'];
                                            const [targetWidth, targetHeight] = oldResolution.split('x').map(Number);
                                            const targetArea = targetWidth * targetHeight;
                                            let newResolutionInfo = null;
                                            let closestDiff = 1 / 0;
                                            for (let j = 0; j < decodableResolutionList.length; j++) {
                                                const candidate = decodableResolutionList[j];
                                                const [streamWidth, streamHeight] = candidate.Resolution.split('x').map(Number);
                                                const diff = Math.abs(streamWidth * streamHeight - targetArea);
                                                if (diff < closestDiff) {
                                                    closestDiff = diff;
                                                    newResolutionInfo = candidate;
                                                }
                                            }
                                            lines[i] = lines[i].replace(/CODECS="[^"]+"/, `CODECS="${newResolutionInfo.Codecs}"`);
                                            lines[i] = replaceOrAppendStreamInfAttr(lines[i], 'AUDIO', newResolutionInfo.Audio);
                                            lines[i] = replaceOrAppendStreamInfAttr(lines[i], 'VIDEO', newResolutionInfo.Video);
                                            lines[i] = replaceOrAppendStreamInfAttr(lines[i], 'SUBTITLES', newResolutionInfo.Subtitles);
                                            lines[i + 1] = newResolutionInfo.Url + ' '.repeat(i + 1);
                                        }
                                    }
                                    streamInfo.ModifiedM3U8 = lines.join('\n');
                                }
                            }
                            streamInfo.LastSeenAt = Date.now();
                            return new Response(replaceServerTimeInM3u8(streamInfo.IsUsingModifiedM3U8 ? streamInfo.ModifiedM3U8 : streamInfo.EncodingsM3U8, serverTime));
                        } else return response;
                    }
                }
                return realFetch.apply(this, arguments);
            };
        }
        function getServerTimeFromM3u8(encodingsM3u8) {
            if (V2API) {
                const matches = encodingsM3u8.match(/#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE="([^"]+)"/);
                return matches && matches.length > 1 ? matches[1] : null;
            }
            const matches = encodingsM3u8.match(/SERVER-TIME="([0-9.]+)"/);
            return matches && matches.length > 1 ? matches[1] : null;
        }
        function replaceServerTimeInM3u8(encodingsM3u8, newServerTime) {
            if (V2API) return newServerTime ? encodingsM3u8.replace(/(#EXT-X-SESSION-DATA:DATA-ID="SERVER-TIME",VALUE=")[^"]+(")/, `$1${newServerTime}$2`) : encodingsM3u8;
            return newServerTime ? encodingsM3u8.replace(/(SERVER-TIME=")[0-9.]+"/, `SERVER-TIME="${newServerTime}"`) : encodingsM3u8;
        }
        function hasAdTags(textStr) {
            return AdSignifiers.some(s => s && textStr.includes(s));
        }
        function stripAdSegments(textStr, stripAllSegments, streamInfo) {
            const now = Date.now();
            let hasStrippedAdSegments = false;
            let inCueOut = false;
            const liveSegments = [];
            const lines = textStr.split(/\r?\n/);
            for (let i = 0; i < lines.length; i++) {
                let line = lines[i];
                line.includes('EXT-X-CUE-OUT') ? inCueOut = true : line.includes('EXT-X-CUE-IN') && (inCueOut = false);
                lines[i] = line.replaceAll(TwitchAdUrlRewriteRegex, '$1https://twitch.tv$2');
                const isLiveSegment = line.includes(',live');
                if (i < lines.length - 1 && line.startsWith('#EXTINF') && (!isLiveSegment || stripAllSegments || inCueOut)) {
                    const segmentUrl = lines[i + 1];
                    AdSegmentCache.has(segmentUrl) || streamInfo.NumStrippedAdSegments++;
                    AdSegmentCache.set(segmentUrl, now);
                    hasStrippedAdSegments = true;
                } else if (i < lines.length - 1 && line.startsWith('#EXTINF') && AdSegmentURLPatterns.some(p => lines[i + 1].includes(p))) {
                    if (!AdSegmentCache.has(lines[i + 1])) streamInfo.NumStrippedAdSegments++;
                    AdSegmentCache.set(lines[i + 1], now);
                    hasStrippedAdSegments = true;
                } else if (i < lines.length - 1 && line.startsWith('#EXTINF') && isLiveSegment) liveSegments.push({
                    extinf: line,
                    url: lines[i + 1]
                }); else if (line.startsWith('#EXT-X-PART:')) {
                    const partUriMatch = line.match(UriAttributeRegex);
                    const partUri = partUriMatch ? partUriMatch[1] : '';
                    if (partUri && (AdSegmentCache.has(partUri) || AdSegmentURLPatterns.some(p => partUri.includes(p)))) {
                        AdSegmentCache.set(partUri, now);
                        lines[i] = '';
                        hasStrippedAdSegments = true;
                    }
                } else if (line.startsWith('#EXT-X-TWITCH-PREFETCH:') || line.startsWith('#EXT-X-PRELOAD-HINT:')) {
                    let hintUrl = '';
                    if (line.startsWith('#EXT-X-TWITCH-PREFETCH:')) hintUrl = line.substring('#EXT-X-TWITCH-PREFETCH:'.length).trim(); else {
                        const hintMatch = line.match(/URI="([^"]+)"/);
                        hintUrl = hintMatch ? hintMatch[1] : '';
                    }
                    if (hintUrl && (AdSegmentCache.has(hintUrl) || AdSegmentURLPatterns.some(p => hintUrl.includes(p)))) {
                        AdSegmentCache.set(hintUrl, now);
                        hasStrippedAdSegments = true;
                    }
                }
            }
            !hasStrippedAdSegments && hasAdTags(textStr) && (hasStrippedAdSegments = true);
            if (hasStrippedAdSegments) for (let i = 0; i < lines.length; i++) (lines[i].startsWith('#EXT-X-TWITCH-PREFETCH:') || lines[i].startsWith('#EXT-X-PRELOAD-HINT:')) && (lines[i] = ''); else streamInfo.NumStrippedAdSegments = 0;
            if (liveSegments.length > 0) {
                streamInfo.RecoverySegments = liveSegments.slice(-6);
                const seq = parseInt((textStr.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/) || [])[1]);
                isNaN(seq) || (streamInfo.RecoveryStartSeq = seq + Math.max(0, liveSegments.length - streamInfo.RecoverySegments.length));
            }
            if (hasStrippedAdSegments && liveSegments.length === 0) {
                streamInfo.ConsecutiveAllStrippedPolls = (streamInfo.ConsecutiveAllStrippedPolls || 0) + 1;
                streamInfo.TotalAllStrippedPolls = (streamInfo.TotalAllStrippedPolls || 0) + 1;
                const snapshotAge = streamInfo.LastCleanNativePlaylistAt ? now - streamInfo.LastCleanNativePlaylistAt : 1 / 0;
                const recentReloadReentry = streamInfo.LastPlayerReload && now - streamInfo.LastPlayerReload < 8e3;
                if (streamInfo.LastCleanNativeM3U8 && snapshotAge <= 1500 && !recentReloadReentry) {
                    streamInfo.IsStrippingAdSegments = hasStrippedAdSegments;
                    return streamInfo.LastCleanNativeM3U8;
                }
                // retain recent live segments so an all ad poll does not become an empty playlist
                if (streamInfo.RecoverySegments && streamInfo.RecoverySegments.length > 0) {
                    if (streamInfo.RecoveryStartSeq !== void 0) for (let j = 0; j < lines.length; j++) if (lines[j].startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
                        lines[j] = '#EXT-X-MEDIA-SEQUENCE:' + streamInfo.RecoveryStartSeq;
                        break;
                    }
                    for (let j = 0; j < streamInfo.RecoverySegments.length; j++) {
                        lines.push(streamInfo.RecoverySegments[j].extinf);
                        lines.push(streamInfo.RecoverySegments[j].url);
                    }
                }
            } else liveSegments.length > 0 && (streamInfo.ConsecutiveAllStrippedPolls = 0);
            streamInfo.IsStrippingAdSegments = hasStrippedAdSegments;
            if (!streamInfo.LastAdCachePruneAt || now - streamInfo.LastAdCachePruneAt > 6e4) {
                streamInfo.LastAdCachePruneAt = now;
                AdSegmentCache.forEach((value, key, map) => {
                    value < now - 12e4 && map.delete(key);
                });
                if (AdSegmentCache.size > 1e3) {
                    let evicted = 0;
                    for (const url of AdSegmentCache.keys()) {
                        AdSegmentCache.delete(url);
                        if (++evicted >= 200) break;
                    }
                }
            }
            return lines.join('\n');
        }
        function videoCodecFamily(codecs) {
            if (!codecs) return 'unknown';
            const parts = String(codecs).toLowerCase().split(',');
            for (let i = 0; i < parts.length; i++) {
                const c = parts[i].trim();
                if (c.startsWith('avc')) return 'avc';
                if (c.startsWith('hev') || c.startsWith('hvc')) return 'hevc';
                if (c.startsWith('av0')) return 'av1';
            }
            return 'unknown';
        }
        function getStreamUrlForResolution(encodingsM3u8, resolutionInfo) {
            const encodingsLines = encodingsM3u8.split(/\r?\n/);
            const [targetWidth, targetHeight] = resolutionInfo.Resolution.split('x').map(Number);
            let matchedResolutionUrl = null;
            let matchedFrameRate = false;
            let closestResolutionUrl = null;
            let closestResolutionDifference = 1 / 0;
            for (let i = 0; i < encodingsLines.length - 1; i++) {
                const nextLine = encodingsLines[i + 1]?.trim();
                if (encodingsLines[i].startsWith('#EXT-X-STREAM-INF') && nextLine && !nextLine.startsWith('#') && (nextLine.includes('.m3u8') || nextLine.includes('://'))) {
                    const attributes = parseAttributes(encodingsLines[i]);
                    const resolution = attributes['RESOLUTION'];
                    const frameRate = attributes['FRAME-RATE'];
                    if (resolution) {
                        if (resolution == resolutionInfo.Resolution && (!matchedResolutionUrl || !matchedFrameRate && frameRate == resolutionInfo.FrameRate)) {
                            matchedResolutionUrl = encodingsLines[i + 1];
                            matchedFrameRate = frameRate == resolutionInfo.FrameRate;
                            if (matchedFrameRate) return matchedResolutionUrl;
                        }
                        const [width, height] = resolution.split('x').map(Number);
                        const difference = Math.abs(width * height - targetWidth * targetHeight);
                        if (difference < closestResolutionDifference) {
                            closestResolutionUrl = encodingsLines[i + 1];
                            closestResolutionDifference = difference;
                        }
                    }
                }
            }
            return matchedResolutionUrl || closestResolutionUrl;
        }
        async function processM3U8(url, textStr, realFetch) {
            const streamInfo = StreamInfosByUrl[url];
            if (!streamInfo) return textStr;
            streamInfo.LastSeenAt = Date.now();
            if (HasTriggeredPlayerReload) {
                HasTriggeredPlayerReload = false;
                streamInfo.LastPlayerReload = Date.now();
            }
            const haveAdTags = hasAdTags(textStr);
            if (!haveAdTags && !streamInfo.IsShowingAd && textStr.indexOf('#EXTINF') !== -1) {
                streamInfo.LastCleanNativeM3U8 = textStr;
                streamInfo.LastCleanNativePlaylistAt = Date.now();
            }
            if (haveAdTags) {
                const adEndStalenessMs = 12e3;
                if (!streamInfo.PendingAdEndAt || Date.now() - streamInfo.PendingAdEndAt >= adEndStalenessMs) streamInfo.PendingAdEndAt = 0;
                streamInfo.CleanPlaylistCount = 0;
                streamInfo.IsMidroll = textStr.includes('"MIDROLL"') || textStr.includes('"midroll"');
                if (!streamInfo.IsShowingAd) {
                    streamInfo.IsShowingAd = true;
                    const podLengthMatch = textStr.match(/X-TV-TWITCH-AD-POD-LENGTH="(\d+)"/);
                    const podLength = podLengthMatch ? parseInt(podLengthMatch[1], 10) : 1;
                    streamInfo.PodLength = podLength;
                    streamInfo.EarlyReloadTriggered = false;
                    streamInfo.EarlyReloadCount = 0;
                    streamInfo.CycleRescuedThisBreak = false;
                    streamInfo.LastCommittedBackupPlayerType = null;
                    postMessage({
                        key: 'UpdateAdBlockBanner',
                        isMidroll: streamInfo.IsMidroll,
                        hasAds: streamInfo.IsShowingAd,
                        isStrippingAdSegments: false
                    });
                }
                if (!streamInfo.IsMidroll) {
                    const lines = textStr.split(/\r?\n/);
                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i];
                        if (line.startsWith('#EXTINF') && lines.length > i + 1 && !line.includes(',live') && !streamInfo.RequestedAds.has(lines[i + 1])) {
                            streamInfo.RequestedAds.add(lines[i + 1]);
                            fetch(lines[i + 1]).then(response => response.blob()).catch(() => { });
                            break;
                        }
                    }
                }
                const currentResolution = streamInfo.Urls[url];
                if (!currentResolution) return stripAdSegments(textStr, false, streamInfo);
                const currentCodecFamily = videoCodecFamily(currentResolution.Codecs);
                const isEnhanced = currentCodecFamily === 'hevc' || currentCodecFamily === 'av1';
                const postAdReentryGuardMs = 8e3;
                const recentlyReloaded = streamInfo.LastPlayerReload && Date.now() - streamInfo.LastPlayerReload < postAdReentryGuardMs;
                if (isEnhanced && streamInfo.ModifiedM3U8 && !streamInfo.IsUsingModifiedM3U8 && !recentlyReloaded) {
                    streamInfo.IsUsingModifiedM3U8 = true;
                    streamInfo.LastPlayerReload = Date.now();
                    postMessage({
                        key: 'ReloadPlayer'
                    });
                }
                let backupPlayerType = null;
                let backupM3u8 = null;
                let fallbackM3u8 = null;
                let startIndex = 0;
                let isDoingMinimalRequests = false;
                if (streamInfo.LastPlayerReload > Date.now() - PlayerReloadMinimalRequestsTime) {
                    startIndex = PlayerReloadMinimalRequestsPlayerIndex;
                    isDoingMinimalRequests = true;
                }
                // try source quality first and retain autoplay as the low quality escape path
                const playerTypesToTry = [...BackupPlayerTypes, 'autoplay'];
                if (streamInfo.PinnedBackupPlayerType) {
                    const pinnedIndex = playerTypesToTry.indexOf(streamInfo.PinnedBackupPlayerType);
                    if (pinnedIndex > 0) {
                        playerTypesToTry.splice(pinnedIndex, 1);
                        playerTypesToTry.unshift(streamInfo.PinnedBackupPlayerType);
                    }
                }
                if (streamInfo.LastBreakUsedEscapeHatch) {
                    const FastAutoplayReprobeInterval = 5;
                    const consecutive = streamInfo.FastAutoplayConsecutive || 0;
                    if (consecutive >= FastAutoplayReprobeInterval) streamInfo.FastAutoplayConsecutive = 0; else {
                        const autoplayIdx = playerTypesToTry.indexOf('autoplay');
                        if (autoplayIdx > 0) {
                            playerTypesToTry.splice(autoplayIdx, 1);
                            playerTypesToTry.unshift('autoplay');
                        }
                    }
                }
                if (streamInfo.ContaminatedBackupPlayerTypes && streamInfo.ContaminatedBackupPlayerTypes.size > 0) {
                    const clean = [];
                    const contam = [];
                    for (const t of playerTypesToTry) streamInfo.ContaminatedBackupPlayerTypes.has(t) ? contam.push(t) : clean.push(t);
                    if (contam.length > 0 && clean.length > 0) {
                        playerTypesToTry.length = 0;
                        playerTypesToTry.push(...clean, ...contam);
                    }
                }
                for (let playerTypeIndex = startIndex; !backupM3u8 && playerTypeIndex < playerTypesToTry.length; playerTypeIndex++) {
                    const playerType = playerTypesToTry[playerTypeIndex];
                    const failedAt = streamInfo.FailedBackupPlayerTypes.get(playerType);
                    if (failedAt && Date.now() - failedAt < 5e3) continue;
                    for (let i = 0; i < 2; i++) {
                        let isFreshM3u8 = false;
                        let encodingsM3u8 = streamInfo.BackupEncodingsM3U8Cache[playerType];
                        if (!encodingsM3u8) {
                            isFreshM3u8 = true;
                            try {
                                const accessTokenResponse = await getAccessToken(streamInfo.ChannelName, playerType);
                                if (accessTokenResponse.status === 200) {
                                    const accessToken = await accessTokenResponse.json();
                                    const spat = accessToken?.data?.streamPlaybackAccessToken || accessToken?.streamPlaybackAccessToken;
                                    if (!spat) {
                                        streamInfo.FailedBackupPlayerTypes.set(playerType, Date.now());
                                        continue;
                                    }
                                    const urlInfo = new URL('https://usher.ttvnw.net/api/' + (V2API ? 'v2/' : '') + 'channel/hls/' + streamInfo.ChannelName + '.m3u8' + streamInfo.UsherParams);
                                    urlInfo.searchParams.set('sig', spat.signature);
                                    urlInfo.searchParams.set('token', spat.value);
                                    const encodingsM3u8Response = await realFetch(urlInfo.href);
                                    encodingsM3u8Response.status === 200 && (encodingsM3u8 = streamInfo.BackupEncodingsM3U8Cache[playerType] = await encodingsM3u8Response.text());
                                } else {
                                    streamInfo.FailedBackupPlayerTypes.set(playerType, Date.now());
                                }
                            } catch (err) {
                                streamInfo.FailedBackupPlayerTypes.set(playerType, Date.now());
                            }
                        }
                        if (encodingsM3u8) try {
                            const streamM3u8Url = getStreamUrlForResolution(encodingsM3u8, currentResolution);
                            const streamM3u8Response = await realFetch(streamM3u8Url);
                            if (streamM3u8Response.status == 200) {
                                const m3u8Text = await streamM3u8Response.text();
                                if (m3u8Text) {
                                    const backupHasAds = hasAdTags(m3u8Text);
                                    playerType == FallbackPlayerType && (fallbackM3u8 = m3u8Text);
                                    if (!backupHasAds || !fallbackM3u8 && playerTypeIndex >= playerTypesToTry.length - 1) {
                                        if ((streamInfo.ConsecutiveAllStrippedPolls || 0) >= 1 && !backupHasAds) {
                                            const prevType = streamInfo.LastCommittedBackupPlayerType;
                                            prevType && prevType !== playerType && (streamInfo.CycleRescuedThisBreak = true);
                                        }
                                        backupPlayerType = playerType;
                                        backupM3u8 = m3u8Text;
                                        break;
                                    }
                                    if (backupHasAds) {
                                        streamInfo.ContaminatedBackupPlayerTypes || (streamInfo.ContaminatedBackupPlayerTypes = new Set);
                                        streamInfo.ContaminatedBackupPlayerTypes.has(playerType) || streamInfo.ContaminatedBackupPlayerTypes.add(playerType);
                                    }
                                    if (isDoingMinimalRequests) {
                                        backupPlayerType = playerType;
                                        backupM3u8 = m3u8Text;
                                        break;
                                    }
                                    if (playerTypeIndex >= playerTypesToTry.length - 1) {
                                        backupPlayerType = playerType;
                                        backupM3u8 = m3u8Text;
                                        break;
                                    }
                                }
                            }
                        } catch (err) { }
                        streamInfo.BackupEncodingsM3U8Cache[playerType] = null;
                        if (isFreshM3u8) break;
                    }
                }
                if (!backupM3u8 && fallbackM3u8) if (streamInfo.ContaminatedBackupPlayerTypes && streamInfo.ContaminatedBackupPlayerTypes.has(FallbackPlayerType)); else {
                    backupPlayerType = FallbackPlayerType;
                    backupM3u8 = fallbackM3u8;
                }
                if (backupM3u8 && streamInfo.IsShowingAd) {
                    textStr = backupM3u8;
                    streamInfo.LastCommittedBackupPlayerType = backupPlayerType;
                    if (streamInfo.ActiveBackupPlayerType != backupPlayerType) {
                        streamInfo.ActiveBackupPlayerType = backupPlayerType;
                        if (backupPlayerType !== 'autoplay') streamInfo.PinnedBackupPlayerType = backupPlayerType;
                        if (backupPlayerType === 'autoplay') {
                            const sourceTried = streamInfo.ContaminatedBackupPlayerTypes?.size || 0;
                            sourceTried === 0 && (streamInfo.FastAutoplayConsecutive = (streamInfo.FastAutoplayConsecutive || 0) + 1);
                            if (sourceTried >= 4) {
                                streamInfo.LastBreakUsedEscapeHatch = true;
                                streamInfo.FastAutoplayConsecutive = 0;
                            }
                        } else {
                            streamInfo.LastBreakUsedEscapeHatch = false;
                            streamInfo.FastAutoplayConsecutive = 0;
                        }
                    }
                }
                const stripEnhanced = isEnhanced && streamInfo.ModifiedM3U8;
                textStr = stripAdSegments(textStr, stripEnhanced, streamInfo);
                if (streamInfo.EarlyReloadAwaitingResult) {
                    streamInfo.EarlyReloadAwaitingResult = false;
                    textStr.includes(',live') && streamInfo.IsStrippingAdSegments || (streamInfo.EarlyReloadTriggered = false);
                }
                const recoveryThin = (streamInfo.RecoverySegments?.length || 0) < 3;
                const maxEarlyReloads = recoveryThin ? Math.max(2, streamInfo.PodLength || 1) : Math.max(1, streamInfo.PodLength || 1);
                const effectiveThreshold = recoveryThin ? 1 : EarlyReloadPollThreshold;
                if (EarlyReloadPollThreshold > 0 && (streamInfo.ConsecutiveAllStrippedPolls || 0) >= effectiveThreshold && !streamInfo.EarlyReloadTriggered && (streamInfo.EarlyReloadCount || 0) < maxEarlyReloads) {
                    streamInfo.EarlyReloadTriggered = true;
                    streamInfo.EarlyReloadAwaitingResult = true;
                    streamInfo.EarlyReloadCount = (streamInfo.EarlyReloadCount || 0) + 1;
                    postMessage({
                        key: 'ReloadPlayer',
                        kind: 'early'
                    });
                }
            } else if (streamInfo.IsShowingAd) {
                streamInfo.PendingAdEndAt || (streamInfo.PendingAdEndAt = Date.now());
                streamInfo.CleanPlaylistCount++;
                const hasLiveSegments = textStr.includes(',live');
                const adEndMaxWaitMs = 12e3;
                const elapsedSinceCandidate = Date.now() - streamInfo.PendingAdEndAt;
                const slowPathReady = streamInfo.PendingAdEndAt > 0 && elapsedSinceCandidate >= adEndMaxWaitMs;
                if (streamInfo.CleanPlaylistCount >= 3 || !hasLiveSegments || slowPathReady) {
                    const hadStrippedSegments = streamInfo.NumStrippedAdSegments > 0;
                    const allStrippedPolls = streamInfo.TotalAllStrippedPolls || 0;
                    streamInfo.IsShowingAd = false;
                    streamInfo.IsStrippingAdSegments = false;
                    streamInfo.NumStrippedAdSegments = 0;
                    streamInfo.ActiveBackupPlayerType = null;
                    streamInfo.RequestedAds?.clear?.();
                    streamInfo.FailedBackupPlayerTypes?.clear?.();
                    streamInfo.ContaminatedBackupPlayerTypes && streamInfo.ContaminatedBackupPlayerTypes.clear();
                    streamInfo.CleanPlaylistCount = 0;
                    streamInfo.PendingAdEndAt = 0;
                    streamInfo.ConsecutiveAllStrippedPolls = 0;
                    streamInfo.EarlyReloadTriggered = false;
                    streamInfo.EarlyReloadAwaitingResult = false;
                    streamInfo.TotalAllStrippedPolls = 0;
                    if (hadStrippedSegments) {
                        streamInfo.ReloadTimestamps || (streamInfo.ReloadTimestamps = []);
                        streamInfo.ReloadTimestamps = streamInfo.ReloadTimestamps.filter(t => Date.now() - t < 3e5);
                        const recentReloads = streamInfo.ReloadTimestamps.length;
                        // repeated reloads can trigger another ad break so lengthen the cooldown after a cascade
                        const effectiveCooldown = recentReloads >= 3 ? ReloadCooldownSeconds * 3 : ReloadCooldownSeconds;
                        const tooSoonSinceLastReload = streamInfo.LastPlayerReload && Date.now() - streamInfo.LastPlayerReload < effectiveCooldown * 1e3;
                        const cycleRescuedCleanly = streamInfo.CycleRescuedThisBreak && allStrippedPolls <= 2 && (streamInfo.EarlyReloadCount || 0) === 0;
                        const shouldReload = !tooSoonSinceLastReload && (streamInfo.IsUsingModifiedM3U8 || !cycleRescuedCleanly);
                        if (shouldReload) {
                            streamInfo.ReloadTimestamps.push(Date.now());
                            streamInfo.IsUsingModifiedM3U8 = false;
                            streamInfo.LastPlayerReload = Date.now();
                            postMessage({
                                key: 'ReloadPlayer',
                                kind: 'early'
                            });
                        } else postMessage({
                            key: 'PauseResumePlayer'
                        });
                    } else {
                        streamInfo.IsUsingModifiedM3U8 = false;
                        if (streamInfo.LastCommittedBackupPlayerType) {
                            streamInfo.LastPlayerReload = Date.now();
                            streamInfo.ReloadTimestamps || (streamInfo.ReloadTimestamps = []);
                            streamInfo.ReloadTimestamps.push(Date.now());
                            postMessage({
                                key: 'ReloadPlayer',
                                kind: 'early'
                            });
                        }
                    }
                }
            }
            postMessage({
                key: 'UpdateAdBlockBanner',
                isMidroll: streamInfo.IsMidroll,
                hasAds: streamInfo.IsShowingAd,
                isStrippingAdSegments: streamInfo.IsStrippingAdSegments,
                activeBackupPlayerType: streamInfo.ActiveBackupPlayerType
            });
            return textStr;
        }
        function parseAttributes(str) {
            const attributes = Object.create(null);
            if (!str) return attributes;
            if (str.charCodeAt(0) === 35) {
                const idx = str.indexOf(':');
                idx !== -1 && (str = str.slice(idx + 1));
            }
            const pattern = /(?:^|,)([^=,]+)=("[^"]*"|[^,]*)/g;
            let match;
            while ((match = pattern.exec(str))) {
                const value = match[2];
                const num = Number(value);
                attributes[match[1]] = Number.isNaN(num) ? value.startsWith('"') ? JSON.parse(value) : value : num;
            }
            return attributes;
        }
        function getAccessToken(channelName, playerType) {
            const body = {
                operationName: 'PlaybackAccessToken',
                variables: {
                    isLive: true,
                    login: channelName,
                    isVod: false,
                    vodID: '',
                    playerType: playerType,
                    platform: playerType == 'autoplay' ? 'android' : 'web'
                },
                extensions: {
                    persistedQuery: {
                        version: 1,
                        sha256Hash: 'ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9'
                    }
                }
            };
            return gqlRequest(body);
        }
        function gqlRequest(body) {
            if (!GQLDeviceID) {
                GQLDeviceID = '';
                const dcharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
                const dcharactersLength = dcharacters.length;
                for (let i = 0; i < 32; i++) GQLDeviceID += dcharacters.charAt(Math.floor(Math.random() * dcharactersLength));
            }
            const headers = {
                'Client-ID': ClientID,
                'X-Device-Id': GQLDeviceID,
                ...AuthorizationHeader && {
                    Authorization: AuthorizationHeader
                },
                ...ClientIntegrityHeader && {
                    'Client-Integrity': ClientIntegrityHeader
                },
                ...ClientVersion && {
                    'Client-Version': ClientVersion
                },
                ...ClientSession && {
                    'Client-Session-Id': ClientSession
                }
            };
            return new Promise((resolve, reject) => {
                const requestId = Math.random().toString(36).substring(2, 15);
                const fetchRequest = {
                    id: requestId,
                    url: 'https://gql.twitch.tv/gql',
                    options: {
                        method: 'POST',
                        body: JSON.stringify(body),
                        headers: headers
                    }
                };
                const timeoutId = setTimeout(() => {
                    if (pendingFetchRequests.has(requestId)) {
                        pendingFetchRequests.delete(requestId);
                        reject(new Error('FetchRequest timed out'));
                    }
                }, 15e3);
                pendingFetchRequests.set(requestId, {
                    resolve: resolve,
                    reject: reject,
                    timeoutId: timeoutId
                });
                postMessage({
                    key: 'FetchRequest',
                    value: fetchRequest
                });
            });
        }
        let playerForMonitoringBuffering = null;
        let driftCatchUpInterval = null;
        let driftCatchUpTimeout = null;
        function startDriftCorrection(videoElement) {
            if (DriftCorrectionRate <= 1) return;
            if (driftCatchUpInterval) {
                clearInterval(driftCatchUpInterval);
                driftCatchUpInterval = null;
            }
            if (driftCatchUpTimeout) {
                clearTimeout(driftCatchUpTimeout);
                driftCatchUpTimeout = null;
            }
            videoElement.playbackRate = DriftCorrectionRate;
            driftCatchUpInterval = setInterval(() => {
                try {
                    const vid = getPlayerVideoElement();
                    if (vid && vid.buffered.length > 0 && vid.buffered.end(vid.buffered.length - 1) - vid.currentTime <= 1) {
                        vid.playbackRate = 1;
                        clearInterval(driftCatchUpInterval);
                        driftCatchUpInterval = null;
                        if (driftCatchUpTimeout) {
                            clearTimeout(driftCatchUpTimeout);
                            driftCatchUpTimeout = null;
                        }
                    }
                } catch {
                    clearInterval(driftCatchUpInterval);
                    driftCatchUpInterval = null;
                }
            }, 500);
            driftCatchUpTimeout = setTimeout(() => {
                try {
                    videoElement.playbackRate = 1;
                } catch { }
                if (driftCatchUpInterval) {
                    clearInterval(driftCatchUpInterval);
                    driftCatchUpInterval = null;
                }
                driftCatchUpTimeout = null;
            }, 3e4);
        }
        const playerBufferState = {
            channelName: null,
            hasStreamStarted: false,
            position: 0,
            bufferedPosition: 0,
            bufferDuration: 0,
            numSame: 0,
            fixAttempts: 0,
            lastFixTime: 0,
            isLive: true,
            lastBackupSwitchAt: 0,
            lastReloadAt: 0,
            recoveryReloadUsed: false,
            userPauseIntent: false,
            weJustPaused: 0,
            inAdBreak: false,
            vaftEverUnmuted: false
        };
        function monitorPlayerBuffering() {
            // visibility recovery can call this early so replace the pending timer instead of starting another loop
            clearTimeout(monitorPlayerBuffering.timer);
            playerForMonitoringBuffering = null;
            {
                const playerAndState = getPlayerAndState();
                if (playerAndState && playerAndState.player && playerAndState.state) {
                    playerForMonitoringBuffering = {
                        player: playerAndState.player,
                        state: playerAndState.state
                    };
                    const video = playerAndState.player.getHTMLVideoElement?.();
                    if (video && !video.__tasIntentHooked) {
                        video.__tasIntentHooked = true;
                        video.addEventListener('pause', () => {
                            (!playerBufferState.weJustPaused || Date.now() - playerBufferState.weJustPaused > 2e3) && (playerBufferState.userPauseIntent = true);
                        });
                        video.addEventListener('play', () => {
                            playerBufferState.userPauseIntent = false;
                        });
                    }
                }
            }
            if (playerForMonitoringBuffering) try {
                const player = playerForMonitoringBuffering.player;
                const state = playerForMonitoringBuffering.state;
                if (player.core) {
                    if (state.props?.content?.type === 'live' && !player.isPaused() && !player.getHTMLVideoElement()?.ended && (player.getHTMLVideoElement()?.readyState ?? 0) >= 1 && playerBufferState.lastFixTime <= Date.now() - PlayerBufferingMinRepeatDelay && !isActivelyStrippingAds && !playerBufferState.inAdBreak && (!playerBufferState.lastReloadAt || Date.now() - playerBufferState.lastReloadAt >= 15e3) && (!playerBufferState.lastBackupSwitchAt || Date.now() - playerBufferState.lastBackupSwitchAt >= 1e4)) {
                        const m3u8Url = player.core?.state?.path;
                        if (m3u8Url) {
                            const lastSlash = m3u8Url.lastIndexOf('/');
                            const queryStart = m3u8Url.indexOf('?', lastSlash);
                            const fileName = m3u8Url.substring(lastSlash + 1, queryStart !== -1 ? queryStart : void 0);
                            if (fileName?.endsWith('.m3u8')) {
                                const channelName = fileName.slice(0, -5);
                                if (playerBufferState.channelName != channelName) {
                                    playerBufferState.channelName = channelName;
                                    playerBufferState.hasStreamStarted = false;
                                    playerBufferState.numSame = 0;
                                    playerBufferState.fixAttempts = 0;
                                    playerBufferState.recoveryReloadUsed = false;
                                    playerBufferState.userPauseIntent = false;
                                }
                            }
                        }
                        player.getState() === 'Playing' && (playerBufferState.hasStreamStarted = true);
                        const position = player.core?.state?.position;
                        const bufferedPosition = player.core?.state?.bufferedPosition;
                        const bufferDuration = player.getBufferDuration();
                        const videoEl = player.getHTMLVideoElement?.();
                        const videoCurrentTime = videoEl?.currentTime;
                        if (position !== void 0 && bufferedPosition !== void 0) {
                            const playerNotActivelyPlaying = videoEl && (videoEl.readyState < 2 || videoEl.paused);
                            if (videoEl && playerBufferState.videoElement && playerBufferState.videoElement !== videoEl) {
                                playerBufferState.numSame = 0;
                                playerBufferState.fixAttempts = 0;
                                playerBufferState.recoveryReloadUsed = false;
                            }
                            playerBufferState.videoElement = videoEl;
                            const positionFrozen = playerBufferState.position == position && (playerBufferState.videoCurrentTime === void 0 || playerBufferState.videoCurrentTime === videoCurrentTime);
                            if (playerNotActivelyPlaying); else if (playerBufferState.hasStreamStarted && positionFrozen && bufferDuration < PlayerBufferingDangerZone && playerBufferState.bufferedPosition == bufferedPosition && playerBufferState.bufferDuration >= bufferDuration && (position != 0 || bufferedPosition != 0 || bufferDuration != 0)) {
                                playerBufferState.numSame++;
                                if (playerBufferState.numSame == PlayerBufferingSameStateCount) {
                                    playerBufferState.fixAttempts++;
                                    const wouldEscalate = playerBufferState.fixAttempts >= 3;
                                    const escalateToReload = wouldEscalate && !playerBufferState.recoveryReloadUsed;
                                    const video = player.getHTMLVideoElement?.();
                                    if (video && video.buffered.length > 1) for (let bi = 0; bi < video.buffered.length; bi++) if (video.buffered.start(bi) > video.currentTime + .5) {
                                        video.currentTime = video.buffered.start(bi);
                                        startDriftCorrection(video);
                                        break;
                                    }
                                    doTwitchPlayerTask(!escalateToReload, escalateToReload);
                                    playerBufferState.lastFixTime = Date.now();
                                    playerBufferState.numSame = 0;
                                    if (escalateToReload) {
                                        playerBufferState.fixAttempts = 0;
                                        playerBufferState.recoveryReloadUsed = true;
                                    }
                                }
                            } else {
                                playerBufferState.numSame = 0;
                                playerBufferState.fixAttempts = 0;
                                playerBufferState.recoveryReloadUsed = false;
                            }
                            if (playerBufferState.position > 0 && position - playerBufferState.position > 5 && !playerBufferState.inAdBreak && (!playerBufferState.lastBackupSwitchAt || Date.now() - playerBufferState.lastBackupSwitchAt >= 1e4) && (!playerBufferState.lastDriftStartedAt || Date.now() - playerBufferState.lastDriftStartedAt >= 3e4)) {
                                startDriftCorrection(player.getHTMLVideoElement?.());
                                playerBufferState.lastDriftStartedAt = Date.now();
                            }
                            playerBufferState.position = position;
                            playerBufferState.videoCurrentTime = videoCurrentTime;
                            playerBufferState.bufferedPosition = bufferedPosition;
                            playerBufferState.bufferDuration = bufferDuration;
                        } else playerBufferState.numSame = 0;
                    }
                } else playerForMonitoringBuffering = null;
            } catch (err) {
                console.error('error when monitoring player for buffering: ' + err);
                playerForMonitoringBuffering = null;
            }
            {
                const wedgeInAd = !!playerBufferState.inAdBreak;
                if (playerBufferState.wedgePrevInAdBreak && !wedgeInAd) {
                    playerBufferState.wedgeEvalsRemaining = 40;
                    playerBufferState.wedgeLastTime = -1;
                    playerBufferState.wedgeLastFrames = -1;
                    playerBufferState.wedgeEvidence = 0;
                    playerBufferState.wedgeHealthy = 0;
                    playerBufferState.wedgeActions = 0;
                }
                playerBufferState.wedgePrevInAdBreak = wedgeInAd;
                if (!wedgeInAd && (playerBufferState.wedgeEvalsRemaining || 0) > 0 && !playerBufferState.userPauseIntent && playerForMonitoringBuffering && playerForMonitoringBuffering.state?.props?.content?.type === 'live') try {
                    const wv = playerForMonitoringBuffering.player?.getHTMLVideoElement?.();
                    if (wv && !wv.ended && !wv.paused && wv.videoWidth > 0 && (wv.readyState ?? 0) >= 2 && typeof wv.getVideoPlaybackQuality === 'function') {
                        let totalFrames = -1;
                        try {
                            totalFrames = Number(wv.getVideoPlaybackQuality()?.totalVideoFrames);
                        } catch { }
                        if (Number.isFinite(totalFrames) && totalFrames >= 0) {
                            const t = wv.currentTime || 0;
                            const prevT = playerBufferState.wedgeLastTime;
                            const prevF = playerBufferState.wedgeLastFrames;
                            playerBufferState.wedgeLastTime = t;
                            playerBufferState.wedgeLastFrames = totalFrames;
                            if (prevT >= 0 && prevF >= 0 && t > prevT + .3) {
                                playerBufferState.wedgeEvalsRemaining--;
                                const framesDelta = totalFrames - prevF;
                                if (framesDelta < 0) {
                                    playerBufferState.wedgeEvidence = 0;
                                    playerBufferState.wedgeHealthy = 0;
                                } else if (framesDelta >= 5) {
                                    playerBufferState.wedgeEvidence = 0;
                                    playerBufferState.wedgeHealthy = (playerBufferState.wedgeHealthy || 0) + 1;
                                    playerBufferState.wedgeHealthy >= 3 && (playerBufferState.wedgeEvalsRemaining = 0);
                                } else if (framesDelta <= 1) {
                                    playerBufferState.wedgeHealthy = 0;
                                    playerBufferState.wedgeEvidence = (playerBufferState.wedgeEvidence || 0) + 1;
                                    if (playerBufferState.wedgeEvidence >= 6) {
                                        playerBufferState.wedgeEvidence = 0;
                                        playerBufferState.wedgeActions = (playerBufferState.wedgeActions || 0) + 1;
                                        const wedgeReload = playerBufferState.wedgeActions >= 2;
                                        const recentReload = playerBufferState.lastReloadAt && Date.now() - playerBufferState.lastReloadAt < 15e3;
                                        if (wedgeReload) {
                                            playerBufferState.wedgeEvalsRemaining = 0;
                                            recentReload || doTwitchPlayerTask(false, true, 'early');
                                        } else doTwitchPlayerTask(true, false);
                                        playerBufferState.lastFixTime = Date.now();
                                    }
                                } else playerBufferState.wedgeHealthy = 0;
                            }
                        }
                    }
                } catch { }
            }
            if (isActivelyStrippingAds && playerForMonitoringBuffering) try {
                const player = playerForMonitoringBuffering.player;
                const video = player?.getHTMLVideoElement?.();
                if (video && !video.ended && !playerBufferState.userPauseIntent) {
                    video.readyState >= 3 && (playerBufferState.hasHadData = true);
                    const isStalled = video.readyState < 3 && (video.paused || video.networkState === 2);
                    const stallReloadCooldown = 15e3;
                    const cooldownExpired = !playerBufferState.lastAdStallReloadAt || Date.now() - playerBufferState.lastAdStallReloadAt > stallReloadCooldown;
                    const recentReload = playerBufferState.lastReloadAt && Date.now() - playerBufferState.lastReloadAt < stallReloadCooldown;
                    if (isStalled && cooldownExpired && !recentReload && playerBufferState.hasHadData) if (playerBufferState.adStallStartAt) {
                        if (Date.now() - playerBufferState.adStallStartAt > 3e3) {
                            playerBufferState.lastAdStallReloadAt = Date.now();
                            playerBufferState.adStallStartAt = 0;
                            doTwitchPlayerTask(false, true, 'early');
                        }
                    } else playerBufferState.adStallStartAt = Date.now(); else isStalled || (playerBufferState.adStallStartAt = 0);
                }
            } catch { } else !isActivelyStrippingAds && playerBufferState.adStallStartAt && (playerBufferState.adStallStartAt = 0);
            const isLive = playerForMonitoringBuffering?.state?.props?.content?.type === 'live';
            playerBufferState.isLive && !isLive && updateAdblockBanner({
                hasAds: false
            });
            playerBufferState.isLive = isLive;
            if (!config.keepTabActive && !monitorPlayerBuffering.visibilityHooked) {
                monitorPlayerBuffering.visibilityHooked = true;
                document.addEventListener('visibilitychange', () => {
                    if (!document.hidden && !monitorPlayerBuffering.pendingTick) {
                        monitorPlayerBuffering.pendingTick = true;
                        setTimeout(() => {
                            monitorPlayerBuffering.pendingTick = false;
                            monitorPlayerBuffering();
                        }, 100);
                    }
                });
            }
            try {
                hideTwitchAdOverlays();
            } catch { }
            // read real visibility because background playback spoofs document.hidden
            const hidden = nativeHiddenGetter ? nativeHiddenGetter.call(document) : document.hidden;
            const shouldThrottle = hidden && !document.pictureInPictureElement && !playerBufferState.inAdBreak;
            const nextDelay = !playerForMonitoringBuffering || shouldThrottle ? PlayerBufferingDelay * 3 : PlayerBufferingDelay;
            monitorPlayerBuffering.timer = setTimeout(monitorPlayerBuffering, nextDelay);
        }
        function getPlayerVideoElement() {
            if (cachedPlayerVideo?.isConnected) return cachedPlayerVideo;
            const videos = document.getElementsByTagName('video');
            for (let i = 0; i < videos.length; i++) if (!videos[i].dataset.tasAdHidden && !videos[i].closest('[class*="carousel"]')) return videos[i];
            return null;
        }
        function hideTwitchAdOverlays() {
            if (!cachedPlayerRootDiv || !cachedPlayerRootDiv.isConnected) return;
            const primaryVideo = playerForMonitoringBuffering?.player?.getHTMLVideoElement?.();
            const allVideos = document.getElementsByTagName('video');
            for (let i = 0; i < allVideos.length; i++) {
                const vid = allVideos[i];
                let adHost = '';
                try {
                    const vidSrc = vid.currentSrc || vid.getAttribute('src') || '';
                    if (vidSrc && !vidSrc.startsWith('blob:')) {
                        const host = new URL(vidSrc, document.location.href).hostname.toLowerCase();
                        (host === 'media-amazon.com' || host.endsWith('.media-amazon.com')) && (adHost = host);
                    }
                } catch { }
                if (adHost && vid !== primaryVideo) {
                    vid.style.setProperty('display', 'none', 'important');
                    try {
                        vid.muted = true;
                        vid.paused || vid.pause();
                    } catch { }
                    vid.dataset.tasAdHidden || (vid.dataset.tasAdHidden = '1');
                } else if (vid.dataset.tasAdHidden && !adHost) {
                    delete vid.dataset.tasAdHidden;
                    vid.style.removeProperty('display');
                    try {
                        vid.muted = false;
                    } catch { }
                }
            }
        }
        function updateAdblockBanner(data) {
            cachedPlayerRootDiv && cachedPlayerRootDiv.isConnected || (cachedPlayerRootDiv = document.querySelector('.video-player'));
            const playerRootDiv = cachedPlayerRootDiv;
            if (playerRootDiv != null) {
                let adBlockDiv = playerRootDiv.querySelector('.tas-adblock-overlay');
                if (adBlockDiv == null) {
                    adBlockDiv = document.createElement('div');
                    adBlockDiv.className = 'tas-adblock-overlay';
                    adBlockDiv.innerHTML = '<div class="player-adblock-notice" style="color: white; background-color: rgba(0, 0, 0, 0.8); position: absolute; top: 0px; left: 0px; padding: 5px;"><p></p></div>';
                    adBlockDiv.style.display = 'none';
                    adBlockDiv.P = adBlockDiv.querySelector('p');
                    playerRootDiv.appendChild(adBlockDiv);
                }
                if (adBlockDiv != null) {
                    isActivelyStrippingAds = data.isStrippingAdSegments;
                    const bannerText = 'Blocking' + (data.isMidroll ? ' midroll' : '') + ' ads' + (data.isStrippingAdSegments ? ' (stripping)' : '') + (data.activeBackupPlayerType ? ' (' + data.activeBackupPlayerType + ')' : '');
                    adBlockDiv.P.textContent !== bannerText && (adBlockDiv.P.textContent = bannerText);
                    const display = data.hasAds && playerBufferState.isLive ? 'block' : 'none';
                    adBlockDiv.style.display !== display && (adBlockDiv.style.display = display);
                }
                data.hasAds && hideTwitchAdOverlays();
            }
        }
        function getPlayerAndState() {
            // react keeps its root across navigation but can replace the player and media element
            if (cachedRootNode?.isConnected && cachedPlayerVideo?.isConnected && cachedPlayerPath === location.pathname && cachedPlayerAndState?.player?.core && cachedPlayerAndState.player.getHTMLVideoElement?.() === cachedPlayerVideo) return cachedPlayerAndState;
            cachedPlayerAndState = null;
            cachedPlayerVideo = null;
            function findReactNode(root, constraint) {
                if (root.stateNode && constraint(root.stateNode)) return root.stateNode;
                let node = root.child;
                while (node) {
                    const result = findReactNode(node, constraint);
                    if (result) return result;
                    node = node.sibling;
                }
                return null;
            }
            function findReactRootNode() {
                let reactRootNode = null;
                cachedRootNode && cachedRootNode.isConnected || (cachedRootNode = document.querySelector('#root'));
                const rootNode = cachedRootNode;
                rootNode && rootNode._reactRootContainer && rootNode._reactRootContainer._internalRoot && rootNode._reactRootContainer._internalRoot.current && (reactRootNode = rootNode._reactRootContainer._internalRoot.current);
                if (reactRootNode == null && rootNode != null) {
                    const containerName = Object.keys(rootNode).find(x => x.startsWith('__reactContainer') || x.startsWith('__reactFiber'));
                    containerName != null && (reactRootNode = rootNode[containerName]);
                }
                return reactRootNode;
            }
            const reactRootNode = findReactRootNode();
            if (!reactRootNode) return null;
            let player = findReactNode(reactRootNode, node => node.setPlayerActive && node.props && node.props.mediaPlayerInstance);
            player = player && player.props && player.props.mediaPlayerInstance ? player.props.mediaPlayerInstance : null;
            player?.playerInstance && (player = player.playerInstance);
            player || (player = findReactNode(reactRootNode, node => node.getHTMLVideoElement && node.getBufferDuration && node.core?.state));
            const playerState = findReactNode(reactRootNode, node => node.setSrc && node.setInitialPlaybackSettings);
            const playerStateFallback = playerState ? null : findReactNode(reactRootNode, node => node.setSrc && node.setStreamManagerNode && !node.getHTMLVideoElement);
            const playerStateFallback2 = playerState || playerStateFallback ? null : findReactNode(reactRootNode, node => node.state?.videoPlayerInstance?.playerMode !== void 0)?.state?.videoPlayerInstance;
            const finalPlayerState = playerState || playerStateFallback || playerStateFallback2;
            const result = {
                player: player,
                state: finalPlayerState
            };
            const video = player?.getHTMLVideoElement?.();
            if (player && finalPlayerState && video?.isConnected) {
                cachedPlayerAndState = result;
                cachedPlayerVideo = video;
                cachedPlayerPath = location.pathname;
            }
            return result;
        }
        // soft reload keeps the ios media element bound to the original user gesture
        const iosSoftReload = function () {
            try {
                const p = navigator.platform || '';
                if (/^(iPhone|iPad|iPod)/.test(p)) return true;
                return p === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
            } catch {
                return false;
            }
        }();
        function doTwitchPlayerTask(isPausePlay, isReload, reloadKind) {
            const playerAndState = getPlayerAndState();
            if (!playerAndState) return;
            const player = playerAndState.player;
            const playerState = playerAndState.state;
            if (!player) return;
            if (!playerState) return;
            const wasPaused = player.isPaused() || player.core?.paused;
            if (wasPaused) {
                // recovery must not undo a pause made through the player controls
                if (playerBufferState.userPauseIntent) return;
                if (playerBufferState.weJustPaused && Date.now() - playerBufferState.weJustPaused < 1e4) try {
                    player.play()?.catch?.(() => { });
                } catch { }
                return;
            }
            playerBufferState.weJustPaused = 0;
            playerBufferState.lastFixTime = Date.now();
            playerBufferState.numSame = 0;
            if (isPausePlay) {
                player.pause();
                player.play()?.catch?.(() => { });
                playerBufferState.weJustPaused = Date.now();
                return;
            }
            if (isReload && document.pictureInPictureElement) {
                player.pause();
                player.play()?.catch?.(() => { });
                return;
            }
            if (isReload) {
                const video = player.getHTMLVideoElement?.();
                if (video && video.readyState >= 3 && !video.paused && !video.ended) {
                    let latencySec = 0;
                    let latencyKnown = false;
                    try {
                        if (video.seekable && video.seekable.length > 0) {
                            const seekableEnd = video.seekable.end(video.seekable.length - 1);
                            if (Number.isFinite(seekableEnd)) {
                                const calc = Math.max(0, seekableEnd - video.currentTime);
                                if (calc < 3600) {
                                    latencySec = calc;
                                    latencyKnown = true;
                                }
                            }
                        }
                    } catch (e) { }
                    if (latencyKnown && !(latencySec > 7)) {
                        postTwitchWorkerMessage('ReloadSkipped');
                        return;
                    }
                }
            }
            if (isReload) {
                const lsKeyQuality = 'video-quality';
                const lsKeyMuted = 'video-muted';
                const lsKeyVolume = 'volume';
                const lsKeyLowLatency = 'lowLatencyModeEnabled';
                const lsKeyPersistence = 'persistenceEnabled';
                let currentQualityLS = null;
                let currentMutedLS = null;
                let currentVolumeLS = null;
                let currentLowLatencyLS = null;
                let currentPersistenceLS = null;
                try {
                    currentQualityLS = localStorage.getItem(lsKeyQuality);
                    currentMutedLS = localStorage.getItem(lsKeyMuted);
                    currentVolumeLS = localStorage.getItem(lsKeyVolume);
                    currentLowLatencyLS = localStorage.getItem(lsKeyLowLatency);
                    currentPersistenceLS = localStorage.getItem(lsKeyPersistence);
                    if (player.core?.state) {
                        localStorage.setItem(lsKeyMuted, JSON.stringify({
                            default: player.core.state.muted
                        }));
                        localStorage.setItem(lsKeyVolume, player.core.state.volume);
                    }
                    player?.core?.state?.quality?.group && localStorage.setItem(lsKeyQuality, JSON.stringify({
                        default: player.core.state.quality.group
                    }));
                } catch { }
                playerBufferState.lastReloadAt = Date.now();
                playerBufferState.adStallStartAt = 0;
                playerBufferState.userPauseIntent = false;
                const hardReload = reloadKind === 'early' && !iosSoftReload;
                const refreshToken = reloadKind === 'early';
                if (hardReload) try {
                    const v = getPlayerVideoElement();
                    const wasInitiallyUnmuted = v && !v.muted;
                    const shouldRecover = playerBufferState.vaftEverUnmuted;
                    if (v && (wasInitiallyUnmuted || shouldRecover)) {
                        wasInitiallyUnmuted && (v.muted = true);
                        let done = false;
                        const restore = () => {
                            if (done) return;
                            done = true;
                            document.removeEventListener('canplay', listener, true);
                            document.removeEventListener('playing', listener, true);
                            document.removeEventListener('loadeddata', listener, true);
                            try {
                                const cur = getPlayerVideoElement();
                                if (cur) {
                                    cur.muted = false;
                                    playerBufferState.vaftEverUnmuted = true;
                                }
                                v && v !== cur && v.isConnected && v.muted && wasInitiallyUnmuted && (v.muted = false);
                            } catch { }
                        };
                        const listener = e => {
                            e.target && e.target.tagName === 'VIDEO' && restore();
                        };
                        document.addEventListener('canplay', listener, true);
                        document.addEventListener('playing', listener, true);
                        document.addEventListener('loadeddata', listener, true);
                        // twitch can mute or replace the element again after the first playback event
                        setTimeout(restore, 4e3);
                        setTimeout(() => {
                            try {
                                const cur = getPlayerVideoElement();
                                if (cur && cur.muted) if (playerBufferState.userPauseIntent); else {
                                    cur.muted = false;
                                    playerBufferState.vaftEverUnmuted = true;
                                }
                                v && v !== cur && v.isConnected && v.muted && wasInitiallyUnmuted && !playerBufferState.userPauseIntent && (v.muted = false);
                            } catch { }
                        }, 5500);
                    }
                } catch { }
                (hardReload || refreshToken) && (playerBufferState.weJustPaused = Date.now());
                playerState.setSrc({
                    isNewMediaPlayerInstance: hardReload,
                    refreshAccessToken: refreshToken
                });
                postTwitchWorkerMessage('TriggeredPlayerReload');
                player.play()?.catch?.(() => { });
                setTimeout(() => {
                    try {
                        currentQualityLS && localStorage.setItem(lsKeyQuality, currentQualityLS);
                        currentMutedLS && localStorage.setItem(lsKeyMuted, currentMutedLS);
                        currentVolumeLS && localStorage.setItem(lsKeyVolume, currentVolumeLS);
                        currentLowLatencyLS !== null && localStorage.setItem(lsKeyLowLatency, currentLowLatencyLS);
                        currentPersistenceLS !== null && localStorage.setItem(lsKeyPersistence, currentPersistenceLS);
                        const video = getPlayerVideoElement();
                        const userIntendedMute = currentMutedLS && currentMutedLS.includes('"default":true');
                        video && video.muted && !userIntendedMute && (video.muted = false);
                        if (video && video.buffered.length > 0 && video.readyState >= 3) {
                            const liveEdge = video.buffered.end(video.buffered.length - 1);
                            const drift = liveEdge - video.currentTime;
                            hardReload && drift > 5 && Number.isFinite(liveEdge) && liveEdge < 3600 ? video.currentTime = liveEdge : drift > 2 && startDriftCorrection(video);
                        }
                    } catch { }
                }, 3e3);
                return;
            }
        }
        function postTwitchWorkerMessage(key, value) {
            twitchWorker?.postMessage({ key, value });
        }
        async function handleWorkerFetchRequest(fetchRequest) {
            const controller = new AbortController;
            const timeoutMs = 5e3;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await nativeFetch.call(window, fetchRequest.url, {
                    ...fetchRequest.options,
                    signal: controller.signal
                });
                const responseBody = await response.text();
                clearTimeout(timeoutId);
                const responseObject = {
                    id: fetchRequest.id,
                    status: response.status,
                    statusText: response.statusText,
                    redirected: response.redirected,
                    type: response.type,
                    url: response.url,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: responseBody
                };
                return responseObject;
            } catch (error) {
                clearTimeout(timeoutId);
                return {
                    id: fetchRequest.id,
                    error: error.name === 'AbortError' ? 'GQL fetch timeout (' + timeoutMs / 1e3 + 's)' : error.message
                };
            }
        }
        function hookFetch() {
            const realFetch = window.fetch;
            nativeFetch = realFetch;
            window.fetch = maskAsNative(function (url, init) {
                const requestUrl = typeof url === 'string' ? url : url instanceof URL ? url.href : url instanceof Request ? url.url : '';
                if (requestUrl) {
                    if (requestUrl.includes('gql')) {
                        const headers = new Headers(init?.headers || (url instanceof Request ? url.headers : void 0));
                        let deviceId = headers.get('X-Device-Id');
                        typeof deviceId !== 'string' && (deviceId = headers.get('Device-ID'));
                        if (typeof deviceId === 'string' && GQLDeviceID != deviceId) {
                            GQLDeviceID = deviceId;
                            postTwitchWorkerMessage('UpdateDeviceId', GQLDeviceID);
                        }
                        typeof headers.get('Client-Version') === 'string' && headers.get('Client-Version') !== ClientVersion && postTwitchWorkerMessage('UpdateClientVersion', ClientVersion = headers.get('Client-Version'));
                        typeof headers.get('Client-Session-Id') === 'string' && headers.get('Client-Session-Id') !== ClientSession && postTwitchWorkerMessage('UpdateClientSession', ClientSession = headers.get('Client-Session-Id'));
                        typeof headers.get('Client-Integrity') === 'string' && headers.get('Client-Integrity') !== ClientIntegrityHeader && postTwitchWorkerMessage('UpdateClientIntegrityHeader', ClientIntegrityHeader = headers.get('Client-Integrity'));
                        typeof headers.get('Authorization') === 'string' && headers.get('Authorization') !== AuthorizationHeader && postTwitchWorkerMessage('UpdateAuthorizationHeader', AuthorizationHeader = headers.get('Authorization'));
                        init && typeof init?.body === 'string' && init.body.includes('PlaybackAccessToken') && init.body.includes('picture-by-picture') && (init = {
                            ...init,
                            body: ''
                        });
                        if (ForceAccessTokenPlayerType && typeof init?.body === 'string' && init.body.includes('PlaybackAccessToken')) {
                            let replacedPlayerType = '';
                            const newBody = JSON.parse(init.body);
                            if (Array.isArray(newBody)) {
                                for (let i = 0; i < newBody.length; i++) if (newBody[i]?.variables?.playerType && newBody[i]?.variables?.playerType !== ForceAccessTokenPlayerType) {
                                    replacedPlayerType = newBody[i].variables.playerType;
                                    newBody[i].variables.playerType = ForceAccessTokenPlayerType;
                                }
                            } else if (newBody?.variables?.playerType && newBody?.variables?.playerType !== ForceAccessTokenPlayerType) {
                                replacedPlayerType = newBody.variables.playerType;
                                newBody.variables.playerType = ForceAccessTokenPlayerType;
                            }
                            replacedPlayerType && (init = {
                                ...init,
                                body: JSON.stringify(newBody)
                            });
                        }
                    }
                }
                return realFetch.call(this, url, init);
            }, 'fetch');
        }
        declareOptions(window);

        hookWindowWorker();
        hookFetch();
        monitorPlayerBuffering();

    }();
    const nativePause = HTMLMediaElement.prototype.pause;
    const cleanedVideos = new WeakSet;
    const clickedGates = new WeakSet;
    const gateSelector = '[data-a-target="content-classification-gate-overlay-start-watching-button"], [data-a-target="player-overlay-content-gate"]';
    const addedSelector = [config.removeCarousel ? 'video, source' : '', config.keepTabActive ? gateSelector : ''].filter(Boolean).join(', ');
    function cleanVideo(video) {
        if (!config.removeCarousel) return;
        if (video.tagName === 'SOURCE') {
            video = video.closest('video');
            if (!video) return;
            cleanedVideos.delete(video);
        }
        if (cleanedVideos.has(video) || !video.closest('[class*="carousel"]')) return;
        cleanedVideos.add(video);
        video.muted = true;
        // css alone leaves carousel audio and downloads running
        nativePause.call(video);
        if (video.srcObject) video.srcObject = null;
        video.removeAttribute('src');
        video.querySelectorAll('source').forEach(source => source.remove());
        video.load();
    }
    function dismissGate(element) {
        if (!config.keepTabActive) return;
        const gate = element.closest(gateSelector);
        if (!gate) return;
        const button = gate.tagName === 'BUTTON' ? gate : gate.querySelector('button:not([disabled])');
        if (button && !button.disabled && !clickedGates.has(button)) {
            clickedGates.add(button);
            button.click();
        }
    }
    function processAddedElement(element) {
        if (element.nodeType !== 1) return;
        (element.tagName === 'VIDEO' || element.tagName === 'SOURCE') && cleanVideo(element);
        (element.tagName === 'BUTTON' || element.hasAttribute('data-a-target')) && dismissGate(element);
        if (!element.firstElementChild) return;
        element.querySelectorAll(addedSelector).forEach(child => {
            child.tagName === 'VIDEO' || child.tagName === 'SOURCE' ? cleanVideo(child) : dismissGate(child);
        });
    }
    function startUI() {
        // css handles later react renders without rescanning chat messages
        const rules = [];
        function hide(enabled, selectors) {
            if (enabled) rules.push(selectors + ' { display: none !important; }');
        }
        // expanded and collapsed story controls have different wrappers with their own margins
        hide(config.hideStories, '[class*="storiesLeftNavSection"], [data-a-target="side-nav-stories"], #side-nav div:has(> button [aria-label="Open stories"], > button [aria-label$="channels with unread Stories" i]), #side-nav div:has(> div > button > [class*="storiesLeftNavSectionCollapsedButton"])');
        hide(config.hideRecommendedCategories, '.side-nav-section:has(a[href^="/directory/category/"]), .side-nav-section:has(a[href^="/directory/game/"]), [data-a-target="side-nav-games-list"], [data-a-target="side-nav-recommended-games"]');
        hide(config.removeCarousel, '[class*="carousel"]:has(video)');
        hide(config.hidePromoButtons, 'div:has(> div > button[data-a-target="top-nav-get-bits-button"]), .top-nav__prime, [data-a-target="prime-offers-icon"], .prime-offers__pill, button:has(path[d^="m13 8-5.349"])');
        hide(config.hideExtensionBanner, '[data-test-selector="extension-disclaimer"]');
        hide(config.hideWhispers, '[data-a-target="whisper-box-button"], [data-a-target="whispers-button"], .top-nav [aria-label="Whispers"], .top-nav [aria-label="Flüstern"]');
        const notifications = '[data-a-target="notifications-button"], [data-a-target="activity-feed-button"], .top-nav :is(button, [role="button"]):is([aria-label*="Notifications" i], [aria-label*="Benachrichtigungen" i], [title="Notifications"], [title="Benachrichtigungen"])';
        hide(config.hideNotifications, notifications + ', .top-nav div:has(> :is(' + notifications + '):only-child)');
        hide(config.hideShareButton, '[data-a-target="share-button"], div:has(> button[data-a-target="share-button"]:only-child)');
        hide(config.hideDropsHighlights, '.community-highlight-stack__card:has([class*="dropsHighlight"]), [class*="dropsHighlight"]');
        hide(config.hideGiftedSubHighlights, '.community-highlight-stack__card:has(.gift-highlight-gradient-container)');
        hide(config.hideHypeTrain, '.sticky-community-highlight:has([class*="hypeTrainBanner"], [aria-controls="hype-train-expanded-view"], #hype-train-expanded-view), .community-highlight-stack__card:has([class*="hypeTrainBanner"], #hype-train-expanded-view), [class*="hypeTrainBanner"], #hype-train-expanded-view');
        hide(config.hideSubscribe, '[data-a-target="subscribe-button"], [data-a-target="subscribe-button-dropdown"]');
        const giftWrapper = '[data-target="channel-header-right"] div:has(> div:only-child > div:only-child > button[data-a-target="gift-button"])';
        hide(config.hideGiftSub, '[data-a-target="gift-button"], [data-a-target="gift-sub-button"], ' + giftWrapper);
        if (config.hideSubscribe) rules.push(giftWrapper + ' { margin-right: 0 !important; }');
        hide(config.hideSubscribe && config.hideGiftSub, '[data-target="channel-header-right"] > div:has([data-a-target="subscribe-button"]):has([data-a-target="gift-button"])');
        // the outer goals wrapper keeps a bottom margin when only its content is hidden
        hide(config.hideGoals, '.about-section__actions, .about-section > div:has(> .about-section__actions)');
        hide(config.hideChannelPanels, '.channel-panels');
        // the unstyled chat child wraps the leaderboard and its navigation arrows
        hide(config.hideLeaderboard, '.chat-room__content > div:has([data-testid^="leaderboard-"], [class*="bitsLeaderboard"], button[aria-label="Next leaderboard set"], button[aria-label="Previous leaderboard set"]), [data-test-selector="channel-leaderboard-container"], .channel-leaderboard');
        hide(config.blockAds, '[data-test-selector="sda-wrapper"]');
        if (rules.length) {
            const style = document.createElement('style');
            style.textContent = rules.join('\n');
            (document.head || document.documentElement).appendChild(style);
        }
        if (!config.removeCarousel && !config.keepTabActive) return;
        processAddedElement(document.documentElement);
        new MutationObserver(mutations => {
            for (const mutation of mutations) if (mutation.type === 'attributes') if (mutation.attributeName === 'src' && (mutation.target.tagName === 'VIDEO' || mutation.target.tagName === 'SOURCE') && mutation.target.hasAttribute('src')) {
                cleanedVideos.delete(mutation.target);
                cleanVideo(mutation.target);
            } else mutation.attributeName === 'disabled' && dismissGate(mutation.target); else for (const node of mutation.addedNodes) processAddedElement(node);
        }).observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [...config.keepTabActive ? ['disabled'] : [], ...config.removeCarousel ? ['src'] : []]
        });
    }
    if (document.documentElement) startUI(); else {
        const observer = new MutationObserver(() => {
            if (document.documentElement) {
                observer.disconnect();
                startUI();
            }
        });
        observer.observe(document, {
            childList: true
        });
    }
    // worker media sources bypass src mutations and can restart the carousel
    if (config.removeCarousel) for (const type of ['loadstart', 'play']) document.addEventListener(type, event => {
        const video = event.target;
        if (video.tagName === 'VIDEO' && (video.srcObject || !video.paused)) {
            cleanedVideos.delete(video);
            cleanVideo(video);
        }
    }, true);
    if (config.keepTabActive) {
        // spoof visibility instead of overriding pause so normal user controls keep working
        for (const [property, value] of [['hidden', false], ['webkitHidden', false], ['visibilityState', 'visible']]) try {
            Object.defineProperty(Document.prototype, property, {
                configurable: true,
                get: () => value
            });
        } catch { }
        try {
            Object.defineProperty(Document.prototype, 'hasFocus', {
                configurable: true,
                value: () => true
            });
        } catch { }
        for (const type of ['visibilitychange', 'webkitvisibilitychange']) document.addEventListener(type, event => event.stopImmediatePropagation(), true);
        window.addEventListener('blur', event => {
            event.target === window && event.stopImmediatePropagation();
        }, true);
        const NativeIO = window.IntersectionObserver;
        typeof NativeIO === 'function' && (window.IntersectionObserver = class extends NativeIO {
            constructor(callback, options) {
                if (typeof callback !== 'function') throw new TypeError('IntersectionObserver callback must be a function');
                super((entries, observer) => callback.call(observer, entries.map(entry => {
                    const target = entry.target;
                    // carousel media must keep its native intersection state
                    if (target.closest('[class*="carousel"]') || target.tagName !== 'VIDEO' && !target.closest('[data-a-target="player-overlay"], [data-a-target="player-container"]')) return entry;
                    // keep native getters and timing fields while changing only player visibility
                    return new Proxy(entry, {
                        get(original, property) {
                            if (property === 'isIntersecting') return true;
                            if (property === 'intersectionRatio') return 1;
                            if (property === 'intersectionRect') return original.boundingClientRect;
                            return Reflect.get(original, property, original);
                        }
                    });
                }), observer), options);
            }
        });
    }
})();
