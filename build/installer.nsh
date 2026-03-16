; Custom NSIS macros for Uira Live installer
; Modern welcome and finish page text

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Uira Live"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of Uira Live.$\r$\n$\r$\nUira Live is your desktop app for streaming movies, TV shows, and anime with a built-in extension for extension-required sources.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend
