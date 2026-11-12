;redcode-94nop
;name Core of Duty: Medium Process Warfare
;author inversed
;strategy Paper + imp launcher
;assert 1
;       (CORESIZE == 8000) && (MAXPROCESSES == 250)

; ..... Paper ......................................
pstep1  equ     7181
pstep2  equ     5356
pstep3  equ      607
bstep1  equ     1402
bstep2  equ     3960

; ..... Imp Launcher ...............................
istep   equ     2667
sstep   equ     5063
sofs    equ     4051

; ..... Boot .......................................
bdil    equ     1076
bdi     equ     2063
bdp     equ     7125
ilen    equ     4
plen    equ     9
io      equ     bdi-bdil
po      equ     bdp-bdil
x0      equ     boot

; ----- Code ---------------------------------------
org     boot

boot    mov       imp           ,         x0+bdi
s1      spl       1             ,         0
        spl       b2            ,         0
        mov       s1            ,         0
        mov       s1            ,         0
        mov       s1            ,         0
        mov     < bpp           ,       { bpp
bpp     jmp       x0+bdp+plen   ,         silk1+plen
b2      spl       1             ,         0
        mov     < bpi           ,       { bpi
bpi     jmp       x0+bdil+ilen  ,         il+ilen

silk1   spl     @ 0             ,       { pstep1
        mov     } silk1         ,       > silk1
silk2   spl     @ 0             ,       > pstep2
        mov     } silk2         ,       > silk2
        mov       kill          ,       > bstep1
        mov       kill          ,       } bstep2
        mov     { silk2         ,       < silk3
silk3   djn.f   @ 0             ,       > pstep3
kill    dat     < istep         ,       < 2*istep

il      spl     # sstep+1       ,         istep
        mov       il+po+plen-1  ,       < iptr
        add.x     il            ,         iptr
iptr    djn.f     il+io-4*istep ,       { sofs
imp     mov.i   # istep/2       ,         istep
