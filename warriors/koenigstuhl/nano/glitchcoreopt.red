;redcode-nano
;name Glitch//CORE//opt
;author John Metcalf
;strategy paper/clear
;assert CORESIZE==80

        pstep  equ -37

paper   spl    #0,       >-26
        mov    }paper,   }dest
dest    spl    {pstep,   >-25
clr     mov.i  @-11,     {29
        djn.f  clr,      {29

