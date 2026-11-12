;redcode-tiny
;name Burning Desire
;author John Metcalf
;strategy .5c vampire
;kill Burning Desire
;assert CORESIZE==800
 
        half   equ (CORESIZE/2)
        step   equ (-55)
        trap   equ (mid+half+step)
        fang   equ (mid+half-step)
        gate   equ mid
        dpos   equ (decoy+983)
 
        org    decoy
 
inc     spl    #step,      <-step
 
vamp    sub    inc,        fang
        mov    fang,       *fang
        mov    fang,       @fang
mid     jmz.f  vamp,       trap
 
bptr    div.ab #1,         #6
bomb    spl    #30,        8
clear   mov    *bptr,      >gate
        djn.f  clear,      }bomb
 
        for    3
        dat    0,0
        rof
 
vbomb   djn.f  >half,      {half+step*2
 
decoy   mov    >dpos+1,    {dpos+22
        mov    <dpos+23,   {dpos+43
        mov    <dpos+44,   {dpos+64
        mov    <dpos+65,   {dpos+85
        mov    <dpos+86,   {dpos+106
        mov    vbomb,      fang
        djn.f  vamp+1,     {dpos+127
