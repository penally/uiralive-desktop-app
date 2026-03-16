import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
  Search,
  LogIn,
  LogOut,
  House,
  TvIcon,
  Clapperboard,
  LayoutPanelLeft,
  Settings,
  BookHeart,
  Shield,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { NavTooltip } from "@/components/navbar/nav-tooltip"
import { useAuth } from "@/contexts/AuthContext"
import { LogoutConfirmModal } from "@/components/LogoutConfirmModal"
import { SettingsModal } from "@/components/SettingsModal"

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path?: string
  onClick?: () => void
}

type NavGroup = NavItem[]

export function SidebarNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const [fallbackActiveId, setFallbackActiveId] = useState<string>("home")
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const handleSettingsClick = () => {
    setShowSettingsModal(true)
  }

  const handleAuthClick = () => {
    if (isAuthenticated) {
      setShowLogoutModal(true)
    } else {
      navigate("/login")
    }
  }

  const handleLogoutConfirm = () => {
    logout()
    setShowLogoutModal(false)
    navigate("/")
  }

  const handleLogoutCancel = () => {
    setShowLogoutModal(false)
  }

  const navGroups: NavGroup[] = [
    // Group 1: Search + Home
    [
      { id: "search", label: "Search", icon: Search, path: "/search" },
      { id: "home", label: "Home", icon: House, path: "/" },
    ],
    // Group 2: Media
    [
      { id: "movie", label: "Movies", icon: Clapperboard, path: "/movie" },
      { id: "tv", label: "Shows", icon: TvIcon, path: "/tv" },
      { id: "categories", label: "Categories", icon: LayoutPanelLeft, path: "/categories" },
      { id: "anime", label: "Anime", icon: BookHeart, path: "/anime" },
    ],
    // Group 3: Account & Settings
    [
      ...(user?.isAdmin ? [{ id: "admin" as const, label: "Admin", icon: Shield, path: "/admin" as const }] : []),
      { 
        id: "auth", 
        label: isAuthenticated ? "Log Out" : "Sign In", 
        icon: isAuthenticated ? LogOut : LogIn, 
        onClick: handleAuthClick 
      },
      { id: "settings", label: "Settings", icon: Settings, onClick: handleSettingsClick },
    ],
  ]

  const allItems = navGroups.flat()
  const routeMatch = allItems.find((item) => item.path === location.pathname)
  const activeId = routeMatch ? routeMatch.id : fallbackActiveId

  return (
    <>
      {/* Desktop / tablet sidebar */}
      <nav
        aria-label="Main navigation"
        className={cn(
          "fixed left-0 top-1/2 -translate-y-1/2 z-50 cursor-pointer",
          "rounded-r-2xl",
          // Semi-transparent black glass so underlying colors show through
          "bg-black/35 backdrop-blur-2xl",
          "border border-l-0 border-white/8",
          "shadow-[2px_0_18px_rgba(0,0,0,0.45)]",
          "px-1.5 py-3",
          "hidden sm:block"
        )}
      >
        <div className="flex flex-col items-center">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="flex flex-col items-center">
              {groupIndex > 0 && (
                <div className="w-5 h-px bg-[hsl(var(--nav-separator)/0.15)] my-2" />
              )}
              {group.map((item) => {
                const Icon = item.icon
                const isActive = item.id === "settings" ? showSettingsModal : activeId === item.id
                const isLogout = item.id === "auth" && isAuthenticated
                return (
                  <NavTooltip key={item.id} label={item.label} side="right">
                    <button
                      onClick={() => {
                        if (item.onClick) {
                          item.onClick()
                        } else if (item.path) {
                          navigate(item.path)
                        } else {
                          setFallbackActiveId(item.id)
                        }
                      }}
                      aria-label={item.label}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 outline-none my-0.5 cursor-pointer",
                        isActive
                          ? "text-white"
                          : isLogout
                          ? "text-white/80 hover:text-[#DA3E44]"
                          : "text-white/70 hover:text-white"
                      )}
                    >
                      {isActive && (
                        <span className="absolute inset-0 rounded-lg bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.18)]" />
                      )}
                      <Icon className="relative z-10 size-[18px]" />
                    </button>
                  </NavTooltip>
                )
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile floating dock */}
      <nav
        aria-label="Main navigation"
        className={cn(
          "fixed inset-x-0 bottom-3 z-50 flex justify-center sm:hidden",
          "pointer-events-none"
        )}
      >
        <div
          className={cn(
            "pointer-events-auto flex items-center gap-1.5",
            "rounded-full bg-black/45 backdrop-blur-2xl",
            "border border-white/8",
            "shadow-[0_10px_35px_rgba(0,0,0,0.65)]",
            "px-2 py-1"
          )}
        >
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="flex items-center">
              {groupIndex > 0 && (
                <div className="mx-1 h-5 w-px bg-[hsl(var(--nav-separator)/0.2)]" />
              )}
              <div className="flex items-center gap-1">
                {group.map((item) => {
                  const Icon = item.icon
                  const isActive = item.id === "settings" ? showSettingsModal : activeId === item.id
                  const isLogout = item.id === "auth" && isAuthenticated
                  return (
                    <NavTooltip key={item.id} label={item.label} side="top">
                      <button
                        onClick={() => {
                          if (item.onClick) {
                            item.onClick()
                          } else if (item.path) {
                            navigate(item.path)
                          } else {
                            setFallbackActiveId(item.id)
                          }
                        }}
                        aria-label={item.label}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "relative flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 outline-none cursor-pointer",
                          isActive
                            ? "text-white"
                            : isLogout
                            ? "text-white/80 hover:text-[#DA3E44]"
                            : "text-white/70 hover:text-white"
                        )}
                      >
                        {isActive && (
                          <span className="absolute inset-0 rounded-full bg-white/12 shadow-[0_0_0_1px_rgba(255,255,255,0.18)]" />
                        )}
                        <Icon className="relative z-10 size-[18px]" />
                      </button>
                    </NavTooltip>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onConfirm={handleLogoutConfirm}
        onCancel={handleLogoutCancel}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        initialTab="appearance"
      />
    </>
  )
}
