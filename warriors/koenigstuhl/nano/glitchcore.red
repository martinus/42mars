;redcode-nano
;name Glitch//CORE
;author John Metcalf
;strategy paper/clear for the Nano Challenge
;assert CORESIZE==80

        pstep  equ -36

paper   spl    #0,       >-7
        mov    }paper,   }dest
dest    spl    {pstep,   >-27
clr     mov.i  @-20,     {26
        djn.f  clr,      {-16

