# Responsive layout decision

Lifestack uses viewport breakpoints rather than device or user-agent detection.

- Below `768px` (`md`), the application uses the mobile navigation drawer.
- At `768px` and above, it shows the sidebar and desktop header controls.
- Below `1024px` (`lg`), wide spending tables use mobile/tablet cards.
- At `1024px` and above, those tables use the full desktop presentation.

This intentionally produces a hybrid iPad experience: portrait tablets generally
show desktop navigation with tablet-friendly cards, while landscape tablets can
show the full desktop tables. Split View, browser zoom, and Safari viewport
settings can move a device between these modes. This is a deliberate responsive
choice and is not based on whether the browser identifies as an iPad.
