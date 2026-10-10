# Userscripts

Each feature can be changed via the `config` object, which has main & sub settings, whenever the main is disabled, all sub settings won't be used. You can use these scripts via e.g. [violentmonkey](https://github.com/Violentmonkey/Violentmonkey) (`New > New from file > Save & Close`, or raw URLs & `Install from URL`).

## YouTube

```powershell
https://raw.githubusercontent.com/nohuto/userscripts/refs/heads/main/youtube.js
```

### theaterMode

Opens desktop watch pages in theater mode (once per video).

### preferredQuality

Sets the video quality once per video, if a video doesn't have the chosen height, the lower (available) one is used.

| Value | Quality |
|---|---|
| `4320` | 8K |
| `2160` | 4K |
| `1440` | 1440p |
| `1080` | 1080p |
| `720` | 720p |
| `480` / `360` / `240` / `144` | SD |
| `0` | YouTube default |

### sponsorBlock

Skips segments submitted to [SponsorBlock](https://sponsor.ajay.app), which are shown in the top left in the player.

![](assets/youtube/sponsorBlock.png?raw=true)

#### sponsorCategories

Segment categories to skip:

| Category | Segment |
|---|---|
| `sponsor` | Paid promotion, paid referrals, direct ads |
| `selfpromo` | Unpaid/self promotion |
| `interaction` | Reminders to like, subscribe or follow |
| `intro` | Intermission/intro animation without actual content |
| `outro` | End cards & credits |
| `preview` | Previews/recaps of whats coming up or what happened before |
| `hook` | Narrated teasers for the upcoming video, greetings, goodbyes |
| `filler` | Notes/jokes not needed to understand the main content |
| `music_offtopic` | Non music parts of music videos |
| `poi_highlight` | Shows a "Highlight at x:xx (jump)" notice that jumps to the part most people look for (not skipped) |

`[]` disables skipping.

#### sponsorMinVotes

Minimum votes a segment needs, negative values can be used to skip segments that got downvoted, `-2` skips everything except actually rejected segments.

#### sponsorNotifications

Shows "Skippable segments found", "Skipped ... segment" and highlight notices in the top left of the player.

#### sponsorHashing

`true` only sends the first 4 characters of the video IDs SHA-256 hash, so the server doesn't learn which video you watch, `false` sends the video id (also used by DeArrow).

#### sponsorServer

API host without `https://` or a path, `sponsor.ajay.app` is the official SponsorBlock & DeArrow API (also used by DeArrow).

### deArrow

Replaces clickbait titles & thumbnails on video cards with community submissions from [DeArrow](https://dearrow.ajay.app).

![](assets/youtube/deArrow-before.png?raw=true)

![](assets/youtube/deArrow-after.png?raw=true)

#### replaceTitles

Replaces the title with suggested ones from the community.

#### replaceThumbnails

Uses the community thumbnail (frame picked from the video).

### filterVideos

#### hideMembersOnly

Videos only channel members can watch, YT uses the same badge for "Members first" (early access), so those are hidden too.

![](assets/youtube/hideMembersOnly.png?raw=true)

#### hideBuyOrRent

Movies/videos you've to buy or rent.

![](assets/youtube/hideBuyOrRent.png?raw=true)

#### filterTitles

Hides videos that have a matching title, each entry is a case insensitive [regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions), e.g. `['giveaway', 'reaction', '\\bpodcast\\b']`.

#### filterChannels

Hides videos from channels, by name or @handle, case insensitive, e.g. `['Channel', '@handle']`.

#### filterMinDuration

Hides videos shorter than the amount many seconds, e.g. `600` for 10 minutes, `0` turns it off.

### blockShorts

Hides 'Shorts' shelves, cards, tabs, sidebar entries, and redirects `/shorts/` pages to the home page.

![](assets/youtube/blockShorts.png?raw=true)

### masthead (top bar)

![](assets/youtube/masthead.png?raw=true)

### guide

The sidebar (YouTube calls it the "guide").

![](assets/youtube/guide.png?raw=true)

### feeds

#### hideFilterChips

Filter bars like "All / Shorts / Videos" or "Latest / Popular / Oldest":

![](assets/youtube/hideFilterChips.png?raw=true)

#### hideSearchShelves

Recommendation shelves inside search results ("Latest from ...", "People also watched", "For you", related searches).

#### hideMostRelevant

![](assets/youtube/hideMostRelevant.png?raw=true)

#### hideThumbnails

All video thumbnails, titles and metadata take the full width.

### watchPage

#### hideJoin

![](assets/youtube/hideJoin.png?raw=true)

#### hideSuperThanks

The "Thanks" donation button below videos that enabled *Super Thanks*.

#### hideComments

Block below the video metadata:

![](assets/youtube/hideComments.png?raw=true)

#### hideDescription

The description box with views and upload date:

![](assets/youtube/hideDescription.png?raw=true)

#### hideRelatedVideos

The recommended videos next to or below the player. Live chat, playlists and open panels stay, otherwise the column is removed.

![](assets/youtube/hideRelatedVideos.png?raw=true)

### gridItemsPerRow

Most videos per row in video grids (home, subscriptions, channel pages), `0` keeps YT default.

![](assets/youtube/gridItemsPerRow-before.png?raw=true)

![](assets/youtube/gridItemsPerRow-after.png?raw=true)

### disableInlinePlayback

Turns off the "Inline playback" setting, so hovering a thumbnail never starts a preview & thumbnails don't animate.

### disableAnimations

Removes page transitions/animations outside the player (cosmetic), but causes +~50ms of style work on feed loads.

## Twitch

```powershell
https://raw.githubusercontent.com/nohuto/userscripts/refs/heads/main/twitch.js
```

### blockAds

Removes video ads from live streams by swapping in ad free playlists & hides display ads.

### keepTabActive

Keeps playback running in background tabs/minimized windows.

### preferredQuality

Quality group the player starts with, names (fallback to auto):

| Value | Quality |
|---|---|
| `1080p60` | 1080p at 60 fps |
| `720p60` | 720p at 60 fps |
| `720p30` | 720p at 30 fps |
| `480p30` | 480p |
| `360p30` | 360p |
| `160p30` | 160p |
| `''` | Default |

### theatreMode

Opens channel pages in theatre mode once per channel.

### topNav

![](assets/twitch/topNav.png?raw=true)

### sideNav

#### hideStories

Stories row (that icon and stories):

![](assets/twitch/hideStories.png?raw=true)

#### hideRecommendedCategories

![](assets/twitch/hideRecommendedCategories.png?raw=true)

### removeCarousel

![](assets/twitch/removeCarousel.png?raw=true)

### hidePromoted

Promoted event cards in directories & promoted channels in the side nav.

### channelPage

![](assets/twitch/channelPage.png?raw=true)

#### hideGoals

![](assets/twitch/hideGoals.png?raw=true)

#### hideChannelSkins

Sponsored "channel skins" = banners above chat, ribbons below the player & artwork over the player.

#### hideCelebrations

Celebration and confetti effects over the player/chat.

### chat

![](assets/twitch/chat.png?raw=true)

![](assets/twitch/hidePowerUpsAndRewards.png?raw=true)

When several highlights are shown above chat (drops, gifted subs, hype train, polls, predictions, pinned messages), Twitch stacks them into one card that is shown, which is only hidden when every highlight in it is hidden.

#### hidePowerUpsAndRewards

![](assets/twitch/hidePowerUpsAndRewards.png?raw=true)

#### hideWatchStreaks

"Save your streak" side nav row, the watch streak reward in the channel points menu & streak indicators.

#### hideUserNotices

Event messages in chat (values are Twitchs own event names):

| Value | Message |
|---|---|
| `sub` | New subscription |
| `resub` | Resubscription (message the viewer wrote stays visible) |
| `subgift` | Gifted sub to one viewer |
| `submysterygift` | Gift bomb, subs gifted to the community |
| `raid` | Raid |
| `viewermilestone` | Watch streak milestone (message the viewer wrote stays visible) |

![](assets/twitch/hideUserNotices.png?raw=true)

### sevenTVEmotes

Shows [7TV](https://7tv.app) & and channel emotes in chat.

### compactChat

Less padding between chat messages.
