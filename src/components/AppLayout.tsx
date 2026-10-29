import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BriefcaseBusiness,
  Coins,
  Image,
  LayoutGrid,
  Lock,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  MoreHorizontal,
  Palette,
  User,
  Wand2,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WhatsAppIcon } from '@/components/WhatsAppIcon';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


type NavItem = {
  to: string;
  matchTo: string;
  label: string;
  icon: typeof LayoutGrid;
  locked?: boolean;
  comingSoon?: boolean;
};

const privateNavItems: NavItem[] = [
  { to: '/dashboard', matchTo: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/generator', matchTo: '/generator', label: 'Generator', icon: Wand2 },
  { to: '/generator-reklam', matchTo: '/generator-reklam', label: 'Reklamy', icon: Megaphone },
  { to: '/company-assistant', matchTo: '/company-assistant', label: 'Firma', icon: BriefcaseBusiness },
  { to: '/tools', matchTo: '/tools', label: 'Narzędzia', icon: Wrench },
  { to: '/gallery', matchTo: '/gallery', label: 'Galeria', icon: Image },
  { to: '/credits', matchTo: '/credits', label: 'Kredyty', icon: Coins },
];

const publicNavItems: NavItem[] = [
  { to: '/auth?returnTo=/dashboard', matchTo: '/dashboard', label: 'Dashboard', icon: LayoutGrid, locked: true },
  { to: '/auth?returnTo=/generator', matchTo: '/generator', label: 'Generator', icon: Wand2, locked: true },
  { to: '/auth?returnTo=/generator-reklam', matchTo: '/generator-reklam', label: 'Reklamy', icon: Megaphone, locked: true },
  { to: '/auth?returnTo=/company-assistant', matchTo: '/company-assistant', label: 'Firma', icon: BriefcaseBusiness, locked: true },
  { to: '/tools', matchTo: '/tools', label: 'Narzędzia', icon: Wrench },
  { to: '/galeria-publiczna', matchTo: '/galeria-publiczna', label: 'Galeria publiczna', icon: Image },
  { to: '/auth?returnTo=/gallery', matchTo: '/gallery', label: 'Galeria', icon: Image, locked: true },
  { to: '/auth?returnTo=/credits', matchTo: '/credits', label: 'Kredyty', icon: Coins, locked: true },
];

export function AppLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  const [sheetOpen, setSheetOpen] = useState(false);

  const allNavItems = (user ? privateNavItems : publicNavItems).map((item) => {
    const comingSoon = item.matchTo === '/company-assistant'
      && (!user || adminLoading || !isAdmin);
    return { ...item, comingSoon, locked: item.locked || comingSoon };
  });


  const isActive = (to: string) => location.pathname === to || (to === '/tools' && location.pathname.startsWith('/tools'));
  const compactPrimaryItems = allNavItems.filter(({ matchTo }) => ['/dashboard', '/generator', '/tools'].includes(matchTo));
  const compactMoreItems = allNavItems.filter(({ matchTo }) => !['/dashboard', '/generator', '/tools'].includes(matchTo));
  const compactMoreActive = compactMoreItems.some(({ matchTo }) => isActive(matchTo));

  return (
    <div className="min-h-screen min-w-0 flex flex-col overflow-x-clip">
      <header className="sticky top-0 z-50 glass-card border-b">
        <div className="mx-auto w-full max-w-[1400px] min-w-0 px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg gradient-bg flex items-center justify-center shrink-0">
              <Palette className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold sm:font-bold text-[13px] sm:text-lg leading-none gradient-text whitespace-nowrap">
              Kreator Grafik AI
            </span>
          </Link>

          {(
            <nav className="hidden items-center gap-1 2xl:flex">
              {allNavItems.map(({ to, matchTo, label, icon: Icon, locked, comingSoon }) => comingSoon ? (
                <Button key={matchTo} variant="ghost" size="sm" disabled className="gap-1.5 opacity-70" aria-label={`${label} — Dostępne wkrótce`}>
                  <Icon className="h-4 w-4" />
                  <span className="flex flex-col items-start leading-tight"><span>{label}</span><span className="text-[9px]">Dostępne wkrótce</span></span>
                  <Lock className="h-3 w-3" />
                </Button>
              ) : (
                <Link key={`${label}-${to}`} to={to}>
                  <Button
                    variant={isActive(matchTo) ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      isActive(matchTo) && 'gradient-bg',
                      locked && 'text-muted-foreground',
                      'gap-1.5',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden md:inline">{label}</span>
                    {locked && <Lock className="hidden h-3 w-3 md:inline" />}
                  </Button>
                </Link>
              ))}
            </nav>
          )}

          {(
            <nav className="hidden min-w-0 items-center gap-1 lg:flex 2xl:hidden" aria-label="Główna nawigacja">
              {compactPrimaryItems.map(({ to, matchTo, label, icon: Icon, locked }) => (
                <Link key={`${label}-${to}-compact`} to={to}>
                  <Button
                    variant={isActive(matchTo) ? 'default' : 'ghost'}
                    size="sm"
                    aria-label={label}
                    className={cn(
                      isActive(matchTo) && 'gradient-bg',
                      locked && 'text-muted-foreground',
                      'gap-1.5 px-2 lg:px-3',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden lg:inline">{label}</span>
                    {locked && <Lock className="hidden h-3 w-3 xl:inline" />}
                  </Button>
                </Link>
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={compactMoreActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn('gap-1.5 px-2 lg:px-3', compactMoreActive && 'gradient-bg')}
                    aria-label="Więcej opcji"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="hidden lg:inline">Więcej</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {compactMoreItems.map(({ to, matchTo, label, icon: Icon, locked, comingSoon }) => comingSoon ? (
                    <DropdownMenuItem key={`${matchTo}-compact`} disabled className="gap-3 py-2">
                      <Icon className="h-4 w-4" />
                      <span className="flex flex-1 flex-col items-start leading-tight">
                        <span>{label}</span>
                        <span className="text-[10px] text-muted-foreground">Dostępne wkrótce</span>
                      </span>
                      <Lock className="h-3.5 w-3.5" />
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={`${label}-${to}-compact`} asChild>
                      <Link to={to} className={cn('gap-3 py-2', isActive(matchTo) && 'bg-accent font-medium')}>
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{label}</span>
                        {locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {user && (
              <Link to={user ? '/profile' : '/auth'} className="hidden lg:inline-flex">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <User className="w-4 h-4" />
                  <span className="hidden xl:inline">Profil</span>
                </Button>
              </Link>
            )}

            <ThemeToggle />

            {(
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 gap-2 px-2 lg:hidden" aria-label="Otwórz menu">
                    <Menu className="w-5 h-5" />
                    <span className="hidden min-[360px]:inline">Menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72 max-w-[90vw] overflow-y-auto p-0">
                  <SheetTitle className="sr-only">Menu</SheetTitle>
                  <nav className="flex flex-col gap-1 p-4 pt-12">
                    {allNavItems.map(({ to, matchTo, label, icon: Icon, locked, comingSoon }) => comingSoon ? (
                      <Button key={matchTo} variant="ghost" disabled className="h-auto w-full justify-start gap-3 py-2 opacity-70" aria-label={`${label} — Dostępne wkrótce`}>
                        <Icon className="h-4 w-4" />
                        <span className="flex flex-col items-start"><span>{label}</span><span className="text-[10px]">Dostępne wkrótce</span></span>
                        <Lock className="ml-auto h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Link key={`${label}-${to}`} to={to} onClick={() => setSheetOpen(false)}>
                        <Button
                          variant={isActive(matchTo) ? 'default' : 'ghost'}
                          className={cn(
                            'w-full justify-start gap-3',
                            isActive(matchTo) && 'gradient-bg',
                            locked && 'text-muted-foreground',
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                          {locked && <Lock className="ml-auto h-3.5 w-3.5" />}
                        </Button>
                      </Link>
                    ))}

                    {user ? (
                      <>
                        <Link to="/profile" onClick={() => setSheetOpen(false)}>
                          <Button
                            variant={location.pathname === '/profile' ? 'default' : 'ghost'}
                            className={cn('w-full justify-start gap-3', location.pathname === '/profile' && 'gradient-bg')}
                          >
                            <User className="w-4 h-4" />
                            Profil
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-3"
                          onClick={() => {
                            setSheetOpen(false);
                            signOut();
                          }}
                        >
                          <LogOut className="w-4 h-4" />
                          Wyloguj
                        </Button>
                      </>
                    ) : (
                      <Link to="/auth" onClick={() => setSheetOpen(false)}>
                        <Button variant="ghost" className="w-full justify-start gap-3">
                          <LogIn className="w-4 h-4" />
                          Zaloguj
                        </Button>
                      </Link>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            )}
            {user ? (
              <Button variant="ghost" size="sm" onClick={signOut} className="hidden gap-1.5 lg:inline-flex">
                <LogOut className="w-4 h-4" />
                <span className="hidden xl:inline">Wyloguj</span>
              </Button>
            ) : (
              <Link to="/auth" className="hidden lg:inline-flex">
                <Button variant="outline" size="sm">Zaloguj</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={cn('flex-1 w-full min-w-0 mx-auto px-4 overflow-x-clip', wide ? 'max-w-none py-3' : 'max-w-[1400px] py-6')}>
        {children}
      </main>

      {user && (
        <Link
          to="/whatsapp"
          aria-label="Kanał WhatsApp"
          className={cn(
            'fixed right-4 bottom-24 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#1ebd59] focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2',
            wide && 'lg:hidden',
            location.pathname === '/whatsapp' && 'ring-2 ring-[#25D366] ring-offset-2',
          )}
        >
          <WhatsAppIcon className="h-5 w-5" />
        </Link>
      )}

      <footer className={cn('border-t py-4', wide && 'lg:hidden')}>
        <div className="container mx-auto px-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>© 2026 Kreator Grafik AI</span>
          <span>·</span>
          <Link to="/blog" className="hover:text-foreground transition-colors">Blog</Link>
          <span>·</span>
          <Link to="/regulamin" className="hover:text-foreground transition-colors">Regulamin</Link>
          <span>·</span>
          <Link to="/polityka-prywatnosci" className="hover:text-foreground transition-colors">Polityka prywatności</Link>
        </div>
      </footer>
    </div>
  );
}
