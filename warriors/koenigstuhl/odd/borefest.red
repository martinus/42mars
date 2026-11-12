;redcode-mp
;name Borefest
;author inversed
;strategy Two imp launchers
;assert (CORESIZE == 8000)

pstep   equ     4523
bstep   equ     1804
scratch equ     667
istep   equ     2667
half    equ     4000
gap     equ     13
istart  equ     1-4*istep

        spl       1         ,   { scratch
        spl       1         ,   { scratch
p2      spl       L1+half   ,     L2
        mov     > p2        ,   } p2
L1      spl     # 0         ,   > 2
        add.f   # istep     ,     1
        jmp       istart    ,   { scratch
        mov.i   # istep/2   ,     istep

  for   gap
        dat       0         ,     0
  rof

L2      spl     # 0         ,   > 2
        add.f   # istep     ,     1
        jmp       istart    ,   { scratch
        mov.i   # istep     ,   * 0
