export type ThemeSetting = 'system' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'pf-theme-setting'

function getSystemTheme(): 'light' | 'dark' {
  try{
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }catch{
    return 'light'
  }
}

export function getThemeSetting(): ThemeSetting {
  try{
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if(v === 'light' || v === 'dark' || v === 'system') return v
  }catch{}
  return 'system'
}

export function setThemeSetting(value: ThemeSetting){
  try{ localStorage.setItem(THEME_STORAGE_KEY, value) }catch{}
  applyTheme()
}

export function applyTheme(){
  const setting = getThemeSetting()
  const effective = setting === 'system' ? getSystemTheme() : setting
  try{
    document.documentElement.setAttribute('data-theme-effective', effective)
  }catch{}
}

// React op systeemwijzigingen wanneer gebruiker 'system' heeft gekozen
try{
  if(window && window.matchMedia){
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      if(getThemeSetting() === 'system') applyTheme()
    }
    if(typeof mql.addEventListener === 'function') mql.addEventListener('change', handler)
    else if(typeof (mql as any).addListener === 'function') (mql as any).addListener(handler)
  }
}catch{}


