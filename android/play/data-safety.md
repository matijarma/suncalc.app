# Data Safety worksheet — Android 1.0

Publisher: Matija Radeljak · contact: matijar.info@gmail.com · [public privacy policy](https://suncalc.app/android/privacy/).

| Flow | Data leaving the device | Purpose and user choice |
| --- | --- | --- |
| Trial registration | Pseudonymous app-scoped device value, first-open time and random installation credential. The Worker stores digests. | App functionality and preventing repeated trials. Used when connected, with no SunCalc account. |
| Map tiles | Tile coordinates/zoom identify the viewed area; tapping location may make this the user's current area. At street zoom it may be precise. The network provider necessarily processes the request IP. | Map functionality. Device location permission is optional. Included tiles remain local. |
| Global address search | Only the explicitly submitted address or search text goes through SunCalc to Geoapify. | Optional search functionality. The included town index works on-device. |
| Google Play purchase and restore | Product ID and purchase token, verification status and subscription expiry. The server stores a token digest and entitlement. Google Play handles financial transactions. | Optional purchase history for billing, fraud prevention and restoration. SunCalc does not receive payment card details. |
| Live Shadow | No location, compass or sensor readings are transmitted by the dial. | Optional foreground access. No camera or background location. |
| Pins and sharing | Bookmarks and preferences are local. Only an explicit share action hands the selected pin and time to another app. | User-initiated sharing. No public feed, profile or SunCalc cloud backup. |

Declare the transmitted device identifiers, purchase history, map/location information and explicitly submitted search data as applicable. The build uses HTTPS, has no advertising ID permission, no ads, and no user account to delete. Privacy/deletion requests can be made to the publisher at the address above. Declare Google Play Billing and any other SDK data according to the current [Play disclosure instructions](https://support.google.com/googleplay/android-developer/answer/10787469). The final form needs the developer's confirmation of their processor relationships and current Play Console categories.
